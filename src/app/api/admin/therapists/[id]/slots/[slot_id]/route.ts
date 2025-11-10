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

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; slot_id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, slot_id } = await ctx.params;
    if (!slot_id) {
      return NextResponse.json({ data: null, error: 'Missing slot_id' }, { status: 400 });
    }
    const { error } = await supabaseServer
      .from('therapist_slots')
      .delete()
      .eq('id', slot_id)
      .eq('therapist_id', id);
    if (error) {
      await logError('admin.api.therapists.slots.delete', error, { therapist_id: id, slot_id });
      return NextResponse.json({ data: null, error: 'Failed to delete slot' }, { status: 500 });
    }
    return NextResponse.json({ data: { ok: true }, error: null });
  } catch (e) {
    await logError('admin.api.therapists.slots.delete', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
