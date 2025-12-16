// NextResponse retained for type compatibility
import { supabaseServer } from '@/lib/supabase-server';
import { ServerAnalytics, parseAttributionFromRequest, parseCampaignFromRequest } from '@/lib/server-analytics';
import { isIpRateLimited } from '@/features/leads/lib/rateLimit';
import { track } from '@/lib/logger';
import { safeJson } from '@/lib/http';
import { createInstantMatchesForPatient } from '@/features/leads/lib/match';
import { QuestionnaireSubmitInput } from '@/contracts/leads';
import { parseRequestBody } from '@/lib/api-utils';
import { isTestRequest } from '@/lib/test-mode';

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

function normalizeSessionPreferences(
  v: string | undefined,
): { session_preference?: 'online' | 'in_person'; session_preferences?: ('online' | 'in_person')[] } {
  if (!v) return {};
  if (v === 'online' || v === 'in_person') return { session_preference: v };
  if (v === 'either' || v === 'both') return { session_preferences: ['online', 'in_person'] };
  return {};
}

export const runtime = 'nodejs';

/**
 * POST /api/public/questionnaire-submit
 * 
 * Creates an anonymous patient record with preferences from Steps 1-5
 * Returns match URL for immediate browsing (no contact info required)
 */
export async function POST(req: Request) {
  try {
    const parsed = await parseRequestBody(req, QuestionnaireSubmitInput);
    if (!parsed.success) return parsed.response;
    const body = parsed.data;

    const isKhTest = (() => {
      try {
        const cookie = req.headers.get('cookie') || '';
        return cookie.split(';').some((p) => {
          const [k, v] = p.trim().split('=');
          return k === 'kh_test' && v === '1';
        });
      } catch {
        return false;
      }
    })();

    const isTest = isKhTest || isTestRequest(req);

    // Extract questionnaire data (Steps 1-5 only)
    const {
      start_timing,
      additional_info,
      modality_matters,
      methods,
      schwerpunkte,
      city,
      session_preference,
      gender,
      time_slots,
      form_session_id,
    } = body;

    // Rate limiting
    const ip = getClientIP(req.headers);
    const ua = req.headers.get('user-agent') || undefined;
    if (ip && !isTest) {
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

    // Parse attribution from referer URL
    const campaign = parseCampaignFromRequest(req);
    const landing_page = campaign.landing_page;
    
    // Header overrides from client (SignupWizard stores original landing page attribution)
    const csOverride = req.headers.get('x-campaign-source-override') || undefined;
    const cvOverride = req.headers.get('x-campaign-variant-override') || undefined;
    
    // Priority: header override > referer URL param > fallback
    const campaign_source: string | undefined = csOverride || campaign.campaign_source || '/fragebogen';
    const campaign_variant: string | undefined = cvOverride || campaign.campaign_variant || (campaign_source === '/fragebogen' ? 'direct' : undefined);

    // Prepare metadata with all preferences
    // Normalize gender from German UI labels to English values for matching
    const normalizedGender = normalizeGenderPreference(gender);
    const normalizedSession = normalizeSessionPreferences(session_preference);
    const metadata: Record<string, unknown> = {
      form_session_id,
      start_timing,
      additional_info,
      modality_matters,
      methods: methods || [],
      schwerpunkte: schwerpunkte || [],
      city,
      ...(normalizedSession.session_preference ? { session_preference: normalizedSession.session_preference } : {}),
      ...(normalizedSession.session_preferences ? { session_preferences: normalizedSession.session_preferences } : {}),
      gender_preference: normalizedGender,
      time_slots: time_slots || [],
      ...(isTest ? { is_test: true } : {}),
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

    // Deduplicate by form_session_id: if a patient already exists for this session,
    // update it instead of creating a duplicate. This handles page refreshes, back navigation,
    // and race conditions that could cause multiple submissions.
    // NOTE: Check ALL patient statuses, not just 'anonymous' - users may have progressed
    // to 'pre_confirmation' or 'new' and then navigated back.
    let patient: { id: string } | null = null;
    let isExisting = false;

    if (form_session_id) {
      // Check for existing patient with this form_session_id (any status)
      const { data: existing } = await supabaseServer
        .from('people')
        .select('id, metadata, status')
        .eq('type', 'patient')
        .contains('metadata', { form_session_id })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; metadata?: Record<string, unknown> | null; status?: string }>();

      if (existing?.id) {
        // Update existing patient with latest preferences
        const existingMeta = (existing.metadata || {}) as Record<string, unknown>;
        const mergedMeta = { ...existingMeta, ...metadata };
        
        const { error: updateError } = await supabaseServer
          .from('people')
          .update({
            metadata: mergedMeta,
            ...(campaign_source ? { campaign_source } : {}),
            ...(campaign_variant ? { campaign_variant } : {}),
          })
          .eq('id', existing.id);

        if (!updateError) {
          patient = { id: existing.id };
          isExisting = true;
          void track({
            type: 'anonymous_patient_updated',
            level: 'info',
            source: 'api.questionnaire-submit',
            ip,
            ua,
            props: { patient_id: existing.id, form_session_id },
          });
        }
      }
    }

    // Create new patient if no existing one was found/updated
    if (!patient) {
      const { data: newPatient, error: insertError } = await supabaseServer
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

      if (insertError || !newPatient?.id) {
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
      patient = newPatient;
    }

    // Track anonymous patient creation/update
    if (!isExisting) {
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
    }

    // For existing patients, check if they already have matches
    let matchResult: { matchesUrl: string; matchQuality: 'exact' | 'partial' | 'none' } | null = null;
    
    if (isExisting) {
      // Check for existing matches with secure_uuid
      const { data: existingMatch } = await supabaseServer
        .from('matches')
        .select('secure_uuid')
        .eq('patient_id', patient.id)
        .not('secure_uuid', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ secure_uuid: string | null }>();
      
      if (existingMatch?.secure_uuid) {
        matchResult = {
          matchesUrl: `/matches/${encodeURIComponent(existingMatch.secure_uuid)}`,
          matchQuality: 'exact', // Assume existing match quality
        };
        void track({
          type: 'existing_match_returned',
          level: 'info',
          source: 'api.questionnaire-submit',
          ip,
          ua,
          props: { patient_id: patient.id, form_session_id },
        });
      }
    }

    // Create instant matches only if no existing matches found
    if (!matchResult) {
      matchResult = await createInstantMatchesForPatient(patient.id, campaign_variant);

      if (matchResult) {
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'instant_match_created',
          source: 'api.questionnaire-submit',
          props: {
            match_quality: matchResult.matchQuality,
            patient_id: patient.id,
            is_resubmission: isExisting,
          },
        });
      }
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
