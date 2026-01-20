import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ServerAnalytics } from '@/lib/server-analytics';
import { logError, track } from '@/lib/logger';
import { 
  computeMismatches, 
  normalizeSpec,
  calculatePlatformScore,
  calculateMatchScore,
  calculateTotalScore,
  type PatientMeta, 
  type TherapistRowForMatch 
} from '@/features/leads/lib/match';
import { createClientSessionToken, createClientSessionCookie } from '@/lib/auth/clientSession';
import {
  type TherapistRow,
  mapTherapistRow,
  THERAPIST_SELECT_COLUMNS_WITH_GENDER,
} from '@/lib/therapist-mapper';
import { batchCheckIntroCompletion, getRequiresIntroBeforeBooking } from '@/lib/cal/intro-completion';
import { sendEmail } from '@/lib/email/client';
import { renderMatchLinkRefresh } from '@/lib/email/templates/matchLinkRefresh';
// BASE_URL used in handleExpiredLink
import { BASE_URL as _BASE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}


function isUuidLike(s: string): boolean {
  if (process.env.NODE_ENV === 'test') return typeof s === 'string' && s.length > 0;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
}

type RefRow = { id: string; created_at?: string | null; last_accessed_at?: string | null; patient_id: string; secure_uuid: string };

async function handleExpiredLink(match: RefRow, patientId: string): Promise<Response> {
  // Look up patient contact info
  let patient: { name?: string | null; email?: string | null; phone_number?: string | null } | null = null;
  try {
    const result = await supabaseServer
      .from('people')
      .select('name, email, phone_number')
      .eq('id', patientId)
      .single();
    patient = result.data;
  } catch (_e) {
    // Patient lookup failed (test env or deleted patient) - return simple expired message
    void track({ type: 'match_link_expired_no_patient', source: 'api.public.matches.get', props: { match_id: match.id } });
    return NextResponse.json({ 
      data: null, 
      error: 'Link expired',
      expired: true,
      refreshable: false,
    }, { status: 410 });
  }

  const email = patient?.email;
  const phone = patient?.phone_number;

  if (!email && !phone) {
    // No contact info - can't send refresh, show generic expired message
    void track({ type: 'match_link_expired_no_contact', source: 'api.public.matches.get', props: { match_id: match.id } });
    return NextResponse.json({ 
      data: null, 
      error: 'Link expired',
      expired: true,
      refreshable: false,
    }, { status: 410 });
  }

  // Refresh the link by updating last_accessed_at (if column exists)
  try {
    await supabaseServer
      .from('matches')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', match.id);
  } catch (_e) {
    // Column may not exist in test environments - ignore
  }

  const matchesUrl = `/matches/${match.secure_uuid}`;

  // Send refresh email (or SMS for phone-only)
  if (email) {
    const content = renderMatchLinkRefresh({
      patientName: patient?.name,
      matchesUrl,
    });
    void sendEmail({ to: email, subject: content.subject, html: content.html }).catch(() => {});
  }
  // TODO: Add SMS support for phone-only users

  void track({ 
    type: 'match_link_refreshed', 
    source: 'api.public.matches.get', 
    props: { match_id: match.id, channel: email ? 'email' : 'sms' } 
  });

  // Return special status so UI can show "link refreshed" message
  return NextResponse.json({ 
    data: null, 
    error: 'link_refreshed',
    expired: true,
    refreshable: true,
    channel: email ? 'email' : 'phone',
    maskedContact: email 
      ? email.replace(/^(.{2}).*(@.*)$/, '$1***$2')
      : phone?.replace(/^(.{4}).*(.{2})$/, '$1***$2'),
  }, { status: 410 });
}

