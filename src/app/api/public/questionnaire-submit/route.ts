import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ServerAnalytics, parseAttributionFromRequest, parseCampaignFromRequest } from '@/lib/server-analytics';
import { hashIP } from '@/features/leads/lib/validation';
import { isIpRateLimited } from '@/features/leads/lib/rateLimit';
import { track } from '@/lib/logger';
import { safeJson } from '@/lib/http';
import { computeMismatches, normalizeSpec, type PatientMeta, type TherapistRowForMatch, type MismatchResult } from '@/features/leads/lib/match';

// getClientIP helper
function getClientIP(headers: Headers): string | undefined {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xrip = headers.get('x-real-ip');
  return xrip || undefined;
}

// Map German UI gender labels to English values for matching logic
function normalizeGenderPreference(gender: string | undefined): 'male' | 'female' | 'no_preference' | undefined {
  if (!gender) return undefined;
  switch (gender) {
    case 'Mann': return 'male';
    case 'Frau': return 'female';
    case 'Keine Präferenz':
    case 'Divers/non-binär':
      return 'no_preference';
    // Already normalized values
    case 'male': return 'male';
    case 'female': return 'female';
    case 'no_preference': return 'no_preference';
    default: return undefined;
  }
}

export const runtime = 'nodejs';

/**
 * Create instant matches for a patient based on their preferences
 * Returns secure match UUID for browsing therapists anonymously
 */
