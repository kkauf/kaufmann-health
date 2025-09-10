import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistUploadConfirmation } from '@/lib/email/templates/therapistUploadConfirmation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

function getFileExtension(fileName: string, contentType: string): string {
  if (contentType === 'application/pdf') return '.pdf';
  if (contentType === 'image/jpeg') return '.jpg';
  if (contentType === 'image/png') return '.png';
  const m = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return m ? `.${m[1].toLowerCase()}` : '';
}

function isValidUpload(file: File): { ok: true } | { ok: false; reason: string } {
  if (!ALLOWED_FILE_TYPES.has(file.type)) return { ok: false, reason: 'Unsupported file type' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'File too large' };
  return { ok: true };
}

function isValidPhoto(file: File): { ok: true } | { ok: false; reason: string } {
  if (!ALLOWED_PHOTO_TYPES.has(file.type)) return { ok: false, reason: 'Unsupported file type' };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, reason: 'File too large' };
  return { ok: true };
}

async function fileToBuffer(file: File): Promise<Buffer> {
  const ab = await file.arrayBuffer();
  return Buffer.from(ab);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    // Validate therapist exists and is pending verification
    const { data: therapist, error: fetchErr } = await supabaseServer
      .from('therapists')
      .select('id, status, metadata, first_name, last_name, email')
      .eq('id', id)
      .single();

    if (fetchErr || !therapist) {
      await logError('api.therapists.documents', fetchErr, { stage: 'fetch_therapist', therapist_id: id }, ip, ua);
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    if ((therapist as { status?: string }).status !== 'pending_verification') {
      // Hide details; treat as not found to avoid information leak
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    const form = await req.formData();
    const license = form.get('psychotherapy_license');
    const specAll = form.getAll('specialization_cert');
    const profilePhoto = form.get('profile_photo');
    const approachRaw = form.get('approach_text');

    if (!(license instanceof File) || license.size === 0) {
      return NextResponse.json({ data: null, error: 'Missing psychotherapy_license' }, { status: 400 });
    }

    const specializationFiles = specAll.filter((x): x is File => x instanceof File && x.size > 0);

    // Validate and upload license
    const licValid = isValidUpload(license);
    if (!licValid.ok) {
      return NextResponse.json({ data: null, error: `license: ${licValid.reason}` }, { status: 400 });
    }
    const bucket = 'therapist-documents';
    const licExt = getFileExtension(license.name || '', license.type);
    const licPath = `therapists/${id}/license-${Date.now()}${licExt}`;
    const licBuf = await fileToBuffer(license);
    const { error: upLicErr } = await supabaseServer.storage
      .from(bucket)
      .upload(licPath, licBuf, { contentType: license.type, upsert: false });
    if (upLicErr) {
      await logError('api.therapists.documents', upLicErr, { stage: 'upload_license', therapist_id: id, path: licPath }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to upload document' }, { status: 500 });
    }

    // Validate and upload specialization certs (optional)
    const specPaths: string[] = [];
    for (const file of specializationFiles) {
      const v = isValidUpload(file);
      if (!v.ok) return NextResponse.json({ data: null, error: `specialization: ${v.reason}` }, { status: 400 });
      const ext = getFileExtension(file.name || '', file.type);
      const path = `therapists/${id}/specialization-${Date.now()}${ext}`;
      const buf = await fileToBuffer(file);
      const { error: upErr } = await supabaseServer.storage
        .from(bucket)
        .upload(path, buf, { contentType: file.type, upsert: false });
      if (upErr) {
        await logError('api.therapists.documents', upErr, { stage: 'upload_specialization', therapist_id: id, path }, ip, ua);
        return NextResponse.json({ data: null, error: 'Failed to upload document' }, { status: 500 });
      }
      specPaths.push(path);
    }

    // Merge metadata.documents
    function isObject(v: unknown): v is Record<string, unknown> {
      return typeof v === 'object' && v !== null;
    }
    const metadata = (therapist as { metadata?: unknown }).metadata;
    const metaObj: Record<string, unknown> = isObject(metadata) ? (metadata as Record<string, unknown>) : {};
    const docsUnknown = (metaObj as { documents?: unknown }).documents;
    const docs: { license?: string; specialization?: Record<string, string[]> } = isObject(docsUnknown)
      ? (docsUnknown as { license?: string; specialization?: Record<string, string[]> })
      : {};

    docs.license = licPath;
    const spec = docs.specialization || {};
    spec.uncategorized = [...(spec.uncategorized || []), ...specPaths];
    docs.specialization = spec;

    metaObj.documents = docs;

    // Optional: profile completion
    let uploadedProfilePhotoPath: string | undefined;
    if (profilePhoto instanceof File && profilePhoto.size > 0) {
      const valid = isValidPhoto(profilePhoto);
      if (!valid.ok) {
        return NextResponse.json({ data: null, error: `profile_photo: ${valid.reason}` }, { status: 400 });
      }
      const photoExt = getFileExtension(profilePhoto.name || '', profilePhoto.type);
      const photoPath = `applications/${id}/profile-photo-${Date.now()}${photoExt}`;
      const buf = await fileToBuffer(profilePhoto);
      const { error: upPhotoErr } = await supabaseServer.storage
        .from('therapist-applications')
        .upload(photoPath, buf, { contentType: profilePhoto.type, upsert: false });
      if (upPhotoErr) {
        await logError('api.therapists.documents', upPhotoErr, { stage: 'upload_profile_photo', therapist_id: id, path: photoPath }, ip, ua);
        return NextResponse.json({ data: null, error: 'Failed to upload profile photo' }, { status: 500 });
      }
      uploadedProfilePhotoPath = photoPath;
    }

    let approach_text: string | undefined;
    if (typeof approachRaw === 'string') {
      const trimmed = approachRaw.trim();
      if (trimmed.length > 2000) {
        return NextResponse.json({ data: null, error: 'approach_text too long (max 2000 chars)' }, { status: 400 });
      }
      if (trimmed.length > 0) approach_text = trimmed;
    }

    if (uploadedProfilePhotoPath || typeof approach_text === 'string') {
      const profileUnknown = (metaObj as { profile?: unknown }).profile;
      const profile: Record<string, unknown> = isObject(profileUnknown) ? (profileUnknown as Record<string, unknown>) : {};
      if (uploadedProfilePhotoPath) profile.photo_pending_path = uploadedProfilePhotoPath;
      if (typeof approach_text === 'string') profile.approach_text = approach_text;
      metaObj.profile = profile;
    }

    const { error: updateErr } = await supabaseServer
      .from('therapists')
      .update({ metadata: metaObj })
      .eq('id', id);
    if (updateErr) {
      await logError('api.therapists.documents', updateErr, { stage: 'update_metadata', therapist_id: id }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to update' }, { status: 500 });
    }

    void track({ type: 'therapist_documents_uploaded', level: 'info', source: 'api.therapists.documents', ip, ua, props: { therapist_id: id, license: true, specialization_count: specPaths.length, profile_photo: Boolean(uploadedProfilePhotoPath), approach_text: Boolean(approach_text) } });

    // Best-effort upload confirmation email
    try {
      const firstName = (therapist as { first_name?: string | null }).first_name || '';
      const lastName = (therapist as { last_name?: string | null }).last_name || '';
      const name = [firstName, lastName].join(' ').trim() || undefined;
      const to = (therapist as { email?: string | null }).email || undefined;
      if (to) {
        const confirmation = renderTherapistUploadConfirmation({ name });
        void track({ type: 'email_attempted', level: 'info', source: 'api.therapists.documents', ip, ua, props: { stage: 'therapist_upload_confirmation', therapist_id: id, subject: confirmation.subject } });
        await sendEmail({ to, subject: confirmation.subject, html: confirmation.html, context: { stage: 'therapist_upload_confirmation', therapist_id: id } });
      }
    } catch (e) {
      await logError('api.therapists.documents', e, { stage: 'send_upload_confirmation', therapist_id: id }, ip, ua);
    }

    return NextResponse.json({ data: { ok: true }, error: null }, { status: 200 });
  } catch (e) {
    await logError('api.therapists.documents', e, { stage: 'exception', therapist_id: id }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
