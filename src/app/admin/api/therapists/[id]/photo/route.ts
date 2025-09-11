import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k && typeof v === 'string') map.set(k, decodeURIComponent(v));
  }
  return map;
}

async function assertAdmin(req: Request): Promise<boolean> {
  try {
    const header = req.headers.get('cookie');
    const token = parseCookie(header).get(ADMIN_SESSION_COOKIE);
    if (!token) return false;
    return await verifySessionToken(token);
  } catch {
    return false;
  }
}

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

function getFileExtension(fileName: string, contentType: string): string {
  if (contentType === 'image/jpeg') return '.jpg';
  if (contentType === 'image/png') return '.png';
  const m = fileName.match(/\.([a-zA-Z0-9]+)$/);
  return m ? `.${m[1].toLowerCase()}` : '';
}

async function fileToBuffer(file: File): Promise<Buffer> {
  const ab = await file.arrayBuffer();
  return Buffer.from(ab);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ data: null, error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const form = await req.formData();
    const photo = form.get('profile_photo');
    if (!(photo instanceof File) || photo.size === 0) {
      return NextResponse.json({ data: null, error: 'profile_photo is required' }, { status: 400 });
    }
    if (!ALLOWED_PHOTO_TYPES.has(photo.type)) {
      return NextResponse.json({ data: null, error: 'Unsupported file type (JPEG/PNG only)' }, { status: 400 });
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ data: null, error: 'File too large (max 5MB)' }, { status: 400 });
    }

    // Upload directly to public profiles bucket
    const ext = getFileExtension(photo.name || '', photo.type);
    const path = `${id}${ext || '.jpg'}`;
    const buf = await fileToBuffer(photo);

    const { error: upErr } = await supabaseServer.storage
      .from('therapist-profiles')
      .upload(path, buf, { contentType: photo.type, upsert: true });
    if (upErr) {
      await logError('admin.api.therapists.photo', upErr, { stage: 'upload_public_photo', therapist_id: id, path });
      return NextResponse.json({ data: null, error: 'Failed to upload photo' }, { status: 500 });
    }

    const { data: pub } = supabaseServer.storage.from('therapist-profiles').getPublicUrl(path);
    const photo_url = pub?.publicUrl;

    const updates: Record<string, unknown> = { photo_url };
    // Best-effort: clear pending path in metadata.profile if it exists
    try {
      const { data: current } = await supabaseServer
        .from('therapists')
        .select('metadata')
        .eq('id', id)
        .single();
      const meta = (current as { metadata?: unknown })?.metadata;
      if (meta && typeof meta === 'object' && meta !== null) {
        const m = meta as Record<string, unknown>;
        const p = typeof m.profile === 'object' && m.profile !== null ? (m.profile as Record<string, unknown>) : {};
        if (typeof p.photo_pending_path === 'string') {
          delete p.photo_pending_path;
          updates['metadata'] = { ...m, profile: p };
        }
      }
    } catch {}

    const { error: dbErr } = await supabaseServer
      .from('therapists')
      .update(updates)
      .eq('id', id);
    if (dbErr) {
      await logError('admin.api.therapists.photo', dbErr, { stage: 'update_row', therapist_id: id, path });
      return NextResponse.json({ data: null, error: 'Failed to update therapist' }, { status: 500 });
    }

    void track({ type: 'admin_profile_photo_uploaded', level: 'info', source: 'admin.api.therapists.photo', props: { therapist_id: id, ext } });

    return NextResponse.json({ data: { ok: true, photo_url }, error: null });
  } catch (e) {
    await logError('admin.api.therapists.photo', e, { stage: 'exception', therapist_id: id });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