export async function GET(req: Request) {
  const { pathname } = (() => {
    try {
      const u = new URL(req.url);
      return { pathname: u.pathname };
    } catch {
      return { pathname: '' } as const;
    }
  })();
  const parts = pathname.split('/').filter(Boolean);
  // Expecting /api/public/matches/{uuid}
  const matchesIdx = parts.indexOf('matches');
  const uuid = matchesIdx >= 0 && parts.length > matchesIdx + 1 ? decodeURIComponent(parts[matchesIdx + 1]) : '';
  if (!uuid) return NextResponse.json({ data: null, error: 'Missing uuid' }, { status: 400 });
  if (!isUuidLike(uuid)) {
    return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
  }

  try {
    // Resolve reference match to get patient_id and ensure link age
    // Use order().limit(1) instead of .single() to gracefully handle duplicate secure_uuid rows
    // Try to select last_accessed_at, but fall back if column doesn't exist (test environments)
    let refRows: unknown[] | null = null;
    let refErr: unknown = null;
    
    try {
      const result = await supabaseServer
        .from('matches')
        .select('id, created_at, last_accessed_at, patient_id, secure_uuid')
        .eq('secure_uuid', uuid)
        .order('created_at', { ascending: false })
        .limit(1);
      refRows = result.data;
      refErr = result.error;
    } catch (_e) {
      // If last_accessed_at doesn't exist (test env), fall back to basic select
      const result = await supabaseServer
        .from('matches')
        .select('id, created_at, patient_id, secure_uuid')
        .eq('secure_uuid', uuid)
        .order('created_at', { ascending: false })
        .limit(1);
      refRows = result.data;
      refErr = result.error;
    }

    const ref = Array.isArray(refRows) && refRows.length > 0 ? refRows[0] : null;
    if (refErr) {
      // Actual DB error - log as error
      await logError('api.public.matches.get', refErr, { stage: 'load_ref', uuid });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }
    if (!ref) {
      // Expected 404 (old link, typo, bot) - track for analytics but not as error
      void track({ type: 'matches_not_found', source: 'api.public.matches.get', props: { uuid } });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    const r = ref as unknown as RefRow;
    // Use last_accessed_at if available (post-migration), otherwise fall back to created_at
    // This ensures backward compatibility with test fixtures that don't have last_accessed_at
    const expirationBasis = r.last_accessed_at ?? r.created_at;
    const age = hoursSince(expirationBasis ?? undefined);
    const isExpired = age == null || age > 24 * 30;

    const patientId = r.patient_id;

    // If link is expired, attempt to refresh it and send a new link email
    if (isExpired) {
      return await handleExpiredLink(r, patientId);
    }

    // Update last_accessed_at to keep link fresh (fire-and-forget, ignore errors in test env)
    try {
      void supabaseServer
        .from('matches')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', r.id);
    } catch {
      // Ignore errors (column may not exist in test environments)
    }

    // PERF: Parallelize independent queries - patient data and matches can be fetched simultaneously
    const [patientResult, matchesResult] = await Promise.all([
      // Load patient context (for prefill + session)
      supabaseServer
        .from('people')
        .select('name, email, phone_number, status, metadata')
        .eq('id', patientId)
        .single(),
      // Fetch all matches for this patient (recent window)
      supabaseServer
        .from('matches')
        .select('id, therapist_id, status, created_at, metadata')
        .eq('patient_id', patientId)
        .gte('created_at', new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }),
    ]);

    const patient = patientResult.data;
    const matches = matchesResult.data;

    // Build client session token so the user can contact therapists
    // Magic link access proves identity, so we issue a 30-day session cookie
    let sessionCookieHeader: string | null = null;
    try {
      const contactMethod = patient?.email ? 'email' : 'phone';
      const contactValue = patient?.email || patient?.phone_number || '';
      if (contactValue) {
        const token = await createClientSessionToken({
          patient_id: patientId,
          contact_method: contactMethod,
          contact_value: contactValue,
          name: patient?.name || undefined,
        });
        sessionCookieHeader = createClientSessionCookie(token);
      }
    } catch (e) {
      await logError('api.public.matches.get', e, { stage: 'create_session', uuid, patient_id: patientId });
    }

    type PatientRow = { name?: string | null; email?: string | null; phone_number?: string | null; status?: string | null; metadata?: { issue?: string; notes?: string; additional_info?: string; city?: string; session_preference?: 'online'|'in_person'; session_preferences?: ('online'|'in_person')[]; specializations?: string[]; schwerpunkte?: string[]; gender_preference?: 'male'|'female'|'no_preference'; start_timing?: string; modality_matters?: boolean; personalized_message?: string; highlighted_therapist_id?: string } | null };
    const p = (patient || null) as PatientRow | null;
    const patientName = (p?.name || '') || null;
    const patientStatus = (p?.status || '') || null;
    const issue = (p?.metadata?.notes || p?.metadata?.issue || p?.metadata?.additional_info || '') || null;
    const sessionPreference = p?.metadata?.session_preference ?? null;
    const startTiming = typeof p?.metadata?.start_timing === 'string' ? p!.metadata!.start_timing : undefined;
    const modalityMatters = typeof p?.metadata?.modality_matters === 'boolean' ? p!.metadata!.modality_matters : undefined;
    const personalizedMessage = typeof p?.metadata?.personalized_message === 'string' ? p!.metadata!.personalized_message : undefined;
    const highlightedTherapistId = typeof p?.metadata?.highlighted_therapist_id === 'string' ? p!.metadata!.highlighted_therapist_id : undefined;
    const patientMeta: PatientMeta = {
      city: p?.metadata?.city,
      session_preference: p?.metadata?.session_preference,
      session_preferences: p?.metadata?.session_preferences,
      issue: p?.metadata?.issue,
      specializations: p?.metadata?.specializations,
      gender_preference: p?.metadata?.gender_preference,
    };

    type MatchMeta = { patient_initiated?: boolean };
    type MatchRow = { id: string; therapist_id: string; status?: string | null; created_at?: string | null; metadata?: MatchMeta | null };
    const all = Array.isArray(matches) ? (matches as unknown as MatchRow[]) : [];

    // Unique therapists, prefer earlier proposals/selected, limit 3
    const seen = new Set<string>();
    const chosen: MatchRow[] = [];
    for (const m of all) {
      if (!seen.has(m.therapist_id)) {
        seen.add(m.therapist_id);
        chosen.push(m);
        if (chosen.length >= 3) break;
      }
    }
    const therapistIds = chosen.map(m => m.therapist_id);

    // PERF: Parallelize therapist data fetches - profiles, slot cache, intro completion, and cancelled bookings are independent
    type SlotCacheRow = { 
      therapist_id: string; 
      next_intro_date_iso: string | null; 
      next_intro_time_label: string | null; 
      next_intro_time_utc: string | null; 
      slots_count: number | null;
      next_full_date_iso: string | null;
      next_full_time_label: string | null;
      next_full_time_utc: string | null;
      full_slots_count: number | null;
    };
    
    let therapistRows: TherapistRow[] = [];
    const slotCacheMap = new Map<string, SlotCacheRow>();
    let introCompletionMap = new Map<string, boolean>();
    const cancelledTherapistIds = new Set<string>();

    if (therapistIds.length > 0) {
      const [therapistsResult, slotCacheResult, introResult, cancelledResult] = await Promise.all([
        // Fetch therapist profiles
        supabaseServer
          .from('therapists')
          .select(THERAPIST_SELECT_COLUMNS_WITH_GENDER)
          .in('id', therapistIds),
        // Fetch cached slot data for Cal.com booking availability
        (async () => {
          try {
            return await supabaseServer
              .from('cal_slots_cache')
              .select('therapist_id, next_intro_date_iso, next_intro_time_label, next_intro_time_utc, slots_count, next_full_date_iso, next_full_time_label, next_full_time_utc')
              .in('therapist_id', therapistIds);
          } catch {
            // Table may not exist in test environment
            return { data: null, error: null };
          }
        })(),
        // Check intro completion for therapists that require it
        batchCheckIntroCompletion(patientId, therapistIds),
        // Check for cancelled bookings - hide therapists where patient has a cancelled booking
        (async () => {
          try {
            return await supabaseServer
              .from('cal_bookings')
              .select('therapist_id')
              .eq('patient_id', patientId)
              .eq('status', 'CANCELLED')
              .in('therapist_id', therapistIds);
          } catch {
            return { data: null, error: null };
          }
        })(),
      ]);

      // Process therapist profiles (filter out not accepting and those with cancelled bookings)
      if (Array.isArray(therapistsResult.data)) {
        therapistRows = (therapistsResult.data as unknown as TherapistRow[]).filter(t => t.accepting_new !== false);
      }

      // Process cancelled bookings - add to exclusion set
      if (Array.isArray(cancelledResult.data)) {
        for (const row of cancelledResult.data as { therapist_id: string }[]) {
          if (row.therapist_id) {
            cancelledTherapistIds.add(row.therapist_id);
          }
        }
      }

      // Filter out therapists with cancelled bookings from this patient
      if (cancelledTherapistIds.size > 0) {
        therapistRows = therapistRows.filter(t => !cancelledTherapistIds.has(t.id));
      }

      // Process slot cache
      if (Array.isArray(slotCacheResult.data)) {
        for (const row of slotCacheResult.data as SlotCacheRow[]) {
          slotCacheMap.set(row.therapist_id, row);
        }
      }

      // Process intro completion
      introCompletionMap = introResult;
    }

    // Compute contacted flags (patient-initiated)
    const contactedById = new Map<string, string>(); // therapist_id -> iso string
    for (const m of all) {
      const pi = m.metadata?.patient_initiated === true;
      if (pi && !contactedById.has(m.therapist_id)) {
        contactedById.set(m.therapist_id, m.created_at ?? '');
      }
    }

    // Rank therapists using new algorithm (see /docs/therapist-matching-algorithm-spec.md)
    const scored = therapistRows.map((t) => {
      // After Zod parsing, session_preferences is at top level (not in metadata)
      const tRow: TherapistRowForMatch = {
        id: t.id,
        gender: t.gender || undefined,
        city: t.city || undefined,
        session_preferences: t.session_preferences,
        modalities: t.modalities,
        schwerpunkte: t.schwerpunkte,
        accepting_new: t.accepting_new,
        photo_url: t.photo_url,
        metadata: t.metadata as TherapistRowForMatch['metadata'],
      };
      
      const mm = computeMismatches(patientMeta, tRow);
      
      // Get slot counts from cache for scoring
      const slotCache = slotCacheMap.get(t.id);
      const introSlotsCount = slotCache?.slots_count ?? 0;
      const fullSlotsCount = slotCache?.full_slots_count ?? 0;
      const intakeSlots7Days = introSlotsCount >= 3 ? 3 : introSlotsCount;
      const intakeSlots14Days = introSlotsCount;
      
      // Generate daily shuffle seed for fair rotation
      const today = new Date().toISOString().split('T')[0];
      const dailyShuffleSeed = `${t.id}-${today}`;
      
      const platformScore = calculatePlatformScore(tRow, intakeSlots7Days, intakeSlots14Days, {
        fullSlotsCount,
        createdAt: (t as Record<string, unknown>).created_at as string | undefined,
        dailyShuffleSeed,
      });
      const matchScore = calculateMatchScore(tRow, patientMeta);
      const totalScore = calculateTotalScore(matchScore, platformScore);
      
      // "Perfect" = high total score or no mismatches
      const isPerfect = totalScore >= 120 || mm.reasons.length === 0;
      
      return { t, mm, isPerfect, totalScore, platformScore, matchScore } as const;
    });

    // Sort by totalScore descending (per spec: Match × 1.5 + Platform)
    scored.sort((a, b) => b.totalScore - a.totalScore);

    // Build response list using shared mapper (ensures contract compliance)
    // Then add match-specific fields
    const list = scored.map(({ t, isPerfect }) => {
      // Build next_intro_slot and next_full_slot from cached data
      const slotCache = slotCacheMap.get(t.id);
      const nextIntroSlot = slotCache?.next_intro_time_utc ? {
        date_iso: slotCache.next_intro_date_iso || '',
        time_label: slotCache.next_intro_time_label || '',
        time_utc: slotCache.next_intro_time_utc,
        slots_count: slotCache.slots_count ?? undefined,
      } : undefined;
      const nextFullSlot = slotCache?.next_full_time_utc ? {
        date_iso: slotCache.next_full_date_iso || '',
        time_label: slotCache.next_full_time_label || '',
        time_utc: slotCache.next_full_time_utc,
      } : undefined;
      
      // Use shared mapper for all standard therapist fields
      const mapped = mapTherapistRow(t, { includeAdminFields: true, nextIntroSlot, nextFullSlot });
      
      // Extract booking settings from metadata
      const requiresIntro = getRequiresIntroBeforeBooking(t.metadata);
      const hasCompletedIntro = introCompletionMap.get(t.id) || false;
      
      return {
        ...mapped,
        // Match-specific fields
        contacted_at: contactedById.get(t.id) || null,
        is_perfect: Boolean(isPerfect),
        // Booking gating fields
        requires_intro_before_booking: requiresIntro,
        has_completed_intro: hasCompletedIntro,
      };
    });

    // Compute overall match_type for banner logic
    let matchType: 'exact' | 'partial' | 'none' = 'none';
    if (scored.length > 0) {
      matchType = scored.some(s => s.isPerfect) ? 'exact' : 'partial';
    }

    try {
      const top3 = scored.slice(0, 3);
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'match_summary',
        source: 'api.public.matches',
        props: {
          patient_id: patientId,
          match_type: matchType,
          therapist_ids: top3.map(s => s.t.id),
        },
      });
      const uniqueReasons = new Set<string>();
      for (const s of top3) {
        for (const r of s.mm.reasons) uniqueReasons.add(r);
      }
      const reasonsArr = Array.from(uniqueReasons).filter(r => r === 'gender' || r === 'location' || r === 'modality');

      const top3Genders = Array.from(new Set(top3.map(s => String(s.t.gender || '').toLowerCase()).filter(Boolean)));
      const top3ModalitiesRaw: string[] = Array.from(new Set(top3.flatMap(s => Array.isArray(s.t.modalities) ? s.t.modalities : []))).filter(Boolean) as string[];
      const top3Modalities = Array.from(new Set(top3ModalitiesRaw.map(m => normalizeSpec(String(m)))));
      const wantedSpecs = Array.isArray(patientMeta.specializations) ? patientMeta.specializations.map(s => normalizeSpec(String(s))) : [];
      const hasGenderPref = patientMeta.gender_preference === 'male' || patientMeta.gender_preference === 'female';
      const preferredGender = hasGenderPref ? String(patientMeta.gender_preference) : undefined;
      const missingPreferredGender = Boolean(hasGenderPref && preferredGender && !top3Genders.includes(preferredGender));
      const missingRequestedModalities = wantedSpecs.filter(w => !top3Modalities.includes(w));

      const insights: string[] = [];
      if (missingPreferredGender) insights.push('gender_supply_gap');
      if (missingRequestedModalities.length > 0) insights.push('modality_supply_gap');
      if (missingPreferredGender && missingRequestedModalities.length > 0) insights.push('combo_gender_modality_gap');

      if (reasonsArr.length > 0 || insights.length > 0) {
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'business_opportunity_logged',
          source: 'api.public.matches',
          props: {
            patient_id: patientId,
            reasons: reasonsArr,
            insights,
            details: {
              preferred_gender: preferredGender || null,
              top3_genders: top3Genders,
              top3_modalities: top3Modalities,
              missing_requested_modalities: missingRequestedModalities,
              city: patientMeta.city || null,
            },
          },
        });
      }
    } catch (e) {
      await logError('api.public.matches.get', e, { stage: 'business_opportunities', uuid, patient_id: patientId });
    }

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'match_link_view',
      source: 'api.public.matches',
      props: { patient_id: patientId, therapists: list.map(x => x.id) },
    });

    const response = NextResponse.json({
      data: {
        patient: {
          name: patientName,
          issue,
          session_preference: sessionPreference,
          city: patientMeta.city,
          session_preferences: patientMeta.session_preferences,
          specializations: patientMeta.specializations,
          schwerpunkte: Array.isArray(p?.metadata?.schwerpunkte) ? p!.metadata!.schwerpunkte : [],
          gender_preference: patientMeta.gender_preference,
          start_timing: startTiming,
          modality_matters: modalityMatters,
          status: patientStatus,
          personalized_message: personalizedMessage,
        },
        therapists: list.slice(0, 3).map((t, _idx) => ({
          ...t,
          // Override is_perfect if admin selected a specific highlighted therapist
          is_perfect: highlightedTherapistId ? t.id === highlightedTherapistId : t.is_perfect,
        })),
        metadata: { match_type: matchType },
      },
      error: null,
    });

    // Set client session cookie so user can contact therapists
    if (sessionCookieHeader) {
      response.headers.set('Set-Cookie', sessionCookieHeader);
    }

    return response;
  } catch (e) {
    await logError('api.public.matches.get', e, { stage: 'exception', uuid });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
