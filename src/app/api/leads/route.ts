import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { TERMS_VERSION } from '@/content/therapist-terms';
import { ACTIVE_CITIES } from '@/lib/constants';
import { sendEmail } from '@/lib/email/client';
import { buildInternalLeadNotification } from '@/lib/email/internalNotification';
import { renderTherapistWelcome } from '@/lib/email/templates/therapistWelcome';
import { logError, track } from '@/lib/logger';
import { googleAdsTracker } from '@/lib/google-ads';
import { parseAttributionFromRequest } from '@/lib/server-analytics';
import { sanitize, normalizeSpecializations, hashIP } from '@/lib/leads/validation';
import { isIpRateLimited } from '@/lib/leads/rateLimit';
import { handlePatientLead, handleTherapistLead } from '@/lib/leads/handlers';
import type { LeadPayload } from '@/lib/leads/types';

export const runtime = 'nodejs';

/**
 * @endpoint POST /api/leads
 * @description Form handler for incoming lead submissions. Returns { data, error }.
 */

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

// File validation configuration
const ALLOWED_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB (documents)
// Profile photo specific limits
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

function getClientIP(headers: Headers) {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xrip = headers.get('x-real-ip');
  if (xrip) return xrip.trim();
  return undefined;
}

// Internal notification type moved to email lib; inline type removed

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

// Images: minimal server-side normalization for profile photos
// WHY: Ensure consistent display and reduce payload size for therapist profile photos.
// HOW: Best-effort resize to 800x800 (fit: 'inside'), preserve type. If 'sharp' is not
// installed or errors, we fall back to the original buffer. This keeps the API robust
// and avoids hard dependency on native modules. To enable resizing in prod, install:
//   npm i sharp
// Note: UI can still apply additional responsive optimizations on render (Next/Vercel).
async function resizeProfilePhotoIfPossible(file: File, original: Buffer): Promise<{ buffer: Buffer; contentType: string }> {
  // Best-effort resize to 800x800 max. Falls back to original if sharp unavailable or fails.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('sharp').catch(() => null);
    const sharp = mod?.default || mod;
    if (!sharp) return { buffer: original, contentType: file.type };
    const isPng = file.type === 'image/png' || (file.name || '').toLowerCase().endsWith('.png');
    const pipeline = sharp(original).rotate().resize(800, 800, { fit: 'inside', withoutEnlargement: true });
    const out = isPng ? await pipeline.png({ compressionLevel: 9 }).toBuffer() : await pipeline.jpeg({ quality: 82 }).toBuffer();
    return { buffer: out, contentType: isPng ? 'image/png' : 'image/jpeg' };
  } catch {
    return { buffer: original, contentType: file.type };
  }
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
  const specializations = normalizeSpecializations(form.getAll('specializations') || []);
  const approachTextRaw = form.get('approach_text')?.toString();
  if (approachTextRaw && approachTextRaw.length > 2000) {
    return NextResponse.json(
      { data: null, error: 'approach_text too long (max 2000 chars)' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const approach_text = sanitize(approachTextRaw);

  // Rate limiting (same as JSON path)
  if (ip) {
    const limited = await isIpRateLimited(supabaseServer, ip, 'therapist');
    if (limited) {
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
  // Optional profile photo (stored in applications bucket, pending review)
  let profilePendingPath: string | undefined;
  const maybeProfilePhoto = form.get('profile_photo');
  if (maybeProfilePhoto instanceof File && maybeProfilePhoto.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.has(maybeProfilePhoto.type)) {
      return NextResponse.json(
        { data: null, error: 'profile_photo: Unsupported file type (JPEG/PNG only)' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (maybeProfilePhoto.size > MAX_PROFILE_PHOTO_BYTES) {
      return NextResponse.json(
        { data: null, error: 'profile_photo: File too large (max 5MB)' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const ext = getFileExtension(maybeProfilePhoto.name || '', maybeProfilePhoto.type);
    const applicationsBucket = 'therapist-applications';
    const photoPath = `applications/${therapistId}/profile-photo-${Date.now()}${ext}`;
    const original = await fileToBuffer(maybeProfilePhoto);
    const processed = await resizeProfilePhotoIfPossible(maybeProfilePhoto, original);
    const { error: photoErr } = await supabaseServer.storage
      .from(applicationsBucket)
      .upload(photoPath, processed.buffer, { contentType: processed.contentType, upsert: false });
    if (photoErr) {
      console.error('Upload profile photo failed:', photoErr);
      void logError('api.leads', photoErr, { stage: 'upload_profile_photo', therapist_id: therapistId }, ip, ua);
      // Graceful fallback: continue without profile photo
    } else {
      profilePendingPath = photoPath;
    }
  }

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

  // Persist document paths and profile data into therapists.metadata
  const profileMeta: Record<string, unknown> = {};
  if (profilePendingPath) profileMeta.photo_pending_path = profilePendingPath;
  if (approach_text) profileMeta.approach_text = approach_text;
  const metadata: Record<string, unknown> = { documents };
  if (Object.keys(profileMeta).length > 0) {
    metadata.profile = profileMeta;
  }
  const { error: metaErr } = await supabaseServer
    .from('therapists')
    .update({ metadata })
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
    // Note: qualification/experience/website are therapist-only fields collected in multipart route
    // and therefore are ignored in the JSON patient path here to avoid unused variables.
    const leadType: 'patient' | 'therapist' = payload.type === 'therapist' ? 'therapist' : 'patient';
    const session_id = sanitize(payload.session_id);
    // Consent flags (patient only)
    const consentShare = Boolean(payload.consent_share_with_therapists);
    const privacyVersion = sanitize(payload.privacy_version);
    const specializations = normalizeSpecializations(payload.specializations ?? []);

    // Consent validation handled later with comprehensive tracking

    // Basic IP-based rate limiting (60s window). Note: best-effort and
    // dependent on upstream "x-forwarded-for" headers.
    const ip = getClientIP(req.headers);
    const ua = req.headers.get('user-agent') || undefined;
    if (ip) {
      const limited = await isIpRateLimited(supabaseServer, ip, leadType);
      if (limited) {
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
    // Delegate to handlers for actual processing
    if (leadType === 'therapist') {
      return await handleTherapistLead(
        { req, ip, ua },
        {
          data: { name: data.name, email: data.email, phone: data.phone, notes: data.notes },
          city: city || undefined,
          sessionPreferences,
          specializations,
          session_id: session_id || undefined,
        },
      );
    } else {
      return await handlePatientLead(
        { req, ip, ua },
        {
          data: { name: data.name, email: data.email, phone: data.phone, notes: data.notes },
          city: city || undefined,
          issue: issue || undefined,
          availability: availability || undefined,
          budget: budget || undefined,
          sessionPreference: sessionPreference || undefined,
          sessionPreferences,
          specializations,
          consentShare,
          privacyVersion: privacyVersion || undefined,
          session_id: session_id || undefined,
        },
      );
    }
  } catch (e) {
    void logError('api.leads', e, { stage: 'json_parse' }, undefined, req.headers.get('user-agent') || undefined);
    return NextResponse.json(
      { data: null, error: 'Invalid JSON' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
