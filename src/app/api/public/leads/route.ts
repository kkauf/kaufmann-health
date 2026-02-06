import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabase-server';
import { TERMS_VERSION } from '@/content/therapist-terms';
import { ACTIVE_CITIES } from '@/lib/constants';
import { sendEmail } from '@/lib/email/client';
import { buildInternalLeadNotification } from '@/lib/email/internalNotification';
import { renderTherapistWelcome } from '@/lib/email/templates/therapistWelcome';
import { renderEmailConfirmation } from '@/lib/email/templates/emailConfirmation';
import { logError, track } from '@/lib/logger';
import { BASE_URL } from '@/lib/constants';
import { createTherapistOptOutToken } from '@/lib/signed-links';
import { parseAttributionFromRequest, parseCampaignFromRequest, ServerAnalytics } from '@/lib/server-analytics';
import { sanitize, normalizeSpecializations, hashIP } from '@/features/leads/lib/validation';
import { isIpRateLimited } from '@/features/leads/lib/rateLimit';
import { handleTherapistLead } from '@/features/leads/lib/handlers';
import type { LeadPayload } from '@/features/leads/lib/types';
import { isTestRequest } from '@/lib/test-mode';
import { safeJson } from '@/lib/http';
import { getClientSession } from '@/lib/auth/clientSession';
import { createInstantMatchesForPatient } from '@/features/leads/lib/match';
import { getPartnersNotifyEmail, getLeadsNotifyEmail, getQaNotifyEmail } from '@/lib/email/notification-recipients';

export const runtime = 'nodejs';

function getErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : '';
  }
  return '';
}

// createInstantMatchesForPatient is now imported from @/features/leads/lib/match

