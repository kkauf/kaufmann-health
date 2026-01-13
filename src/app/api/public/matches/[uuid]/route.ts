import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ServerAnalytics } from '@/lib/server-analytics';
import { logError } from '@/lib/logger';
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
    const { data: refRows, error: refErr } = await supabaseServer
      .from('matches')
      .select('id, created_at, patient_id')
      .eq('secure_uuid', uuid)
      .order('created_at', { ascending: false })
      .limit(1);

    const ref = Array.isArray(refRows) && refRows.length > 0 ? refRows[0] : null;
    if (refErr || !ref) {
      await logError('api.public.matches.get', refErr || 'not_found', { stage: 'load_ref', uuid });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    type RefRow = { id: string; created_at?: string | null; patient_id: string };
    const r = ref as unknown as RefRow;
    const age = hoursSince(r.created_at ?? undefined);
    if (age == null || age > 24 * 30) {
      return NextResponse.json({ data: null, error: 'Link expired' }, { status: 410 });
    }

    const patientId = r.patient_id;

    // Load patient context (for prefill + session)
    const { data: patient } = await supabaseServer
      .from('people')
      .select('name, email, phone_number, status, metadata')
      .eq('id', patientId)
      .single();

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

    type PatientRow = { name?: string | null; email?: string | null; phone_number?: string | null; status?: string | null; metadata?: { issue?: string; notes?: string; additional_info?: string; city?: string; session_preference?: 'online'|'in_person'; session_preferences?: ('online'|'in_person')[]; specializations?: string[]; schwerpunkte?: string[]; gender_preference?: 'male'|'female'|'no_preference'; start_timing?: string; modality_matters?: boolean } | null };
    const p = (patient || null) as PatientRow | null;
    const patientName = (p?.name || '') || null;
    const patientStatus = (p?.status || '') || null;
    const issue = (p?.metadata?.notes || p?.metadata?.issue || p?.metadata?.additional_info || '') || null;
    const sessionPreference = p?.metadata?.session_preference ?? null;
    const startTiming = typeof p?.metadata?.start_timing === 'string' ? p!.metadata!.start_timing : undefined;
    const modalityMatters = typeof p?.metadata?.modality_matters === 'boolean' ? p!.metadata!.modality_matters : undefined;
    const patientMeta: PatientMeta = {
      city: p?.metadata?.city,
      session_preference: p?.metadata?.session_preference,
      session_preferences: p?.metadata?.session_preferences,
      issue: p?.metadata?.issue,
      specializations: p?.metadata?.specializations,
      gender_preference: p?.metadata?.gender_preference,
    };

    // Fetch all matches for this patient (recent window)
    const { data: matches } = await supabaseServer
      .from('matches')
      .select('id, therapist_id, status, created_at, metadata')
      .eq('patient_id', patientId)
      .gte('created_at', new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

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

    // Fetch therapist profiles using shared select columns
    // Local type for mismatch scoring (extends shared fields with match-specific access patterns)
    type MatchTherapistRow = {
      id: string;
      first_name: string | null;
      last_name: string | null;
      gender?: string | null;
      photo_url?: string | null;
      city?: string | null;
      modalities?: string[] | null;
      schwerpunkte?: string[] | null;
      session_preferences?: string[] | null;
      accepting_new?: boolean | null;
      typical_rate?: number | null;
      metadata?: { session_preferences?: string[] | null; profile?: { approach_text?: string; who_comes_to_me?: string; session_focus?: string; first_session?: string; about_me?: string; qualification?: string }; [k: string]: unknown } | null;
      // Cal.com integration fields
      cal_username?: string | null;
      cal_enabled?: boolean | null;
      cal_bookings_live?: boolean | null;
    };
    let therapistRows: MatchTherapistRow[] = [];
    if (therapistIds.length > 0) {
      const { data: trows } = await supabaseServer
        .from('therapists')
        .select(THERAPIST_SELECT_COLUMNS_WITH_GENDER)
        .in('id', therapistIds);
      if (Array.isArray(trows)) {
        therapistRows = (trows as unknown as MatchTherapistRow[]).filter(t => t.accepting_new !== false);
      }
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
      const tRow: TherapistRowForMatch = {
        id: t.id,
        gender: t.gender || undefined,
        city: t.city || undefined,
        session_preferences: Array.isArray(t.session_preferences) ? t.session_preferences : (Array.isArray(t.metadata?.session_preferences) ? t.metadata?.session_preferences : []),
        modalities: Array.isArray(t.modalities) ? t.modalities : [],
        schwerpunkte: Array.isArray(t.schwerpunkte) ? t.schwerpunkte : [],
        accepting_new: t.accepting_new,
        photo_url: t.photo_url,
        metadata: t.metadata as TherapistRowForMatch['metadata'],
      };
      
      const mm = computeMismatches(patientMeta, tRow);
      
      // Calculate scores per spec (slot counts are 0 - Cal.com handles booking)
      const platformScore = calculatePlatformScore(tRow, 0, 0);
      const matchScore = calculateMatchScore(tRow, patientMeta);
      const totalScore = calculateTotalScore(matchScore, platformScore);
      
      // "Perfect" = high total score or no mismatches
      const isPerfect = totalScore >= 120 || mm.reasons.length === 0;
      
      return { t, mm, isPerfect, totalScore, platformScore, matchScore } as const;
    });

    // Sort by totalScore descending (per spec: Match × 1.5 + Platform)
    scored.sort((a, b) => b.totalScore - a.totalScore);

    // Build response list and include per-therapist is_perfect
    const list = scored.map(({ t, isPerfect }) => ({
      id: t.id,
      first_name: t.first_name,
      last_name: t.last_name,
      photo_url: t.photo_url || undefined,
      city: (t.city || '') || undefined,
      // Default to true when accepting_new is null/undefined to avoid disabling booking unnecessarily
      accepting_new: (t.accepting_new === false ? false : true),
      contacted_at: contactedById.get(t.id) || null,
      modalities: Array.isArray(t.modalities) ? t.modalities : [],
      schwerpunkte: Array.isArray(t.schwerpunkte) ? t.schwerpunkte : [],
      session_preferences: Array.isArray(t.session_preferences) ? t.session_preferences : (Array.isArray(t.metadata?.session_preferences) ? t.metadata?.session_preferences : []),
      approach_text: t.metadata?.profile?.approach_text || '',
      gender: t.gender || undefined,
      is_perfect: Boolean(isPerfect),
      // Include full metadata for rich profile display (qualification, sections, pricing, etc.)
      metadata: t.metadata || undefined,
      // Cal.com integration fields for booking UI
      cal_username: t.cal_username || undefined,
      cal_enabled: t.cal_enabled || false,
      cal_bookings_live: t.cal_bookings_live || false,
    }));

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
        },
        therapists: list.slice(0, 3),
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
