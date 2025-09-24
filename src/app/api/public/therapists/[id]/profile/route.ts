import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB

function getFileExtension(fileName: string, contentType: string): string {
  if (contentType === 'image/jpeg') return '.jpg';
  if (contentType === 'image/png') return '.png';
  const m = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return m ? `.${m[1].toLowerCase()}` : '';
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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    // Validate therapist exists and is pending verification
    const { data: therapist, error: fetchErr } = await supabaseServer
      .from('therapists')
      .select('id, status, metadata, gender, city, accepting_new')
      .eq('id', id)
      .single();

    if (fetchErr || !therapist) {
      await logError('api.therapists.profile', fetchErr, { stage: 'fetch_therapist', therapist_id: id }, ip, ua);
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    if ((therapist as { status?: string }).status !== 'pending_verification') {
      // Hide details; treat as not found to avoid information leak
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    const contentType = req.headers.get('content-type') || '';
    let gender: string | undefined;
    let city: string | undefined;
    let acceptingNew: boolean | undefined;
    let approachText: string | undefined;
    let profilePhoto: File | undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const g = form.get('gender');
      const c = form.get('city');
      const a = form.get('accepting_new');
      const at = form.get('approach_text');
      const pp = form.get('profile_photo');

      if (typeof g === 'string' && g.trim()) gender = g.trim();
      if (typeof c === 'string' && c.trim()) city = c.trim();
      if (typeof a === 'string') acceptingNew = a === 'true' || a === '1' || a.toLowerCase() === 'yes';
      if (typeof at === 'string') {
        const trimmed = at.trim();
        if (trimmed.length > 500) {
          return NextResponse.json({ data: null, error: 'approach_text too long (max 500 chars)' }, { status: 400 });
        }
        if (trimmed) approachText = trimmed;
      }
      if (pp instanceof File && pp.size > 0) profilePhoto = pp as File;
    } else {
      // Assume JSON
      const body = await req.json().catch(() => ({}));
      const g = body?.gender;
      const c = body?.city;
      const a = body?.accepting_new;
      const at = body?.approach_text;
      if (typeof g === 'string' && g.trim()) gender = g.trim();
      if (typeof c === 'string' && c.trim()) city = c.trim();
      if (typeof a === 'boolean') acceptingNew = a;
      if (typeof at === 'string') {
        const trimmed = at.trim();
        if (trimmed.length > 500) {
          return NextResponse.json({ data: null, error: 'approach_text too long (max 500 chars)' }, { status: 400 });
        }
        if (trimmed) approachText = trimmed;
      }
    }

    // Validate gender if provided
    if (typeof gender === 'string' && !['male', 'female', 'diverse'].includes(gender)) {
      return NextResponse.json({ data: null, error: 'invalid gender' }, { status: 400 });
    }

    // Upload profile photo if provided
    let uploadedProfilePhotoPath: string | undefined;
    if (profilePhoto) {
      const valid = isValidPhoto(profilePhoto);
      if (!valid.ok) {
        return NextResponse.json({ data: null, error: `profile_photo: ${valid.reason}` }, { status: 400 });
      }
      const photoExt = getFileExtension(profilePhoto.name || '', profilePhoto.type);
      const photoPath = `applications/${id}/profile-photo-${Date.now()}${photoExt}`;
      const buf = await fileToBuffer(profilePhoto);
      const { error: upErr } = await supabaseServer.storage
        .from('therapist-applications')
        .upload(photoPath, buf, { contentType: profilePhoto.type, upsert: false });
      if (upErr) {
        await logError('api.therapists.profile', upErr, { stage: 'upload_profile_photo', therapist_id: id, path: photoPath }, ip, ua);
        return NextResponse.json({ data: null, error: 'Failed to upload profile photo' }, { status: 500 });
      }
      uploadedProfilePhotoPath = photoPath;
    }

    // Prepare metadata merge
    const existingMetaUnknown = (therapist as { metadata?: unknown }).metadata;
    const metaObj: Record<string, unknown> = isObject(existingMetaUnknown) ? (existingMetaUnknown as Record<string, unknown>) : {};
    const profileUnknown = (metaObj as { profile?: unknown }).profile;
    const profile: Record<string, unknown> = isObject(profileUnknown) ? (profileUnknown as Record<string, unknown>) : {};

    if (typeof approachText === 'string') profile.approach_text = approachText;
    if (uploadedProfilePhotoPath) profile.photo_pending_path = uploadedProfilePhotoPath;
    metaObj.profile = profile;

    const updates: Record<string, unknown> = {};
    if (typeof gender === 'string') updates.gender = gender;
    if (typeof city === 'string') updates.city = city;
    if (typeof acceptingNew === 'boolean') updates.accepting_new = acceptingNew;

    const { error: updateErr } = await supabaseServer
      .from('therapists')
      .update({ ...updates, metadata: metaObj })
      .eq('id', id);
    if (updateErr) {
      await logError('api.therapists.profile', updateErr, { stage: 'update_metadata', therapist_id: id }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to update' }, { status: 500 });
    }

    void track({ type: 'therapist_profile_updated', level: 'info', source: 'api.therapists.profile', ip, ua, props: { therapist_id: id, fields: { gender: Boolean(gender), city: Boolean(city), accepting_new: typeof acceptingNew === 'boolean', approach_text: Boolean(approachText), profile_photo: Boolean(uploadedProfilePhotoPath) } } });

    return NextResponse.json({ data: { ok: true, nextStep: `/therapists/upload-documents/${id}` }, error: null });
  } catch (e) {
    await logError('api.therapists.profile', e, { stage: 'exception', therapist_id: id }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
