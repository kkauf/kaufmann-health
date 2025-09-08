import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { createHash } from 'crypto';
import { TERMS_VERSION } from '@/content/therapist-terms';
import { ACTIVE_CITIES } from '@/lib/constants';
import { sendEmail } from '@/lib/email/client';
import { buildInternalLeadNotification } from '@/lib/email/internalNotification';
import { renderTherapistWelcome } from '@/lib/email/templates/therapistWelcome';
import { renderPatientConfirmation } from '@/lib/email/templates/patientConfirmation';
import { logError, track } from '@/lib/logger';
import { googleAdsTracker } from '@/lib/google-ads';
import { parseAttributionFromRequest } from '@/lib/server-analytics';

export const runtime = 'nodejs';

/**
 * @endpoint POST /api/leads
 * @description Form handler for incoming lead submissions. Returns { data, error }.
 */

type LeadPayload = {
  name?: string;
  email: string;
  phone?: string;
  notes?: string;
  city?: string;
  issue?: string;
  availability?: string;
  budget?: string;
  specializations?: string[];
  session_preference?: 'online' | 'in_person';
  session_preferences?: ('online' | 'in_person')[];
  // New (EARTH-19): therapist applications
  type?: 'patient' | 'therapist';
  qualification?: string; // e.g., Heilpraktiker f. Psychotherapie, Approbation
  experience?: string; // free text (e.g., '2-4 Jahre')
  website?: string;
  terms_version?: string;
  // GDPR consent for sharing patient data with therapists
  consent_share_with_therapists?: boolean;
  privacy_version?: string;
  // Optional client attribution (no cookies). Only used for event props, not stored in DB.
  session_id?: string;
};

function sanitize(v?: string) {
  if (!v) return undefined;
  return v.toString().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 1000);
}

// Provide a helpful GET handler to diagnose accidental wrong-method calls (e.g., prefetch)
export async function GET(req: Request) {
  try {
    const ip = getClientIP(req.headers);
    const ua = req.headers.get('user-agent') || undefined;
    const path = (() => {
      try {
        return new URL(req.url).pathname;
      } catch {
        return '/api/leads';
      }
    })();
    void track({
      type: 'leads_wrong_method',
      level: 'warn',
      source: 'api.leads',
      ip,
      ua,
      props: { method: 'GET', path },
    });
  } catch {}
  return NextResponse.json(
    { data: null, error: 'Use POST' },
    { status: 405, headers: { 'Cache-Control': 'no-store' } },
  );
}

// Allowed specializations (slugs)
const ALLOWED_SPECIALIZATIONS = [
  'narm',
  'core-energetics',
  'hakomi',
  'somatic-experiencing',
] as const;

// File validation configuration
const ALLOWED_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

function getClientIP(headers: Headers) {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xrip = headers.get('x-real-ip');
  if (xrip) return xrip.trim();
  return undefined;
}

// Internal notification type moved to email lib; inline type removed

function hashIP(ip: string) {
  try {
    const salt = process.env.IP_HASH_SALT || '';
    return createHash('sha256').update(`${salt}${ip}`).digest('hex');
  } catch {
    // Fallback: return raw IP if hashing fails (should not happen in Node runtime)
    return ip;
  }
}

// Inline email functions removed in favor of shared email library

// EARTH-70 helpers
function getSpecializationDocFieldName(slug: string): string {
  return `specialization_cert_${slug}`;
}

function getFileExtension(fileName: string, contentType: string): string {
  // Prefer content-type mapping; fallback to filename
  if (contentType === 'application/pdf') return '.pdf';
  if (contentType === 'image/jpeg') return '.jpg';
  if (contentType === 'image/png') return '.png';
  const m = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return m ? `.${m[1].toLowerCase()}` : '';
}

async function fileToBuffer(file: File): Promise<Buffer> {
  const ab = await file.arrayBuffer();
  return Buffer.from(ab);
}

