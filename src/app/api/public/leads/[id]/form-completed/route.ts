import { supabaseServer } from '@/lib/supabase-server';
import { safeJson } from '@/lib/http';
import { logError, track } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { maybeFirePatientConversion } from '@/lib/conversion';
import { LeadFormCompletedParams } from '@/contracts/leads';

export const runtime = 'nodejs';

function getIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const leadsIdx = parts.indexOf('leads');
    if (leadsIdx >= 0 && parts.length > leadsIdx + 1) {
      return decodeURIComponent(parts[leadsIdx + 1]);
    }
    return null;
  } catch {
    return null;
  }
}

function getClientIP(headers: Headers) {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xrip = headers.get('x-real-ip');
  if (xrip) return xrip.trim();
  return undefined;
}

export async function POST(req: Request) {
  const idRaw = getIdFromUrl(req.url);
  if (!idRaw) return safeJson({ data: null, error: 'Missing id' }, { status: 400 });

  const parsedParams = LeadFormCompletedParams.safeParse({ id: idRaw });
  if (!parsedParams.success) {
    return safeJson({ data: null, error: 'Invalid id' }, { status: 400 });
  }

  const id = parsedParams.data.id;

  try {
    const sessionIdHeader = req.headers.get('x-session-id') || undefined;
    type Person = { id: string; email?: string | null; type?: string | null; status?: string | null; metadata?: Record<string, unknown> | null; campaign_source?: string | null; campaign_variant?: string | null };
    let person: Person | null = null;
    let error: unknown = null;
    try {
      const res = await supabaseServer
        .from('people')
        .select('id,email,type,status,metadata,campaign_source,campaign_variant')
        .eq('id', id)
        .single<Person>();
      person = (res.data as Person) ?? null;
      error = res.error;
    } catch (e) {
      error = e;
    }

    if (error || !person) {
      return safeJson({ data: null, error: 'Not found' }, { status: 404 });
    }
    if ((person.type || '').toLowerCase() !== 'patient') {
      return safeJson({ data: null, error: 'Invalid lead type' }, { status: 400 });
    }

    const ip = getClientIP(req.headers);
    const ua = req.headers.get('user-agent') || undefined;
    // Derive a conservative campaign fallback from Referer (mirrors leads route semantics)
    let refCampaignSource: string | undefined;
    let refCampaignVariant: string | undefined;
    try {
      const ref = req.headers.get('referer') || '';
      const u = new URL(ref);
      const path = u.pathname || '';
      refCampaignSource = path.includes('/start')
        ? '/start'
        : path.includes('/ankommen-in-dir')
        ? '/ankommen-in-dir'
        : path.includes('/wieder-lebendig')
        ? '/wieder-lebendig'
        : path.includes('/fragebogen')
        ? '/fragebogen'
        : '/therapie-finden';
      const vParam = u.searchParams.get('variant') || u.searchParams.get('v') || undefined;
      refCampaignVariant = vParam || undefined;
    } catch {}

    const metadata: Record<string, unknown> = { ...(person.metadata || {}) };
    let backfillCs: string | undefined;
    let backfillCv: string | undefined;
    let backfillName: string | undefined;

    // Adopt fields from existing metadata if present (set at email submit)
    // Also stamp completion
    metadata.form_completed_at = new Date().toISOString();
    if (ip && !metadata.ip) metadata.ip = ip;
    if (ua && !metadata.user_agent) metadata.user_agent = ua;

    // If a form_session_id is linked, pull the latest data and persist a subset into metadata.
    // Robustness: if not linked, fall back to most recent form session by email (if present).
    let fsid = typeof metadata['form_session_id'] === 'string' ? (metadata['form_session_id'] as string) : undefined;
    let fsData: { data: Record<string, unknown>; email?: string | null; updated_at?: string | null; expires_at?: string | null } | null = null;
    try {
      if (fsid) {
        const { data: fs, error: fsErr } = await supabaseServer
          .from('form_sessions')
          .select('data,email,updated_at,expires_at')
          .eq('id', fsid)
          .single<{ data: Record<string, unknown>; email?: string | null; updated_at?: string | null; expires_at?: string | null }>();
        if (!fsErr && fs) {
          // In production, Supabase returns the row shape. In certain tests/mocks, 'data' may be wrapped differently.
          const maybe = fs as unknown as { data?: Record<string, unknown> } | Record<string, unknown>;
          if (maybe && typeof maybe === 'object' && 'data' in maybe && (maybe as { data?: Record<string, unknown> }).data) {
            const d2 = (maybe as { data: Record<string, unknown> }).data;
            fsData = { data: d2 };
          } else if (maybe && typeof maybe === 'object') {
            fsData = { data: maybe as Record<string, unknown> };
          }
        }
      }
      if (!fsData && person.email) {
        const { data: rows, error: byEmailErr } = await supabaseServer
          .from('form_sessions')
          .select('id,data,email,updated_at,expires_at')
          .eq('email', person.email)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (!byEmailErr && Array.isArray(rows) && rows[0]) {
          const candidate = rows[0] as { id: string; data: Record<string, unknown>; email?: string | null; updated_at?: string | null; expires_at?: string | null };
          // Respect expiration TTL
          const exp = candidate.expires_at ? Date.parse(candidate.expires_at) : NaN;
          if (!candidate.expires_at || !Number.isNaN(exp) && exp > Date.now()) {
            fsid = candidate.id;
            fsData = candidate;
          }
        }
      }
      if (fsData) {
        // Persist discovered form_session_id back onto the person for future merges
        if (!metadata['form_session_id'] && fsid) metadata['form_session_id'] = fsid;

        const d = fsData.data as Record<string, unknown>;
        // If campaign is missing on person, backfill from form-session attribution snapshot
        try {
          const attr = (d['_attr'] as Record<string, unknown> | undefined) || undefined;
          const cs = typeof d['campaign_source'] === 'string'
            ? (d['campaign_source'] as string)
            : (typeof attr?.['campaign_source'] === 'string' ? (attr['campaign_source'] as string) : undefined);
          const cv = typeof d['campaign_variant'] === 'string'
            ? (d['campaign_variant'] as string)
            : (typeof attr?.['campaign_variant'] === 'string' ? (attr['campaign_variant'] as string) : undefined);
          if (!person.campaign_source && cs) backfillCs = cs;
          if (!person.campaign_variant && cv) backfillCv = cv;
          try {
            const existingCs = (person.campaign_source || '').toLowerCase();
            if (existingCs === '/fragebogen') {
              if (cs === '/start') backfillCs = '/start';
              else if (!cs && refCampaignSource === '/start') backfillCs = '/start';
            }
          } catch {}
        } catch {}
        // Copy a stable subset to people.metadata, mirroring existing patterns and extending with Fragebogen fields
        // Existing possible keys: city, session_preference, gender_preference, budget, etc.
        const maybeString = (k: string) => (typeof d[k] === 'string' ? (d[k] as string).trim() : undefined);
        const maybeBool = (k: string) => (typeof d[k] === 'boolean' ? (d[k] as boolean) : undefined);
        const maybeArray = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]) : undefined);

        const cityVal = maybeString('city');
        const nameVal = maybeString('name');
        const personName = (person as unknown as { name?: string | null }).name;
        if (!personName && nameVal) backfillName = nameVal;
        if (cityVal) metadata.city = cityVal;
        const sessionPref = maybeString('session_preference');
        if (sessionPref) {
          const s = sessionPref.toLowerCase();
          if (s === 'online' || s.startsWith('online')) {
            metadata.session_preference = 'online';
          } else if (s === 'in_person' || s.includes('vor ort')) {
            metadata.session_preference = 'in_person';
          } else if (s.startsWith('beides') || s.includes('beides ist okay') || s === 'either') {
            // Both are acceptable → store as array and omit single preference
            (metadata as Record<string, unknown>).session_preferences = ['online', 'in_person'];
            if ('session_preference' in metadata) delete (metadata as Record<string, unknown>)['session_preference'];
          }
        }
        // If an explicit array is present, prefer it (defensive)
        const spArray = maybeArray('session_preferences');
        if (Array.isArray(spArray)) (metadata as Record<string, unknown>).session_preferences = spArray;

        const start_timing = maybeString('start_timing');
        if (start_timing) metadata.start_timing = start_timing;
        const kassentherapie = maybeString('kassentherapie');
        if (kassentherapie) metadata.kassentherapie = kassentherapie;
        const therapy_type = maybeString('therapy_type');
        if (therapy_type) metadata.therapy_type = therapy_type;
        const what_missing = maybeArray('what_missing');
        if (what_missing) metadata.what_missing = what_missing;
        const budget = maybeString('budget');
        if (budget) metadata.budget = budget;
        const privacy_preference = maybeString('privacy_preference');
        if (privacy_preference) metadata.privacy_preference = privacy_preference;

        // Gender mapping: Wizard may store human-friendly strings; preserve raw and map to legacy key if clear
        const gender = maybeString('gender');
        if (gender) {
          const g = gender.toLowerCase();
          if (g.includes('mann')) metadata.gender_preference = 'male';
          else if (g.includes('frau')) metadata.gender_preference = 'female';
          else if (g.includes('keine') || g.includes('keine präferenz')) metadata.gender_preference = 'no_preference';
        }

        const language = maybeString('language');
        if (language) metadata.language = language;
        const language_other = maybeString('language_other');
        if (language_other) metadata.language_other = language_other;
        const time_slots = maybeArray('time_slots');
        if (time_slots) metadata.time_slots = time_slots;
        const methods = maybeArray('methods');
        if (methods) {
          (metadata as Record<string, unknown>).specializations = methods;
        }
        const modality_matters = maybeBool('modality_matters');
        if (typeof modality_matters === 'boolean') metadata.modality_matters = modality_matters;
        const additional_info = maybeString('additional_info');
        if (additional_info && !(metadata as Record<string, unknown>).issue) {
          (metadata as Record<string, unknown>).issue = additional_info;
        }
      }
    } catch (e) {
      await logError('api.leads.form_completed', e, { stage: 'load_form_session', id, fsid });
    }

    const updatePayload: Record<string, unknown> = { metadata };
    if (backfillName) updatePayload['name'] = backfillName;
    const proposedSource = backfillCs || refCampaignSource;
    const proposedVariant = backfillCv || refCampaignVariant;
    const currentSource = (person.campaign_source || '').toLowerCase();
    if (proposedSource && (!currentSource || (currentSource === '/fragebogen' && proposedSource !== '/fragebogen'))) {
      updatePayload['campaign_source'] = proposedSource;
    }
    if (!person.campaign_variant && proposedVariant) {
      updatePayload['campaign_variant'] = proposedVariant;
    }

    const { error: upErr } = await supabaseServer
      .from('people')
      .update(updatePayload)
      .eq('id', id);
    if (upErr) {
      await logError('api.leads.form_completed', upErr, { stage: 'update_metadata', id });
      return safeJson({ data: null, error: 'Failed to update' }, { status: 500 });
    }

    // Track server analytics: form_completed (legacy) and fragebogen_completed (new canonical name)
    // CRITICAL: Use fsid variable which may have been backfilled from email lookup,
    // not just metadata['form_session_id'] which might be missing
    try {
      const commonProps = {
        id,
        ...(fsid ? { form_session_id: fsid } : {}),
      };
      await ServerAnalytics.trackEventFromRequest(req, {
        type: 'form_completed',
        source: 'api.leads.form_completed',
        session_id: sessionIdHeader,
        props: commonProps,
      });
      await ServerAnalytics.trackEventFromRequest(req, {
        type: 'fragebogen_completed',
        source: 'api.leads.form_completed',
        session_id: sessionIdHeader,
        props: commonProps,
      });
    } catch {}

    // Server-side Enhanced Conversions (EARTH-204)
    // Only fire when the lead is already verified/actionable
    // (status is 'email_confirmed' or 'new'). Deduplication handled by maybeFirePatientConversion.
    try {
      const status = (person.status || '').toLowerCase();
      if (status === 'email_confirmed' || status === 'new') {
        const ip = getClientIP(req.headers);
        const ua = req.headers.get('user-agent') || undefined;
        await maybeFirePatientConversion({
          patient_id: id,
          email: person.email || undefined,
          verification_method: 'email', // form completion implies email flow (legacy)
          ip,
          ua,
        });
      }
    } catch (e) {
      await logError('api.leads.form_completed', e, { stage: 'google_ads_conversion', id });
    }

    // Internal log for ops
    void track({ 
      type: 'form_completed', 
      level: 'info', 
      source: 'api.leads', 
      props: { lead_id: id, ...(fsid ? { form_session_id: fsid } : {}) } 
    });
    void track({ 
      type: 'fragebogen_completed', 
      level: 'info', 
      source: 'api.leads', 
      props: { lead_id: id, ...(fsid ? { form_session_id: fsid } : {}) } 
    });

    return safeJson({ data: { ok: true }, error: null });
  } catch (e) {
    await logError('api.leads.form_completed', e, { stage: 'unhandled' });
    return safeJson({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