/**
 * @endpoint POST /api/public/leads
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
        return '/api/public/leads';
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
  } catch { }
  return safeJson(
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

// Guard against open redirects: only allow absolute app-internal paths and disallow API paths
function isSafeRelativePath(p?: string | null): p is string {
  if (!p || typeof p !== 'string') return false;
  // Must start with a single '/'
  if (!p.startsWith('/') || p.startsWith('//')) return false;
  // Disallow API namespace
  if (p.startsWith('/api')) return false;
  return true;
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
    return safeJson(
      { data: null, error: 'Invalid multipart payload' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const emailRaw = form.get('email')?.toString();
  const email = sanitize(emailRaw)?.toLowerCase();
  const isTest = isTestRequest(req, email);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return safeJson(
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
  if (approachTextRaw && approachTextRaw.length > 500) {
    return safeJson(
      { data: null, error: 'approach_text too long (max 500 chars)' },
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
      return safeJson(
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
      ...(isTest ? { metadata: { is_test: true } as Record<string, unknown> } : {}),
      status: 'pending_verification',
    })
    .select('id')
    .single();

  if (err || !ins?.id) {
    console.error('Supabase error:', err);
    void logError('api.leads', err, { stage: 'insert_lead', lead_type: 'therapist', city }, ip, ua);
    return safeJson(
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
    return safeJson(
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
      return safeJson(
        { data: null, error: 'profile_photo: Unsupported file type (JPEG/PNG only)' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (maybeProfilePhoto.size > MAX_PROFILE_PHOTO_BYTES) {
      return safeJson(
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
      return safeJson(
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
      return safeJson(
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
        return safeJson(
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
        return safeJson(
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

  // EARTH-71: Persist trust signals
  const qualification = sanitize(form.get('qualification')?.toString());
  const experience = sanitize(form.get('experience')?.toString());
  const website = sanitize(form.get('website')?.toString());

  if (qualification) profileMeta.qualification = qualification;
  if (experience) profileMeta.experience = experience;
  if (website) profileMeta.website = website;

  const metadata: Record<string, unknown> = { ...(isTest ? { is_test: true } : {}), trace_id: randomUUID(), documents };
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
    // EARTH-129: Link to the new profile completion step first
    const uploadUrl = `${BASE_URL}/therapists/complete-profile/${therapistId}`;
    const welcome = renderTherapistWelcome({ name: data.name, city, isActiveCity, termsVersion: TERMS_VERSION, uploadUrl });
    void track({
      type: 'email_attempted',
      level: 'info',
      source: 'api.leads',
      ip,
      ua,
      props: { stage: 'therapist_welcome', lead_id: therapistId, lead_type: 'therapist', subject: welcome.subject },
    });
    // Include List-Unsubscribe for recurring onboarding reminders (opt-out)
    let headers: Record<string, string> | undefined;
    try {
      const token = await createTherapistOptOutToken(String(therapistId));
      const optOutUrl = `${BASE_URL}/api/therapists/opt-out?token=${encodeURIComponent(token)}`;
      headers = {
        'List-Unsubscribe': `<${optOutUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      };
    } catch { }
    const welcomeResult = await sendEmail({
      to: data.email,
      subject: welcome.subject,
      html: welcome.html,
      ...(headers ? { headers } : {}),
      replyTo: 'kontakt@kaufmann-health.de',
      context: { stage: 'therapist_welcome', lead_id: therapistId, lead_type: 'therapist' },
    });
    // Only log as error if it was an actual failure, not suppression or missing config
    if (!welcomeResult.sent && welcomeResult.reason === 'failed') {
      await logError('api.leads', new Error('Therapist welcome email send failed'), { stage: 'therapist_welcome_send_failed', lead_id: therapistId, email: data.email }, ip, ua);
    }
  } catch (e) {
    console.error('[welcome-email] Failed to render/send therapist welcome', e);
    void logError('api.leads', e, { stage: 'welcome_email' }, ip, ua);
  }

  // Google Ads conversion moved to documents submission endpoint (see /api/therapists/:id/documents)

  // Internal notification (PII-free) - therapist signups go to partner team (test → QA sink)
  try {
    const to = isTest ? getQaNotifyEmail() : getPartnersNotifyEmail();
    if (to) {
      const notif = buildInternalLeadNotification({ id: therapistId, metadata: { lead_type: 'therapist', city: city ?? null } });
      const subject = isTest ? `[TEST] ${notif.subject}` : notif.subject;
      void track({
        type: 'email_attempted',
        level: 'info',
        source: 'api.leads',
        ip,
        ua,
        props: { stage: 'internal_notification', lead_id: therapistId, lead_type: 'therapist', subject },
      });
      void sendEmail({ to, subject, text: notif.text, context: { stage: 'internal_notification', lead_id: therapistId, lead_type: 'therapist' } }).catch(() => { });
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
      is_test: isTest,
      ...(attr.referrer ? { referrer: attr.referrer } : {}),
      ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
      ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
      ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
    },
  });

  return safeJson(
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
    const phoneNumber = sanitize(payload.phone_number);
    const contactMethod = payload.contact_method;

    // EARTH-191: Support both email and phone as primary contact
    // At least one must be provided
    if (!email && !phoneNumber) {
      return safeJson(
        { data: null, error: 'Email or phone number required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Validate email if provided
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return safeJson(
        { data: null, error: 'Invalid email' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Validate phone if provided (basic E.164 check)
    // react-international-phone gives us E.164 format (e.g., +4915212345678)
    // German mobile numbers: +49 followed by 10-11 digits = 13-14 chars total
    if (phoneNumber) {
      const cleaned = phoneNumber.replace(/\s+/g, '');
      if (cleaned.length < 12 || !cleaned.startsWith('+')) {
        return safeJson(
          { data: null, error: 'Invalid phone number' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
    }

    const data: LeadPayload = {
      name: sanitize(payload.name),
      email,
      phone: sanitize(payload.phone),
      phone_number: phoneNumber,
      notes: sanitize(payload.notes),
      contact_method: contactMethod,
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
    // Therapist profile fields (qualification/experience/website) not processed in JSON path
    // Therapist's own gender (for identity verification)
    const therapistGenderRaw = sanitize(payload.gender as string | undefined);
    const therapistGender: 'male' | 'female' | 'non-binary' | undefined =
      therapistGenderRaw === 'male' || therapistGenderRaw === 'female' || therapistGenderRaw === 'non-binary' ? therapistGenderRaw : undefined;
    // Optional gender preference (patient)
    const genderPrefRaw = sanitize(payload.gender_preference as string | undefined);
    const genderPreference: 'male' | 'female' | 'no_preference' | undefined =
      genderPrefRaw === 'male' || genderPrefRaw === 'female' || genderPrefRaw === 'no_preference' ? genderPrefRaw : undefined;
    // Optional form session linkage for email-first wizard flow (EARTH-190)
    const formSessionId = sanitize(payload.form_session_id as string | undefined);
    const confirmRedirectPathRaw = sanitize(payload.confirm_redirect_path as string | undefined);
    const confirmRedirectPath = isSafeRelativePath(confirmRedirectPathRaw) ? confirmRedirectPathRaw : undefined;

    // Fetch form session data to extract schwerpunkte and other wizard preferences
    let formSessionSchwerpunkte: string[] | undefined;
    let formSessionTimeSlots: string[] | undefined;
    let formSessionMethods: string[] | undefined;
    let formSessionStartTiming: string | undefined;
    let formSessionGenderPref: 'male' | 'female' | 'no_preference' | undefined;
    let formSessionCity: string | undefined;
    let formSessionSessionPref: 'online' | 'in_person' | undefined;
    let formSessionSessionPrefs: ('online' | 'in_person')[] | undefined;
    if (formSessionId) {
      try {
        const { data: fsRow } = await supabaseServer
          .from('form_sessions')
          .select('data')
          .eq('id', formSessionId)
          .single();
        if (fsRow && typeof fsRow.data === 'object' && fsRow.data !== null) {
          const fsData = fsRow.data as Record<string, unknown>;
          if (Array.isArray(fsData.schwerpunkte)) {
            formSessionSchwerpunkte = fsData.schwerpunkte as string[];
          }
          if (Array.isArray(fsData.time_slots)) {
            formSessionTimeSlots = fsData.time_slots as string[];
          }
          if (Array.isArray(fsData.methods)) {
            formSessionMethods = fsData.methods as string[];
          }
          if (typeof fsData.start_timing === 'string') {
            formSessionStartTiming = fsData.start_timing;
          }
          // Convert German gender to English preference (SignupWizard uses German values)
          if (typeof fsData.gender === 'string') {
            const g = fsData.gender.toLowerCase();
            if (g.includes('mann')) formSessionGenderPref = 'male';
            else if (g.includes('frau')) formSessionGenderPref = 'female';
            else if (g.includes('keine') || g.includes('divers')) formSessionGenderPref = 'no_preference';
          }
          // Extract city from form session (critical for matching)
          if (typeof fsData.city === 'string' && fsData.city.trim()) {
            formSessionCity = fsData.city.trim();
          }
          // Extract session preference from form session (critical for matching)
          const fsSp = fsData.session_preference;
          if (fsSp === 'online' || fsSp === 'in_person') {
            formSessionSessionPref = fsSp;
          } else if (fsSp === 'either' || fsSp === 'both') {
            formSessionSessionPrefs = ['online', 'in_person'];
          }
        }
      } catch { /* ignore form session fetch errors */ }
    }
    // Use form session values if not provided directly in payload (fallback chain)
    const effectiveGenderPref = genderPreference || formSessionGenderPref;
    const effectiveCity = city || formSessionCity;
    const effectiveSessionPref = sessionPreference || formSessionSessionPref;
    const effectiveSessionPrefs = sessionPreferences.length > 0 ? sessionPreferences : (formSessionSessionPrefs || [])

    // Detect verified phone via client session cookie (set by verify-code)
    const clientSession = await getClientSession(req);
    const cookieVerifiedPhone = Boolean(
      clientSession &&
      clientSession.contact_method === 'phone' &&
      typeof clientSession.contact_value === 'string' &&
      clientSession.contact_value === (phoneNumber || '')
    );

    // Email-first (double opt-in) flow for patients (EARTH-146/190)
    // Capture consent implicitly via disclaimer + submit action (no checkbox)

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
        return safeJson(
          { data: null, error: 'Rate limited' },
          { status: 429, headers: { 'Cache-Control': 'no-store' } },
        );
      }
    }

    if (leadType === 'patient') {
      // Require privacy version acknowledgement at email submission (legal basis)
      if (!privacyVersion) {
        return safeJson(
          { data: null, error: 'Datenschutzhinweis muss bestätigt werden' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      if (!consentShare) {
        return safeJson(
          { data: null, error: 'Einwilligung zur Datenübertragung erforderlich' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      const isTest = isTestRequest(req, email);
      // Campaign inference from referrer with client override support
      const campaign = parseCampaignFromRequest(req);
      let campaign_source: string | undefined = campaign.campaign_source;
      const landing_page = campaign.landing_page;
      // Variant: free-form string from ?variant= (or ?v=) if present
      let campaign_variant: string | undefined = campaign.campaign_variant || undefined;
      // Header overrides from client (SignupWizard)
      let gclid: string | undefined;
      try {
        const csOver = req.headers.get('x-campaign-source-override') || undefined;
        const cvOver = req.headers.get('x-campaign-variant-override') || undefined;
        gclid = req.headers.get('x-gclid') || undefined;
        if (csOver) campaign_source = csOver;
        if (cvOver) campaign_variant = cvOver;
      } catch { }

      // Prepare confirmation token up-front so we can store it at insert time
      const confirmToken = randomUUID();

      // Insert minimal lead with resilience to optional campaign columns not yet in schema
      // Also persist early session preference if provided (so we can prioritize online from signup)
      const baseMetadata: Record<string, unknown> = {
        ...(isTest ? { is_test: true } : {}),
        submitted_at: new Date().toISOString(),
        confirm_token: confirmToken,
        confirm_sent_at: new Date().toISOString(),
        // Random trace ID for session investigation (not PII, replaces raw IP)
        trace_id: randomUUID(),
        // Basic context for debugging/ops (hashed for GDPR)
        ...(ip ? { hashed_ip: hashIP(ip) } : {}),
        ...(ua ? { user_agent: ua } : {}),
        // Google Ads click ID for conversion attribution (critical for tracking)
        ...(gclid ? { gclid } : {}),
        ...(effectiveSessionPref ? { session_preference: effectiveSessionPref } : {}),
        ...(effectiveSessionPrefs.length ? { session_preferences: effectiveSessionPrefs } : {}),
        ...(formSessionId ? { form_session_id: formSessionId } : {}),
        ...(formSessionSchwerpunkte?.length ? { schwerpunkte: formSessionSchwerpunkte } : {}),
        ...(formSessionTimeSlots?.length ? { time_slots: formSessionTimeSlots } : {}),
        ...(formSessionMethods?.length ? { methods: formSessionMethods } : {}),
        ...(formSessionStartTiming ? { start_timing: formSessionStartTiming } : {}),
        ...(effectiveCity ? { city: effectiveCity } : {}),
        ...(issue ? { issue } : {}),
        ...(availability ? { availability } : {}),
        ...(budget ? { budget } : {}),
        ...(effectiveGenderPref ? { gender_preference: effectiveGenderPref } : {}),
        ...(contactMethod ? { contact_method: contactMethod } : {}),
        ...(cookieVerifiedPhone ? { phone_verified: true } : {}),
        ...(landing_page ? { landing_page } : {}),
        ...(confirmRedirectPath ? { last_confirm_redirect_path: confirmRedirectPath } : {}),
        consent_share_with_therapists: true,
        consent_share_with_therapists_at: new Date().toISOString(),
        consent_privacy_version: privacyVersion,
        consent_terms_version: TERMS_VERSION,
      };
      const insertPayload = {
        ...(data.name ? { name: data.name } : {}),
        ...(email ? { email } : {}),
        ...(phoneNumber ? { phone_number: phoneNumber } : {}),
        type: 'patient' as const,
        status: cookieVerifiedPhone ? 'new' : 'pre_confirmation',
        campaign_source,
        campaign_variant,
        metadata: baseMetadata,
      };
      const attemptInsert = async (payload: Record<string, unknown>) =>
        supabaseServer.from('people').insert(payload).select('id').single();
      // First attempt with campaign fields
      let effectiveId: string | undefined;
      let insErr: unknown = null;
      const res = await attemptInsert(insertPayload);
      const resMsg = getErrorMessage(res.error);
      if (resMsg.includes('schema cache')) {
        // Retry without optional campaign fields
        void track({
          type: 'leads_schema_mismatch',
          level: 'warn',
          source: 'api.leads',
          ip,
          ua,
          props: { stage: 'insert_email_only_lead', missing: 'campaign_columns', note: 'retrying without campaign fields' },
        });
        const fallbackPayload = {
          ...(data.name ? { name: data.name } : {}),
          ...(email ? { email } : {}),
          ...(phoneNumber ? { phone_number: phoneNumber } : {}),
          type: 'patient' as const,
          status: cookieVerifiedPhone ? 'new' : 'pre_confirmation',
          metadata: insertPayload.metadata,
        };
        const res2 = await attemptInsert(fallbackPayload);
        effectiveId = (res2.data as { id?: string } | null)?.id as string | undefined;
        insErr = res2.error;
      } else {
        effectiveId = (res.data as { id?: string } | null)?.id as string | undefined;
        insErr = res.error;
      }

      // Handle unique violation gracefully by looking up existing email or phone
      if ((insErr as { code?: string } | null | undefined)?.code === '23505') {
        type ExistingPerson = { id: string; name?: string | null; status?: string | null; metadata?: Record<string, unknown> | null; campaign_source?: string | null; campaign_variant?: string | null };
        const doSelect = async (cols: string) => {
          let query = supabaseServer.from('people').select(cols);
          if (email) query = query.eq('email', email);
          else if (phoneNumber) query = query.eq('phone_number', phoneNumber);
          return query.single<ExistingPerson>();
        };
        const sel = await doSelect('id,name,status,metadata,campaign_source,campaign_variant');
        let existing: ExistingPerson | null = (sel.data as ExistingPerson) ?? null;
        let selErr: unknown = sel.error;
        const selMsg = getErrorMessage(sel.error);
        if (selMsg.includes('schema cache')) {
          // Retry without optional columns
          void track({ type: 'leads_schema_mismatch', level: 'warn', source: 'api.leads', ip, ua, props: { stage: 'select_existing_contact', missing: 'campaign_columns' } });
          const sel2 = await doSelect('id,name,status,metadata');
          existing = (sel2.data as ExistingPerson) ?? null;
          selErr = sel2.error;
        }
        const existingStatus = existing?.status || null;
        if (existing && existing.id) {
          if (contactMethod === 'phone' && existingStatus === 'pre_confirmation' && cookieVerifiedPhone) {
            const merged: Record<string, unknown> = {
              ...(existing.metadata || {}),
              phone_verified: true,
              consent_share_with_therapists: true,
              consent_share_with_therapists_at: new Date().toISOString(),
              consent_privacy_version: privacyVersion,
              consent_terms_version: TERMS_VERSION,
            };
            if (formSessionId && !('form_session_id' in merged)) merged['form_session_id'] = formSessionId;
            if (contactMethod && !('contact_method' in merged)) merged['contact_method'] = contactMethod;
            await supabaseServer
              .from('people')
              .update({
                status: 'new',
                metadata: merged,
                ...(data.name ? { name: data.name } : {}),
                ...(phoneNumber ? { phone_number: phoneNumber } : {}),
                ...(campaign_source ? { campaign_source } : {}),
                ...(campaign_variant ? { campaign_variant } : {}),
              })
              .eq('id', existing.id);
            await ServerAnalytics.trackEventFromRequest(req, {
              type: 'contact_submitted',
              source: 'api.leads',
              props: { campaign_source, campaign_variant, requires_confirmation: false, is_test: isTest, contact_method: contactMethod },
            });
            const matchResult = await createInstantMatchesForPatient(existing.id, campaign_variant || undefined);
            if (matchResult) {
              void ServerAnalytics.trackEventFromRequest(req, {
                type: 'instant_match_created',
                source: 'api.leads',
                props: { match_quality: matchResult.matchQuality, patient_id: existing.id },
              });
            }
            return safeJson(
              { data: { id: existing.id, requiresConfirmation: false, ...(matchResult ? { matchesUrl: matchResult.matchesUrl } : {}) }, error: null },
              { headers: { 'Cache-Control': 'no-store' } },
            );
          } else if (!isTest && existingStatus && existingStatus !== 'pre_confirmation') {
            // Already confirmed or other terminal state — upsert missing attributes, then treat as success
            // For concierge variant: treat as returning user needing fresh manual matching
            const isReturningConcierge = campaign_variant === 'concierge';
            try {
              const updateData: Record<string, unknown> = {};
              if (data.name && (!existing.name || existing.name.trim() !== data.name.trim())) {
                updateData.name = data.name;
              }
              if (campaign_source && !existing.campaign_source) updateData.campaign_source = campaign_source;
              if (campaign_variant && !existing.campaign_variant) updateData.campaign_variant = campaign_variant;
              const meta: Record<string, unknown> = { ...(existing.metadata || {}) };
              let metaChanged = false;
              if (formSessionId && !('form_session_id' in meta)) { meta['form_session_id'] = formSessionId; metaChanged = true; }
              if (contactMethod && !('contact_method' in meta)) { meta['contact_method'] = contactMethod; metaChanged = true; }
              if (meta['consent_share_with_therapists'] !== true) { meta['consent_share_with_therapists'] = true; metaChanged = true; }
              meta['consent_share_with_therapists_at'] = new Date().toISOString(); metaChanged = true;
              meta['consent_privacy_version'] = privacyVersion; metaChanged = true;
              meta['consent_terms_version'] = TERMS_VERSION; metaChanged = true;
              // Mark returning concierge request with timestamp so admin can identify and action
              if (isReturningConcierge) {
                meta['returning_concierge_at'] = new Date().toISOString();
                metaChanged = true;
                // Also update latest form session data for fresh preferences
                if (formSessionSchwerpunkte?.length) { meta['schwerpunkte'] = formSessionSchwerpunkte; }
                if (formSessionTimeSlots?.length) { meta['time_slots'] = formSessionTimeSlots; }
                if (formSessionMethods?.length) { meta['methods'] = formSessionMethods; }
                if (formSessionStartTiming) { meta['start_timing'] = formSessionStartTiming; }
                if (effectiveGenderPref) { meta['gender_preference'] = effectiveGenderPref; }
                if (city) { meta['city'] = city; }
                if (issue) { meta['issue'] = issue; }
              }
              if (metaChanged || Object.keys(updateData).length > 0) {
                await supabaseServer
                  .from('people')
                  .update({ ...(Object.keys(updateData).length ? updateData : {}), ...(metaChanged ? { metadata: meta } : {}) })
                  .eq('id', existing.id);
              }
            } catch { }
            await ServerAnalytics.trackEventFromRequest(req, {
              type: 'contact_submitted',
              source: 'api.leads',
              props: { campaign_source, campaign_variant, requires_confirmation: false, is_test: isTest, contact_method: contactMethod, returning_user: true },
            });
            // For concierge: track event and send internal notification so admin knows to create matches
            if (isReturningConcierge) {
              void ServerAnalytics.trackEventFromRequest(req, {
                type: 'concierge_lead_created',
                source: 'api.leads',
                props: { patient_id: existing.id, requires_manual_matching: true, returning_user: true },
              });
              // Send internal notification for returning concierge user
              try {
                const to = getLeadsNotifyEmail();
                if (to) {
                  const cityVal = city || (existing.metadata as Record<string, unknown> | undefined)?.['city'] as string | undefined || 'unknown';
                  const subject = `Rückkehrender Klient (Concierge): ${cityVal}`;
                  const text = [
                    `Rückkehrender Klient benötigt neue Therapeuten-Auswahl (Concierge-Flow)`,
                    `Lead ID: ${existing.id}`,
                    `Stadt: ${cityVal}`,
                    'Bitte in /admin/leads prüfen und Matches erstellen.',
                  ].join('\n');
                  void sendEmail({ to, subject, text, context: { stage: 'returning_concierge_notification', lead_id: existing.id } }).catch(() => {});
                }
              } catch { }
            }
            return safeJson(
              { data: { id: existing.id, requiresConfirmation: false }, error: null },
              { headers: { 'Cache-Control': 'no-store' } },
            );
          } else {
            // Refresh token and sent time for pre_confirmation and persist early session preference if present
            const merged: Record<string, unknown> = {
              ...(existing.metadata || {}),
              confirm_token: confirmToken,
              confirm_sent_at: new Date().toISOString(),
              ...(effectiveSessionPref ? { session_preference: effectiveSessionPref } : {}),
              ...(effectiveSessionPrefs.length ? { session_preferences: effectiveSessionPrefs } : {}),
              ...(isTest ? { is_test: true } : {}),
              ...(effectiveCity ? { city: effectiveCity } : {}),
              ...(issue ? { issue } : {}),
              ...(availability ? { availability } : {}),
              ...(budget ? { budget } : {}),
              ...(effectiveGenderPref ? { gender_preference: effectiveGenderPref } : {}),
              ...(confirmRedirectPath ? { last_confirm_redirect_path: confirmRedirectPath } : {}),
              consent_share_with_therapists: true,
              consent_share_with_therapists_at: new Date().toISOString(),
              consent_privacy_version: privacyVersion,
              consent_terms_version: TERMS_VERSION,
              phone_verified: false,
            };
            if (isTest) {
              await supabaseServer
                .from('people')
                .update({
                  status: 'pre_confirmation',
                  metadata: merged,
                  ...(data.name ? { name: data.name } : {}),
                  ...(phoneNumber ? { phone_number: phoneNumber } : {})
                })
                .eq('id', existing.id);
            } else {
              await supabaseServer
                .from('people')
                .update({ metadata: merged, ...(data.name ? { name: data.name } : {}) })
                .eq('id', existing.id);
            }
            // Set effectiveId so email confirmation uses the correct ID
            effectiveId = existing.id;
          }
        } else if (existing && existing.id) {
          if (selErr) {
            console.error('Supabase select existing error (email-only lead):', selErr);
            void logError('api.leads', selErr, { stage: 'select_existing_email' }, ip, ua);
          }
        } else {
          // No existing record found, do nothing here; handled by outer logic
        }
      } else if (insErr) {
        // Non-schema errors still block to signal real failure
        console.error('Supabase insert error (email-only lead):', insErr);
        void logError('api.leads', insErr, { stage: 'insert_email_only_lead' }, ip, ua);
        return safeJson(
          { data: null, error: 'Failed to save lead' },
          { status: 500, headers: { 'Cache-Control': 'no-store' } },
        );
      }

      // Send confirmation email only if email was provided (phone users verify via SMS)
      if (email) {
        try {
          // Use request origin to avoid port/domain mismatch in local/dev
          const origin = new URL(req.url).origin || BASE_URL;
          const confirmBase = `${origin}/api/public/leads/confirm?token=${encodeURIComponent(confirmToken)}&id=${encodeURIComponent(
            effectiveId!,
          )}`;
          const withFs = formSessionId ? `${confirmBase}&fs=${encodeURIComponent(formSessionId)}` : confirmBase;
          const confirmUrl = confirmRedirectPath ? `${withFs}&redirect=${encodeURIComponent(confirmRedirectPath)}` : withFs;
          const emailContent = renderEmailConfirmation({ confirmUrl });
          void track({
            type: 'email_attempted',
            level: 'info',
            source: 'api.leads',
            ip,
            ua,
            props: { stage: 'email_confirmation', lead_id: effectiveId!, lead_type: 'patient', subject: emailContent.subject },
          });
          const emailResult = await sendEmail({
            to: email,
            subject: emailContent.subject,
            html: emailContent.html,
            replyTo: 'kontakt@kaufmann-health.de',
            context: {
              stage: 'email_confirmation',
              lead_id: effectiveId!,
              lead_type: 'patient',
              template: 'email_confirmation',
              email_token: confirmToken,
            },
          });
          // Only log as error if it was an actual failure, not suppression or missing config
          if (!emailResult.sent && emailResult.reason === 'failed') {
            await logError('api.leads', new Error('Confirmation email send failed'), { stage: 'email_confirmation_send_failed', lead_id: effectiveId!, email }, ip, ua);
          }
        } catch (e) {
          console.error('[email-confirmation] Failed to render/send', e);
          void logError('api.leads', e, { stage: 'email_confirmation_email' }, ip, ua);
        }
      }

      // Analytics (server-side)
      await ServerAnalytics.trackEventFromRequest(req, {
        type: 'email_submitted',
        source: 'api.leads',
        props: {
          campaign_source,
          campaign_variant,
          requires_confirmation: true,
          is_test: isTest,
          consent_share_with_therapists: consentShare,
          privacy_version: privacyVersion,
        },
      });

      // Record standardized consent capture for patient leads
      await ServerAnalytics.trackEventFromRequest(req, {
        type: 'consent_captured',
        source: 'api.leads',
        props: {
          method: contactMethod,
          privacy_version: privacyVersion,
        },
      });

      // Test 4: Concierge variant skips auto-matching (admin does manual curation)
      // Self-Service and other variants get instant matches
      const skipAutoMatch = campaign_variant === 'concierge';
      let matchResult: { matchesUrl: string; matchQuality: 'exact' | 'partial' | 'none' } | null = null;
      
      if (!skipAutoMatch) {
        matchResult = await createInstantMatchesForPatient(effectiveId!, campaign_variant || undefined);
        if (matchResult) {
          void ServerAnalytics.trackEventFromRequest(req, {
            type: 'instant_match_created',
            source: 'api.leads',
            props: { match_quality: matchResult.matchQuality, patient_id: effectiveId! },
          });
          // Store matchesUrl as redirect path so after verification user goes to their matches
          // This ensures conversion fires at verification (Test 3 requirement)
          try {
            await supabaseServer
              .from('people')
              .update({ metadata: { ...((await supabaseServer.from('people').select('metadata').eq('id', effectiveId!).single()).data?.metadata || {}), last_confirm_redirect_path: matchResult.matchesUrl } })
              .eq('id', effectiveId!);
          } catch { /* Non-blocking */ }
        }
      } else {
        // Concierge: Track that this lead requires manual matching
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'concierge_lead_created',
          source: 'api.leads',
          props: { patient_id: effectiveId!, requires_manual_matching: true },
        });
      }
      
      return safeJson(
        { data: { id: effectiveId!, requiresConfirmation: true }, error: null },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Delegate to handlers for therapist processing
    if (leadType === 'therapist') {
      return await handleTherapistLead(
        { req, ip, ua },
        {
          data: { name: data.name, email: data.email || '', phone: data.phone || '', notes: data.notes || '' },
          city: city || undefined,
          gender: therapistGender,
          sessionPreferences,
          specializations,
          session_id: session_id || undefined,
        },
      );
    }
  } catch (e) {
    void logError('api.leads', e, { stage: 'json_parse' }, undefined, req.headers.get('user-agent') || undefined);
    return safeJson(
      { data: null, error: 'Invalid JSON' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
