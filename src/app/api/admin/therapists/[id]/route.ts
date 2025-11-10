import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistApproval } from '@/lib/email/templates/therapistApproval';
import { renderTherapistRejection } from '@/lib/email/templates/therapistRejection';
import { BASE_URL } from '@/lib/constants';

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

function sameOrigin(req: Request): boolean {
  const host = req.headers.get('host') || '';
  if (!host) return true; // allow server-to-server/test requests
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  if (!origin && !referer) return true; // allow server-to-server/test requests
  const http = `http://${host}`;
  const https = `https://${host}`;
  if (origin === http || origin === https) return true;
  if (referer.startsWith(http + '/')) return true;
  if (referer.startsWith(https + '/')) return true;
  return false;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const { data: row, error } = await supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, email, phone, city, status, metadata, photo_url')
      .eq('id', id)
      .single();
    if (error || !row) {
      await logError('admin.api.therapists.detail', error, { stage: 'fetch', therapist_id: id });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    function isObject(v: unknown): v is Record<string, unknown> {
      return typeof v === 'object' && v !== null;
    }
    const meta = (row as Record<string, unknown>).metadata;
    const metadata = isObject(meta) ? meta : {};
    const profile = isObject((metadata as Record<string, unknown>).profile)
      ? ((metadata as Record<string, unknown>).profile as Record<string, unknown>)
      : {};
    const pendingPath = typeof profile.photo_pending_path === 'string' ? (profile.photo_pending_path as string) : undefined;
    const practiceAddress = typeof profile.practice_address === 'string' ? (profile.practice_address as string) : undefined;
    const approachText = typeof profile.approach_text === 'string'
      ? (profile.approach_text as string)
      : (typeof (row as Record<string, unknown>).approach_text === 'string' ? ((row as Record<string, unknown>).approach_text as string) : undefined);

    let photo_pending_url: string | undefined;
    if (pendingPath) {
      const { data: signed, error: signErr } = await supabaseServer.storage
        .from('therapist-applications')
        .createSignedUrl(pendingPath, 60 * 5);
      if (!signErr && signed?.signedUrl) {
        photo_pending_url = signed.signedUrl;
      }
    }

    // Extract document metadata
    const documents = isObject((metadata as Record<string, unknown>).documents)
      ? ((metadata as Record<string, unknown>).documents as Record<string, unknown>)
      : {};
    const hasLicense = typeof documents.license === 'string' && documents.license.length > 0;
    const specialization = isObject(documents.specialization) ? (documents.specialization as Record<string, unknown>) : {};
    const hasSpecialization = Object.keys(specialization).length > 0;

    const name = [row.first_name || '', row.last_name || ''].join(' ').trim() || null;
    return NextResponse.json({
      data: {
        id: row.id,
        name,
        email: row.email || null,
        phone: row.phone || null,
        city: row.city || null,
        status: row.status || 'pending_verification',
        profile: {
          photo_pending_url,
          approach_text: approachText,
          photo_url: (row as Record<string, unknown>).photo_url || undefined,
          practice_address: practiceAddress,
        },
        documents: {
          has_license: hasLicense,
          has_specialization: hasSpecialization,
        },
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.therapists.detail', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  if (process.env.NODE_ENV === 'production' && !sameOrigin(req)) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

  try {
    const { id } = await ctx.params;
    const payload = await req.json();
    const status = typeof payload.status === 'string' ? payload.status : undefined;
    const verification_notes = typeof payload.verification_notes === 'string' ? payload.verification_notes : undefined;
    const approve_profile = Boolean(payload.approve_profile);
    const approach_text = typeof payload.approach_text === 'string' ? String(payload.approach_text) : undefined;
    let practice_address = typeof payload.practice_address === 'string' ? String(payload.practice_address) : undefined;
    if (!practice_address) {
      try {
        const nested = (payload?.profile?.practice_address as unknown);
        if (typeof nested === 'string') practice_address = nested;
      } catch {}
    }

    if (!status && typeof verification_notes !== 'string' && !approve_profile && typeof approach_text !== 'string' && typeof practice_address !== 'string') {
      return NextResponse.json({ data: null, error: 'Missing fields' }, { status: 400 });
    }
    if (status && !['pending_verification', 'verified', 'rejected'].includes(status)) {
      return NextResponse.json({ data: null, error: 'Invalid status' }, { status: 400 });
    }
    if (approach_text && approach_text.length > 500) {
      return NextResponse.json({ data: null, error: 'approach_text too long (max 500 chars)' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (typeof verification_notes === 'string') update.verification_notes = verification_notes;

    // Load current metadata to optionally update profile info and process photo approval
    const { data: current, error: fetchErr } = await supabaseServer
      .from('therapists')
      .select('metadata, photo_url, status')
      .eq('id', id)
      .single();
    if (fetchErr) {
      await logError('admin.api.therapists.update', fetchErr, { stage: 'fetch', therapist_id: id });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    function isObject(v: unknown): v is Record<string, unknown> {
      return typeof v === 'object' && v !== null;
    }
    const currMeta = isObject(current?.metadata) ? (current!.metadata as Record<string, unknown>) : {};
    const profileMeta = isObject(currMeta.profile) ? (currMeta.profile as Record<string, unknown>) : {};

    if (typeof approach_text === 'string') {
      profileMeta.approach_text = approach_text;
    }
    if (typeof practice_address === 'string') {
      profileMeta.practice_address = practice_address.trim();
    }

    if (approve_profile) {
      const pendingPath = typeof profileMeta.photo_pending_path === 'string' ? (profileMeta.photo_pending_path as string) : undefined;
      if (!pendingPath) {
        return NextResponse.json({ data: null, error: 'No pending profile photo to approve' }, { status: 400 });
      }
      // Download from applications bucket
      const { data: file, error: dlErr } = await supabaseServer.storage
        .from('therapist-applications')
        .download(pendingPath);
      if (dlErr || !file) {
        await logError('admin.api.therapists.update', dlErr, { stage: 'download_profile_photo', path: pendingPath });
        return NextResponse.json({ data: null, error: 'Failed to read pending photo' }, { status: 500 });
      }
      const ab = await file.arrayBuffer();
      const buf = Buffer.from(ab);
      const extMatch = pendingPath.toLowerCase().match(/\.(jpg|jpeg|png)$/);
      const ext = extMatch ? (extMatch[1] === 'jpeg' ? '.jpg' : `.${extMatch[1]}`) : '.jpg';
      const publicBucket = 'therapist-profiles';
      const destPath = `${id}${ext}`;
      const { error: upErr } = await supabaseServer.storage
        .from(publicBucket)
        .upload(destPath, buf, { contentType: ext === '.png' ? 'image/png' : 'image/jpeg', upsert: true });
      if (upErr) {
        await logError('admin.api.therapists.update', upErr, { stage: 'upload_public_photo', dest: destPath });
        return NextResponse.json({ data: null, error: 'Failed to publish photo' }, { status: 500 });
      }
      // Remove pending file (best-effort)
      await supabaseServer.storage.from('therapist-applications').remove([pendingPath]).catch(() => {});

      const { data: pub } = supabaseServer.storage.from(publicBucket).getPublicUrl(destPath);
      const photo_url = pub?.publicUrl;
      if (photo_url) {
        update.photo_url = photo_url;
      }
      // Clear pending path
      delete profileMeta.photo_pending_path;
    }

    const newMeta: Record<string, unknown> = { ...currMeta, profile: profileMeta };
    update.metadata = newMeta;

    const { error } = await supabaseServer
      .from('therapists')
      .update(update)
      .eq('id', id);

    if (error) {
      await logError('admin.api.therapists.update', error, { therapist_id: id });
      return NextResponse.json({ data: null, error: 'Failed to update therapist' }, { status: 500 });
    }

    // Post-update: send emails if status changed to verified or rejected
    try {
      const { data: after } = await supabaseServer
        .from('therapists')
        .select('first_name, last_name, email, status, photo_url')
        .eq('id', id)
        .single();
      const to = (after as { email?: string | null })?.email || undefined;
      const name = [
        (after as { first_name?: string | null })?.first_name || '',
        (after as { last_name?: string | null })?.last_name || '',
      ].join(' ').trim();
      const finalStatus = (after as { status?: string | null })?.status || undefined;
      if (to && finalStatus === 'verified') {
        const visible = Boolean((after as { photo_url?: string | null })?.photo_url);
        const approval = renderTherapistApproval({ name, profileVisible: visible });
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.therapists.update', props: { stage: 'therapist_approval', therapist_id: id, subject: approval.subject } });
        const sent = await sendEmail({ to, subject: approval.subject, html: approval.html, context: { stage: 'therapist_approval', therapist_id: id } });
        if (!sent) {
          await logError('admin.api.therapists.update', new Error('Approval email send failed'), { stage: 'therapist_approval_send_failed', therapist_id: id, email: to });
        }
      } else if (to && finalStatus === 'rejected') {
        const uploadUrl = `${BASE_URL}/therapists/upload-documents/${id}`;
        const rejection = renderTherapistRejection({ name, uploadUrl, adminNotes: verification_notes || null });
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.therapists.update', props: { stage: 'therapist_rejection', therapist_id: id, subject: rejection.subject } });
        const sent = await sendEmail({ to, subject: rejection.subject, html: rejection.html, context: { stage: 'therapist_rejection', therapist_id: id } });
        if (!sent) {
          await logError('admin.api.therapists.update', new Error('Rejection email send failed'), { stage: 'therapist_rejection_send_failed', therapist_id: id, email: to });
        }
      }
    } catch (e) {
      await logError('admin.api.therapists.update', e, { stage: 'send_status_email', therapist_id: id });
    }

    return NextResponse.json({ data: { ok: true }, error: null });
  } catch (e) {
    await logError('admin.api.therapists.update', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