function isValidUpload(file: File): { ok: true } | { ok: false; reason: string } {
  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return { ok: false, reason: 'Unsupported file type' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'File too large' };
  }
  return { ok: true };
}

async function handleTherapistMultipart(req: Request) {
  // Accept multipart/form-data for therapist uploads
  const form = await req.formData();
  const ip = getClientIP(req.headers);
  const ua = req.headers.get('user-agent') || undefined;

  const type = (form.get('type')?.toString() || 'therapist') as 'therapist' | 'patient';
  if (type !== 'therapist') {
    return NextResponse.json(
      { data: null, error: 'Invalid multipart payload' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const emailRaw = form.get('email')?.toString();
  const email = sanitize(emailRaw)?.toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { data: null, error: 'Invalid email' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const data: LeadPayload = {
    type: 'therapist',
    name: sanitize(form.get('name')?.toString()),
    email,
    phone: sanitize(form.get('phone')?.toString()),
    notes: sanitize(form.get('notes')?.toString()),
  };

  const city = sanitize(form.get('city')?.toString());
  const sessionPreferences = (form.getAll('session_preference') || [])
    .map((v) => sanitize(String(v))?.toLowerCase())
    .filter((s): s is 'online' | 'in_person' => s === 'online' || s === 'in_person');
  const specializations = (form.getAll('specializations') || [])
    .map((v) => sanitize(String(v))?.toLowerCase())
    .filter((s): s is (typeof ALLOWED_SPECIALIZATIONS)[number] => !!s && (ALLOWED_SPECIALIZATIONS as readonly string[]).includes(s));

  // Rate limiting (same as JSON path)
  if (ip) {
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: recentByIp, error: ipErr } = await supabaseServer
      .from('people')
      .select('id, created_at')
      .contains('metadata', { ip })
      .gte('created_at', cutoff)
      .limit(1);
    if (!ipErr && recentByIp && recentByIp.length > 0) {
      const attr = parseAttributionFromRequest(req);
      void track({
        type: 'lead_rate_limited',
        level: 'warn',
        source: 'api.leads',
        ip,
        ua,
        props: {
          city,
          ...(attr.referrer ? { referrer: attr.referrer } : {}),
          ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
          ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
          ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
        },
      });
      return NextResponse.json(
        { data: null, error: 'Rate limited' },
        { status: 429, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  // Insert therapist row
  const fullName = (data.name || '').trim();
  const first_name = fullName ? fullName.split(/\s+/)[0] : null;
  const last_name = fullName ? fullName.replace(/^\S+\s*/, '').trim() || null : null;
  const modalities = specializations;
  const { data: ins, error: err } = await supabaseServer
    .from('therapists')
    .insert({
      first_name,
      last_name,
      email: data.email,
      phone: data.phone,
      city: city || null,
      session_preferences: sessionPreferences,
      modalities,
      status: 'pending_verification',
    })
    .select('id')
    .single();

  if (err || !ins?.id) {
    console.error('Supabase error:', err);
    void logError('api.leads', err, { stage: 'insert_lead', lead_type: 'therapist', city }, ip, ua);
    return NextResponse.json(
      { data: null, error: 'Failed to save lead' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const therapistId = (ins as unknown as { id: string }).id;

  // Validate and collect required files
  const missing: string[] = [];
  // Accept any ONE license document (approbation or either Heilpraktiker variants)
  const licenseCandidates = [
    'license',
    'license_approbation',
    'license_heilpraktiker_psychotherapie',
    'license_grosser_heilpraktiker',
    // Backwards compatibility
    'heilpraktiker_license',
  ];
  let licenseFile: File | null = null;
  for (const key of licenseCandidates) {
    const v = form.get(key);
    if (v instanceof File && v.size > 0) {
      licenseFile = v;
      break;
    }
  }
  if (!licenseFile) {
    missing.push('license');
  }

  // One-or-more documents per selected specialization
  const specializationFiles: Record<string, File[]> = {};
  for (const slug of specializations) {
    const field = getSpecializationDocFieldName(slug);
    const all = form.getAll(field).filter((x): x is File => x instanceof File && x.size > 0);
    if (all.length === 0) {
      missing.push(field);
    } else {
      specializationFiles[slug] = all;
    }
  }

  if (missing.length > 0) {
    return NextResponse.json(
      { data: null, error: `Missing required documents: ${missing.join(', ')}` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Upload files
  const bucket = 'therapist-documents';
  const documents: { license?: string; specialization?: Record<string, string[]> } = { specialization: {} };

  if (licenseFile) {
    const valid = isValidUpload(licenseFile);
    if (!valid.ok) {
      return NextResponse.json(
        { data: null, error: `license: ${valid.reason}` },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const ext = getFileExtension(licenseFile.name || '', licenseFile.type);
    const path = `therapists/${therapistId}/license-${Date.now()}${ext}`;
    const buffer = await fileToBuffer(licenseFile);
    const { error: upErr } = await supabaseServer.storage
      .from(bucket)
      .upload(path, buffer, { contentType: licenseFile.type, upsert: false });
    if (upErr) {
      console.error('Upload failed:', upErr);
      void logError('api.leads', upErr, { stage: 'upload_document', key: 'license', therapist_id: therapistId }, ip, ua);
      return NextResponse.json(
        { data: null, error: 'Failed to upload document' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    documents.license = path;
  }

  for (const [slug, files] of Object.entries(specializationFiles)) {
    const paths: string[] = [];
    for (const file of files) {
      const valid = isValidUpload(file);
      if (!valid.ok) {
        return NextResponse.json(
          { data: null, error: `${slug}: ${valid.reason}` },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const ext = getFileExtension(file.name || '', file.type);
      const path = `therapists/${therapistId}/specialization-${slug}-${Date.now()}${ext}`;
      const buffer = await fileToBuffer(file);
      const { error: upErr } = await supabaseServer.storage
        .from(bucket)
        .upload(path, buffer, { contentType: file.type, upsert: false });
      if (upErr) {
        console.error('Upload failed:', upErr);
        void logError('api.leads', upErr, { stage: 'upload_document', key: `specialization_${slug}`, therapist_id: therapistId }, ip, ua);
        return NextResponse.json(
          { data: null, error: 'Failed to upload document' },
          { status: 500, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      paths.push(path);
    }
    documents.specialization![slug] = paths;
  }

  // Persist document paths into therapists.metadata.documents
  const { error: metaErr } = await supabaseServer
    .from('therapists')
    .update({ metadata: { documents } })
    .eq('id', therapistId);
  if (metaErr) {
    console.error('Metadata update failed:', metaErr);
    void logError('api.leads', metaErr, { stage: 'update_metadata', therapist_id: therapistId }, ip, ua);
  }

  // Record contract (best-effort) and send welcome email
  try {
    const { error: contractErr } = await supabaseServer
      .from('therapist_contracts')
      .insert({
        therapist_id: therapistId,
        contract_version: TERMS_VERSION,
        ip_address: ip ? hashIP(ip) : null,
        user_agent: ua,
      });
    if (contractErr) {
      console.error('Supabase contract insert error:', contractErr);
      void logError('api.leads', contractErr, { stage: 'insert_contract', id: therapistId }, ip, ua);
    }
    const isActiveCity = ACTIVE_CITIES.has((city || '').toLowerCase());
    const welcome = renderTherapistWelcome({ name: data.name, city, isActiveCity, termsVersion: TERMS_VERSION });
    void track({
      type: 'email_attempted',
      level: 'info',
      source: 'api.leads',
      ip,
      ua,
      props: { stage: 'therapist_welcome', lead_id: therapistId, lead_type: 'therapist', subject: welcome.subject },
    });
    await sendEmail({
      to: data.email,
      subject: welcome.subject,
      html: welcome.html,
      context: { stage: 'therapist_welcome', lead_id: therapistId, lead_type: 'therapist' },
    });
  } catch (e) {
    console.error('[welcome-email] Failed to render/send therapist welcome', e);
    void logError('api.leads', e, { stage: 'welcome_email' }, ip, ua);
  }

  // Google Ads conversion (Enhanced Conversions)
  try {
    const conversionActionAlias = 'therapist_registration';
    const value = 25;
    void track({
      type: 'google_ads_attempted',
      level: 'info',
      source: 'api.leads',
      ip,
      ua,
      props: { action: conversionActionAlias, order_id: therapistId, lead_type: 'therapist', value },
    });
    const gaPromise = googleAdsTracker.trackConversion({
      email: data.email,
      conversionAction: conversionActionAlias,
      conversionValue: value,
      orderId: therapistId,
    });
    let gaDone = false;
    gaPromise.then(
      () => {
        gaDone = true;
      },
      async (err) => {
        gaDone = true;
        void logError('api.leads', err, { stage: 'google_ads_conversion' }, ip, ua);
      },
    );
    const waitMs = Number(process.env.GOOGLE_ADS_WAIT_MS ?? (process.env.NODE_ENV === 'development' ? 500 : 0));
    if (waitMs > 0) {
      await new Promise((r) => setTimeout(r, waitMs));
      if (!gaDone) {
        void track({
          type: 'google_ads_deferred',
          level: 'info',
          source: 'api.leads',
          ip,
          ua,
          props: { action: conversionActionAlias, order_id: therapistId, lead_type: 'therapist', value, timeout_ms: waitMs },
        });
      }
    }
  } catch (e) {
    void logError('api.leads', e, { stage: 'google_ads_conversion', lead_type: 'therapist' }, ip, ua);
  }

  // Internal notification (PII-free)
  try {
    const to = process.env.LEADS_NOTIFY_EMAIL;
    if (to) {
      const notif = buildInternalLeadNotification({ id: therapistId, metadata: { lead_type: 'therapist', city: city ?? null } });
      void track({
        type: 'email_attempted',
        level: 'info',
        source: 'api.leads',
        ip,
        ua,
        props: { stage: 'internal_notification', lead_id: therapistId, lead_type: 'therapist', subject: notif.subject },
      });
      void sendEmail({ to, subject: notif.subject, text: notif.text, context: { stage: 'internal_notification', lead_id: therapistId, lead_type: 'therapist' } }).catch(() => {});
    } else {
      void track({ type: 'notify_skipped', level: 'warn', source: 'api.leads', ip, ua, props: { reason: 'missing_recipient', lead_id: therapistId, lead_type: 'therapist' } });
    }
  } catch (e) {
    console.error('[notify] Failed to build/send notification', e);
    void logError('api.leads', e, { stage: 'notify' }, ip, ua);
  }

  // Track successful submission
  const attr = parseAttributionFromRequest(req);
  void track({
    type: 'lead_submitted',
    level: 'info',
    source: 'api.leads',
    ip,
    ua,
    props: {
      id: therapistId,
      lead_type: 'therapist',
      city: city || null,
      has_specializations: specializations.length > 0,
      ...(attr.referrer ? { referrer: attr.referrer } : {}),
      ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
      ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
      ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
    },
  });

  return NextResponse.json(
    { data: { id: therapistId }, error: null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      return await handleTherapistMultipart(req);
    }
    const payload = (await req.json()) as Partial<LeadPayload>;
    const email = sanitize(payload.email)?.toLowerCase();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json(
        { data: null, error: 'Invalid email' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const data: LeadPayload = {
      name: sanitize(payload.name),
      email,
      phone: sanitize(payload.phone),
      notes: sanitize(payload.notes),
    };

    // Optional additional fields captured as metadata
    const city = sanitize(payload.city);
    const issue = sanitize(payload.issue);
    const availability = sanitize(payload.availability);
    const budget = sanitize(payload.budget);
    const sessionPreferenceRaw = sanitize(payload.session_preference as string | undefined);
    const sessionPreference: 'online' | 'in_person' | undefined =
      sessionPreferenceRaw === 'online' || sessionPreferenceRaw === 'in_person' ? sessionPreferenceRaw : undefined;
    const sessionPreferencesRaw = Array.isArray(payload.session_preferences) ? payload.session_preferences : [];
    const sessionPreferences = sessionPreferencesRaw
      .map((s) => sanitize(String(s))?.toLowerCase())
      .filter((s): s is 'online' | 'in_person' => s === 'online' || s === 'in_person');
    const qualification = sanitize(payload.qualification);
    const experience = sanitize(payload.experience);
    const website = sanitize(payload.website);
    const leadType: 'patient' | 'therapist' = payload.type === 'therapist' ? 'therapist' : 'patient';
    const session_id = sanitize(payload.session_id);
    // Consent flags (patient only)
    const consentShare = Boolean(payload.consent_share_with_therapists);
    const privacyVersion = sanitize(payload.privacy_version);
    const specializations = Array.isArray(payload.specializations)
      ? payload.specializations
          .map((s) =>
            sanitize(s)
              ?.toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '')
          )
          .filter((s): s is string => !!s && (ALLOWED_SPECIALIZATIONS as readonly string[]).includes(s))
      : [];

    // Consent validation handled later with comprehensive tracking

    // Basic IP-based rate limiting (60s window). Note: best-effort and
    // dependent on upstream "x-forwarded-for" headers.
    const ip = getClientIP(req.headers);
    const ua = req.headers.get('user-agent') || undefined;
    if (ip) {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data: recentByIp, error: ipErr } = await supabaseServer
        .from('people')
        .select('id, created_at')
        .contains('metadata', { ip })
        .gte('created_at', cutoff)
        .limit(1);
      if (!ipErr && recentByIp && recentByIp.length > 0) {
        const attr = parseAttributionFromRequest(req);
        void track({
          type: 'lead_rate_limited',
          level: 'warn',
          source: 'api.leads',
          ip,
          ua,
          props: {
            city,
            ...(session_id ? { session_id } : {}),
            ...(attr.referrer ? { referrer: attr.referrer } : {}),
            ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
            ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
            ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
          },
        });
        return NextResponse.json(
          { data: null, error: 'Rate limited' },
          { status: 429, headers: { 'Cache-Control': 'no-store' } },
        );
      }
    }

    // Enforce explicit consent for patient leads (GDPR Art. 6(1)(a), 9(2)(a))
    if (leadType === 'patient' && !consentShare) {
      return NextResponse.json(
        { data: null, error: 'Einwilligung zur Datenübertragung erforderlich' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    let inserted: { id: string } | null = null;
    let error: unknown = null;
    if (leadType === 'therapist') {
      // Split full name into first/last for therapists table
      const fullName = (data.name || '').trim();
      const first_name = fullName ? fullName.split(/\s+/)[0] : null;
      const last_name = fullName ? fullName.replace(/^\S+\s*/, '').trim() || null : null;
      const modalities = specializations; // normalized above
      const { data: ins, error: err } = await supabaseServer
        .from('therapists')
        .insert({
          first_name,
          last_name,
          email: data.email,
          phone: data.phone,
          city: city || null,
          session_preferences: sessionPreferences,
          modalities,
          status: 'pending_verification',
        })
        .select('id')
        .single();
      inserted = (ins as unknown as { id: string }) || null;
      error = err;
    } else {
      const res = await supabaseServer
        .from('people')
        .insert({
          name: data.name,
          email: data.email,
          phone: data.phone,
          type: 'patient',
          status: 'new',
          metadata: {
            ...(data.notes ? { notes: data.notes } : {}),
            ...(city ? { city } : {}),
            ...(issue ? { issue } : {}),
            ...(availability ? { availability } : {}),
            ...(budget ? { budget } : {}),
            ...(sessionPreference ? { session_preference: sessionPreference } : {}),
            ...(sessionPreferences.length ? { session_preferences: sessionPreferences } : {}),
            ...(specializations.length ? { specializations } : {}),
            ...(ip ? { ip } : {}),
            ...(ua ? { user_agent: ua } : {}),
            ...(leadType === 'patient' && consentShare
              ? {
                  consent_share_with_therapists: true,
                  consent_share_with_therapists_at: new Date().toISOString(),
                  ...(privacyVersion ? { consent_privacy_version: privacyVersion } : {}),
                }
              : {}),
            funnel_type: 'koerperpsychotherapie',
            submitted_at: new Date().toISOString(),
          },
        })
        .select('id')
        .single();
      inserted = (res.data as unknown as { id: string }) || null;
      error = res.error;
    }

    if (error) {
      console.error('Supabase error:', error);
      void logError('api.leads', error, { stage: 'insert_lead', lead_type: leadType, city }, ip, ua);
      return NextResponse.json(
        { data: null, error: 'Failed to save lead' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // For therapist submissions, record immediate contract acceptance (best-effort)
    if (leadType === 'therapist' && inserted?.id) {
      const { error: contractErr } = await supabaseServer
        .from('therapist_contracts')
        .insert({
          therapist_id: inserted.id,
          contract_version: TERMS_VERSION,
          ip_address: ip ? hashIP(ip) : null,
          user_agent: ua,
        });
      if (contractErr) {
        console.error('Supabase contract insert error:', contractErr);
        void logError('api.leads', contractErr, { stage: 'insert_contract', id: inserted.id }, ip, ua);
      }
      // Fire-and-forget welcome email to therapist (shared template)
      try {
        const isActiveCity = ACTIVE_CITIES.has((city || '').toLowerCase());
        const welcome = renderTherapistWelcome({
          name: data.name,
          city,
          isActiveCity,
          termsVersion: TERMS_VERSION,
        });
        // Audit: attempted send
        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'api.leads',
          ip,
          ua,
          props: {
            stage: 'therapist_welcome',
            lead_id: inserted.id,
            lead_type: leadType,
            subject: welcome.subject,
            ...(session_id ? { session_id } : {}),
          },
        });
        await sendEmail({
          to: data.email,
          subject: welcome.subject,
          html: welcome.html,
          context: { stage: 'therapist_welcome', lead_id: inserted.id, lead_type: leadType, ...(session_id ? { session_id } : {}) },
        });
      } catch (e) {
        console.error('[welcome-email] Failed to render/send therapist welcome', e);
        void logError('api.leads', e, { stage: 'welcome_email' }, ip, ua);
      }
    }

    // For patient submissions, send confirmation email (best-effort, fire-and-forget)
    if (leadType === 'patient' && inserted?.id) {
      try {
        const confirmation = renderPatientConfirmation({
          name: data.name,
          city,
          issue,
          sessionPreference: sessionPreference ?? null,
        });
        // Audit: attempted send
        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'api.leads',
          ip,
          ua,
          props: {
            stage: 'patient_confirmation',
            lead_id: inserted.id,
            lead_type: leadType,
            subject: confirmation.subject,
            ...(session_id ? { session_id } : {}),
          },
        });
        await sendEmail({
          to: data.email,
          subject: confirmation.subject,
          html: confirmation.html,
          context: { stage: 'patient_confirmation', lead_id: inserted.id, lead_type: leadType, ...(session_id ? { session_id } : {}) },
        });
      } catch (e) {
        console.error('[patient-confirmation-email] Failed to render/send patient confirmation', e);
        void logError('api.leads', e, { stage: 'patient_confirmation_email' }, ip, ua);
      }
    }

    // Fire-and-forget Google Ads conversion tracking (Enhanced Conversions)
    try {
      if (inserted?.id) {
        const conversionActionAlias = leadType === 'therapist' ? 'therapist_registration' : 'patient_registration';
        const value = leadType === 'therapist' ? 25 : 10; // EUR
        // Only hashed email is sent to Google; wrapper no-ops if not configured
        // Audit attempt
        void track({
          type: 'google_ads_attempted',
          level: 'info',
          source: 'api.leads',
          ip,
          ua,
          props: {
            action: conversionActionAlias,
            order_id: inserted.id,
            lead_type: leadType,
            value,
            ...(session_id ? { session_id } : {}),
          },
        });
        // Allow a short wait so success/failure events from google-ads tracker can flush.
        const gaPromise = googleAdsTracker.trackConversion({
          email: data.email,
          conversionAction: conversionActionAlias,
          conversionValue: value,
          orderId: inserted.id,
        });

        // Wait up to GOOGLE_ADS_WAIT_MS (default: 500 in dev, 0 in prod);
        // if not finished, mark as deferred so we know to look for follow-ups.
        let gaDone = false;
        gaPromise.then(
          () => {
            gaDone = true;
          },
          async (err) => {
            gaDone = true;
            void logError('api.leads', err, { stage: 'google_ads_conversion' }, ip, ua);
          },
        );
        const waitMs = Number(process.env.GOOGLE_ADS_WAIT_MS ?? (process.env.NODE_ENV === 'development' ? 500 : 0));
        if (waitMs > 0) {
          await new Promise((r) => setTimeout(r, waitMs));
          if (!gaDone) {
            void track({
              type: 'google_ads_deferred',
              level: 'info',
              source: 'api.leads',
              ip,
              ua,
              props: {
                action: conversionActionAlias,
                order_id: inserted.id,
                lead_type: leadType,
                value,
                timeout_ms: waitMs,
                ...(session_id ? { session_id } : {}),
              },
            });
          }
        }
      }
    } catch (e) {
      void logError('api.leads', e, { stage: 'google_ads_conversion', lead_type: leadType }, ip, ua);
    }

    // Fire-and-forget internal notification (PII-free)
    try {
      const to = process.env.LEADS_NOTIFY_EMAIL;
      if (to) {
        const notif = buildInternalLeadNotification({
          id: inserted.id,
          metadata: {
            lead_type: leadType,
            city: city ?? null,
          },
        });
        // Audit: attempted send
        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'api.leads',
          ip,
          ua,
          props: {
            stage: 'internal_notification',
            lead_id: inserted.id,
            lead_type: leadType,
            subject: notif.subject,
            ...(session_id ? { session_id } : {}),
          },
        });
        void sendEmail({
          to,
          subject: notif.subject,
          text: notif.text,
          context: { stage: 'internal_notification', lead_id: inserted.id, lead_type: leadType, ...(session_id ? { session_id } : {}) },
        }).catch(() => {});
      } else {
        // Make missing config visible
        void track({
          type: 'notify_skipped',
          level: 'warn',
          source: 'api.leads',
          ip,
          ua,
          props: {
            reason: 'missing_recipient',
            lead_id: inserted.id,
            lead_type: leadType,
            ...(session_id ? { session_id } : {}),
          },
        });
      }
    } catch (e) {
      console.error('[notify] Failed to build/send notification', e);
      void logError('api.leads', e, { stage: 'notify' }, ip, ua);
    }
    // Track successful submission (PII-free)
    const attr = parseAttributionFromRequest(req);
    void track({
      type: 'lead_submitted',
      level: 'info',
      source: 'api.leads',
      ip,
      ua,
      props: {
        id: inserted.id,
        lead_type: leadType,
        city: city || null,
        has_specializations: specializations.length > 0,
        ...(session_id ? { session_id } : {}),
        ...(attr.referrer ? { referrer: attr.referrer } : {}),
        ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
        ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
        ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
      },
    });
    return NextResponse.json(
      { data: { id: inserted.id }, error: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    void logError('api.leads', e, { stage: 'json_parse' }, undefined, req.headers.get('user-agent') || undefined);
    return NextResponse.json(
      { data: null, error: 'Invalid JSON' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
