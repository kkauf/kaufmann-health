import { supabaseServer } from '@/lib/supabase-server';
import { safeJson } from '@/lib/http';
import { logError, track } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { maybeFirePatientConversion } from '@/lib/conversion';

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
  const id = getIdFromUrl(req.url);
  if (!id) return safeJson({ data: null, error: 'Missing id' }, { status: 400 });

  try {
    type Person = { id: string; email?: string | null; type?: string | null; status?: string | null; metadata?: Record<string, unknown> | null };
    const { data: person, error } = await supabaseServer
      .from('people')
      .select('id,email,type,status,metadata')
      .eq('id', id)
      .single<Person>();

    if (error || !person) {
      return safeJson({ data: null, error: 'Not found' }, { status: 404 });
    }
    if ((person.type || '').toLowerCase() !== 'patient') {
      return safeJson({ data: null, error: 'Invalid lead type' }, { status: 400 });
    }

    const ip = getClientIP(req.headers);
    const ua = req.headers.get('user-agent') || undefined;

    const metadata: Record<string, unknown> = { ...(person.metadata || {}) };

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
        // Copy a stable subset to people.metadata, mirroring existing patterns and extending with Fragebogen fields
        // Existing possible keys: city, session_preference, gender_preference, budget, etc.
        const maybeString = (k: string) => (typeof d[k] === 'string' ? (d[k] as string).trim() : undefined);
        const maybeBool = (k: string) => (typeof d[k] === 'boolean' ? (d[k] as boolean) : undefined);
        const maybeArray = (k: string) => (Array.isArray(d[k]) ? (d[k] as unknown[]) : undefined);

        const cityVal = maybeString('city');
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
            (metadata as Record<string, unknown>).online_ok = true;
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
        const online_ok = maybeBool('online_ok');
        if (typeof online_ok === 'boolean') metadata.online_ok = online_ok;
        const budget = maybeString('budget');
        if (budget) metadata.budget = budget;
        const privacy_preference = maybeString('privacy_preference');
        if (privacy_preference) metadata.privacy_preference = privacy_preference;

        // Gender mapping: Wizard may store human-friendly strings; preserve raw and map to legacy key if clear
        const gender = maybeString('gender');
        if (gender) {
          metadata.gender = gender;
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
        if (methods) metadata.methods = methods;
        const modality_matters = maybeBool('modality_matters');
        if (typeof modality_matters === 'boolean') metadata.modality_matters = modality_matters;
        const additional_info = maybeString('additional_info');
        if (additional_info) metadata.additional_info = additional_info;
      }
    } catch (e) {
      await logError('api.leads.form_completed', e, { stage: 'load_form_session', id, fsid });
    }

    // Persist metadata only (activation handled on confirmation depending on VERIFICATION_MODE)
    const { error: upErr } = await supabaseServer
      .from('people')
      .update({ metadata })
      .eq('id', id);
    if (upErr) {
      await logError('api.leads.form_completed', upErr, { stage: 'update_metadata', id });
      return safeJson({ data: null, error: 'Failed to update' }, { status: 500 });
    }

    // Track server analytics: form_completed
    try {
      await ServerAnalytics.trackEventFromRequest(req, {
        type: 'form_completed',
        source: 'api.leads.form_completed',
        props: { id },
      });
    } catch {}

    // Server-side Enhanced Conversions (EARTH-204)
    // Note: Conversion will only fire if contact is verified (email OR SMS)
    // Deduplication handled by maybeFirePatientConversion
    try {
      const ip = getClientIP(req.headers);
      const ua = req.headers.get('user-agent') || undefined;
      await maybeFirePatientConversion({
        patient_id: id,
        email: person.email || undefined,
        verification_method: 'email', // form completion implies email flow (legacy)
        ip,
        ua,
      });
    } catch (e) {
      await logError('api.leads.form_completed', e, { stage: 'google_ads_conversion', id });
    }

    // Internal log for ops
    void track({ type: 'form_completed', level: 'info', source: 'api.leads', props: { lead_id: id } });

    return safeJson({ data: { ok: true }, error: null });
  } catch (e) {
    await logError('api.leads.form_completed', e, { stage: 'unhandled' });
    return safeJson({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