async function createInstantMatchesForPatient(patientId: string, variant?: string): Promise<{ matchesUrl: string; matchQuality: 'exact' | 'partial' | 'none' } | null> {
  try {
    const isConcierge = variant === 'concierge';
    if (process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW !== 'true' && !isConcierge) return null;

    type PersonRow = { id: string; metadata?: Record<string, unknown> | null };
    const { data: person } = await supabaseServer
      .from('people')
      .select('id, metadata')
      .eq('id', patientId)
      .single<PersonRow>();

    const meta = (person?.metadata || {}) as Record<string, unknown>;
    const city = typeof meta['city'] === 'string' ? (meta['city'] as string) : undefined;
    const session_preference = typeof meta['session_preference'] === 'string' ? (meta['session_preference'] as string) as 'online' | 'in_person' : undefined;
    const session_preferences = Array.isArray(meta['session_preferences']) ? (meta['session_preferences'] as ('online' | 'in_person')[]) : undefined;
    const specializations = Array.isArray(meta['specializations']) ? (meta['specializations'] as string[]) : undefined;
    const gender_preference = typeof meta['gender_preference'] === 'string' ? (meta['gender_preference'] as 'male' | 'female' | 'no_preference') : undefined;
    const time_slots = Array.isArray(meta['time_slots']) ? (meta['time_slots'] as string[]) : [];
    const pMeta: PatientMeta = { city, session_preference, session_preferences, specializations, gender_preference };

    // Fetch all verified therapists
    type TR = { id: string; gender?: string | null; city?: string | null; session_preferences?: unknown; modalities?: unknown; accepting_new?: boolean | null; metadata?: Record<string, unknown> | null };
    const { data: trows } = await supabaseServer
      .from('therapists')
      .select('id, gender, city, session_preferences, modalities, accepting_new, metadata')
      .eq('status', 'verified')
      .limit(1000);
    const therapists = Array.isArray(trows) ? (trows as TR[]) : [];

    // Fetch therapist slots
    const tIds = therapists.map(t => t.id);
    type SlotRow = { therapist_id: string; day_of_week: number; time_local: string; format: string; address: string | null; active: boolean | null };
    let slotsByTid = new Map<string, SlotRow[]>();
    try {
      if (tIds.length > 0) {
        const { data: srows } = await supabaseServer
          .from('therapist_slots')
          .select('therapist_id, day_of_week, time_local, format, address, active')
          .in('therapist_id', tIds)
          .eq('active', true)
          .limit(5000);
        if (Array.isArray(srows)) {
          for (const s of srows as SlotRow[]) {
            const arr = slotsByTid.get(s.therapist_id) || [];
            arr.push(s);
            slotsByTid.set(s.therapist_id, arr);
          }
        }
      }
    } catch { slotsByTid = new Map(); }

    // Time slot matching logic
    function slotMatchesPreferences(therapistId: string): boolean {
      const prefs = new Set((time_slots || []).map((s) => String(s)));
      if (prefs.size === 0 || prefs.has('Bin flexibel')) return true;
      const wantMorning = Array.from(prefs).some((s) => s.toLowerCase().includes('morg'));
      const wantAfternoon = Array.from(prefs).some((s) => s.toLowerCase().includes('nachmitt'));
      const wantEvening = Array.from(prefs).some((s) => s.toLowerCase().includes('abend'));
      const wantWeekend = Array.from(prefs).some((s) => s.toLowerCase().includes('wochen'));
      const slots = slotsByTid.get(therapistId) || [];
      const now = new Date();
      for (let offset = 1; offset <= 21; offset++) {
        const d = new Date(now.getTime());
        d.setUTCDate(d.getUTCDate() + offset);
        const dow = d.getUTCDay();
        for (const s of slots) {
          if (Number(s.day_of_week) !== (dow === 0 ? 0 : dow)) continue;
          const h = parseInt(String(s.time_local || '').slice(0, 2), 10);
          const isMorning = h >= 8 && h < 12;
          const isAfternoon = h >= 12 && h < 17;
          const isEvening = h >= 17 && h < 21;
          const isWeekend = dow === 0 || dow === 6;
          if ((wantMorning && isMorning) || (wantAfternoon && isAfternoon) || (wantEvening && isEvening) || (wantWeekend && isWeekend)) return true;
        }
      }
      return false;
    }

    // Score and rank therapists
    const scored: { t: TherapistRowForMatch; result: MismatchResult; hasSlots: boolean }[] = [];
    for (const t of therapists) {
      if (t.accepting_new === false) continue;
      const tMeta = (t.metadata || {}) as Record<string, unknown>;
      const hideFromDir = tMeta['hide_from_directory'] === true;
      if (hideFromDir) continue;
      const tRow: TherapistRowForMatch = {
        id: t.id,
        gender: typeof t.gender === 'string' ? (t.gender as 'male' | 'female' | 'non_binary') : undefined,
        city: t.city ?? undefined,
        session_preferences: Array.isArray(t.session_preferences) ? (t.session_preferences as ('online' | 'in_person')[]) : [],
        modalities: Array.isArray(t.modalities) ? (t.modalities as string[]) : [],
      };
      const result = computeMismatches(pMeta, tRow);
      const hasSlots = slotMatchesPreferences(t.id);
      scored.push({ t: tRow, result, hasSlots });
    }

    // Sort by isPerfect first, then by number of mismatches, then by slot availability
    scored.sort((a, b) => {
      if (a.result.isPerfect !== b.result.isPerfect) return a.result.isPerfect ? -1 : 1;
      if (a.result.reasons.length !== b.result.reasons.length) return a.result.reasons.length - b.result.reasons.length;
      if (a.hasSlots !== b.hasSlots) return a.hasSlots ? -1 : 1;
      return 0;
    });

    // Limit to 2 matches for concierge feel (or 1 if perfect)
    const top = scored.slice(0, 2);
    const matchQuality: 'exact' | 'partial' | 'none' = top.length === 0 ? 'none' : top[0].result.isPerfect ? 'exact' : 'partial';

    // Create match records
    let secureUuid: string = randomUUID();
    for (let i = 0; i < top.length; i++) {
      // Only set secure_uuid on the first inserted row to avoid violating the unique index
      const payload: Record<string, unknown> = {
        patient_id: patientId,
        therapist_id: top[i].t.id,
        status: 'suggested',
      };
      if (i === 0 && secureUuid) {
        payload.secure_uuid = secureUuid;
      }
      const { data: row } = await supabaseServer
        .from('matches')
        .insert(payload)
        .select('secure_uuid')
        .single<{ secure_uuid?: string | null }>();
      if (i === 0 && row?.secure_uuid) secureUuid = row.secure_uuid;
    }
    try {
      const wantsInPerson = Boolean(
        (Array.isArray(session_preferences) && session_preferences.includes('in_person')) ||
        session_preference === 'in_person'
      );
      const uniqueReasons = new Set<string>();
      for (const r of top) {
        for (const reason of r.result.reasons) uniqueReasons.add(reason);
      }
      const reasonsArr = Array.from(uniqueReasons).filter(r => r === 'gender' || r === 'location' || r === 'modality');

      let total_in_person_slots = 0;
      let total_online_slots = 0;
      for (const s of top) {
        const rows = slotsByTid.get(s.t.id) || [];
        for (const row of rows) {
          const fmt = String(row.format || '').trim();
          if (fmt === 'in_person' || fmt === 'both') total_in_person_slots++;
          if (fmt === 'online' || fmt === 'both') total_online_slots++;
        }
      }

      const topGenders = Array.from(new Set(top.map(s => String(s.t.gender || '').toLowerCase()).filter(Boolean)));
      const topModalitiesRaw: string[] = Array.from(new Set(top.flatMap(s => Array.isArray(s.t.modalities) ? s.t.modalities : []))).filter(Boolean) as string[];
      const topModalities = Array.from(new Set(topModalitiesRaw.map(m => normalizeSpec(String(m)))));
      const wantedSpecs = Array.isArray(specializations) ? specializations.map(s => normalizeSpec(String(s))) : [];
      const hasGenderPref = gender_preference === 'male' || gender_preference === 'female';
      const preferredGender = hasGenderPref ? String(gender_preference) : undefined;
      const missingPreferredGender = Boolean(hasGenderPref && preferredGender && !topGenders.includes(preferredGender));
      const missingRequestedModalities = wantedSpecs.filter(w => !topModalities.includes(w));

      const insights: string[] = [];
      if (wantsInPerson && total_in_person_slots === 0) insights.push('in_person_supply_gap');
      if (missingPreferredGender) insights.push('gender_supply_gap');
      if (missingRequestedModalities.length > 0) insights.push('modality_supply_gap');
      if (missingPreferredGender && missingRequestedModalities.length > 0) insights.push('combo_gender_modality_gap');
      if (missingPreferredGender && wantsInPerson && total_in_person_slots === 0) insights.push('combo_gender_in_person_gap');

      if (reasonsArr.length > 0) {
        const rows = reasonsArr.map((r) => ({ patient_id: patientId, mismatch_type: r as 'gender' | 'location' | 'modality', city: city || null }));
        await supabaseServer.from('business_opportunities').insert(rows).select('id').limit(1).maybeSingle();
      }
      if (reasonsArr.length > 0 || insights.length > 0) {
        void track({
          type: 'business_opportunity_logged',
          source: 'api.questionnaire-submit',
          props: {
            patient_id: patientId,
            reasons: reasonsArr,
            insights,
            details: {
              wants_in_person: wantsInPerson,
              total_in_person_slots,
              total_online_slots,
              preferred_gender: preferredGender || null,
              top_genders: topGenders,
              top_modalities: topModalities,
              missing_requested_modalities: missingRequestedModalities,
              city: city || null,
            },
          },
        });
      }
    } catch { }

    return secureUuid ? { matchesUrl: `/matches/${encodeURIComponent(String(secureUuid))}`, matchQuality } : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/public/questionnaire-submit
 * 
 * Creates an anonymous patient record with preferences from Steps 1-5
 * Returns match URL for immediate browsing (no contact info required)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Extract questionnaire data (Steps 1-5 only)
    const {
      start_timing,
      additional_info,
      modality_matters,
      methods,
      city,
      session_preference,
      gender,
      time_slots,
      form_session_id,
    } = body;

    // Rate limiting
    const ip = getClientIP(req.headers);
    const ua = req.headers.get('user-agent') || undefined;
    if (ip) {
      const limited = await isIpRateLimited(supabaseServer, ip, 'patient');
      if (limited) {
        const attr = parseAttributionFromRequest(req);
        void track({
          type: 'questionnaire_rate_limited',
          level: 'warn',
          source: 'api.questionnaire-submit',
          ip,
          ua,
          props: {
            city,
            ...(form_session_id ? { form_session_id } : {}),
            ...(attr.referrer ? { referrer: attr.referrer } : {}),
            ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
          },
        });
        return safeJson(
          { data: null, error: 'Rate limited' },
          { status: 429, headers: { 'Cache-Control': 'no-store' } },
        );
      }
    }

    // Parse attribution (landing page only). For quiz flow, enforce canonical source/variant.
    const campaign = parseCampaignFromRequest(req);
    const landing_page = campaign.landing_page;
    const campaign_source: string | undefined = '/start';
    const campaign_variant: string | undefined = 'quiz';

    // Prepare metadata with all preferences
    // Normalize gender from German UI labels to English values for matching
    const normalizedGender = normalizeGenderPreference(gender);
    const metadata: Record<string, unknown> = {
      form_session_id,
      start_timing,
      additional_info,
      modality_matters,
      methods: methods || [],
      city,
      session_preference,
      gender_preference: normalizedGender,
      time_slots: time_slots || [],
    };

    // Add attribution data
    const attribution = parseAttributionFromRequest(req);
    if (attribution.referrer || attribution.utm_source) {
      metadata.attribution = {
        ...(attribution.referrer ? { referrer: attribution.referrer } : {}),
        ...(attribution.utm_source ? { utm_source: attribution.utm_source } : {}),
        ...(attribution.utm_medium ? { utm_medium: attribution.utm_medium } : {}),
        ...(attribution.utm_campaign ? { utm_campaign: attribution.utm_campaign } : {}),
        ...(landing_page ? { landing_page } : {}),
      };
    }

    // Create anonymous patient
    const { data: patient, error: insertError } = await supabaseServer
      .from('people')
      .insert({
        type: 'patient',
        status: 'anonymous',
        metadata,
        ...(campaign_source ? { campaign_source } : {}),
        ...(campaign_variant ? { campaign_variant } : {}),
      })
      .select('id')
      .single<{ id: string }>();

    if (insertError || !patient?.id) {
      void track({
        type: 'anonymous_patient_creation_failed',
        level: 'error',
        source: 'api.questionnaire-submit',
        ip,
        ua,
        props: { error: insertError?.message },
      });
      return safeJson(
        { data: null, error: 'Failed to create patient record' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Track anonymous patient creation
    await ServerAnalytics.trackEventFromRequest(req, {
      type: 'anonymous_patient_created',
      source: 'api.questionnaire-submit',
      props: {
        patient_id: patient.id,
        campaign_source,
        campaign_variant,
        has_city: !!city,
        has_timing: !!start_timing,
      },
    });

    // Create instant matches
    const matchResult = await createInstantMatchesForPatient(patient.id, campaign_variant);

    if (matchResult) {
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'instant_match_created',
        source: 'api.questionnaire-submit',
        props: {
          match_quality: matchResult.matchQuality,
          patient_id: patient.id,
        },
      });
    }

    return safeJson({
      data: {
        patientId: patient.id,
        matchesUrl: matchResult?.matchesUrl || null,
        matchQuality: matchResult?.matchQuality || 'none',
      },
      error: null,
    });

  } catch (err) {
    const ip = getClientIP(req.headers);
    const ua = req.headers.get('user-agent') || undefined;
    void track({
      type: 'questionnaire_submit_error',
      level: 'error',
      source: 'api.questionnaire-submit',
      ip,
      ua,
      props: { error: err instanceof Error ? err.message : 'Unknown error' },
    });

    return safeJson(
      { data: null, error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
