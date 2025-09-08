import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError } from '@/lib/logger';

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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const payload = await req.json();
    const status = typeof payload.status === 'string' ? payload.status : undefined;
    const verification_notes = typeof payload.verification_notes === 'string' ? payload.verification_notes : undefined;

    if (!status && typeof verification_notes !== 'string') {
      return NextResponse.json({ data: null, error: 'Missing fields' }, { status: 400 });
    }
    if (status && !['pending_verification', 'verified', 'rejected'].includes(status)) {
      return NextResponse.json({ data: null, error: 'Invalid status' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (typeof verification_notes === 'string') update.verification_notes = verification_notes;

    const { error } = await supabaseServer
      .from('therapists')
      .update(update)
      .eq('id', id);

    if (error) {
      await logError('admin.api.therapists.update', error, { therapist_id: id });
      return NextResponse.json({ data: null, error: 'Failed to update therapist' }, { status: 500 });
    }

    return NextResponse.json({ data: { ok: true }, error: null });
  } catch (e) {
    await logError('admin.api.therapists.update', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
