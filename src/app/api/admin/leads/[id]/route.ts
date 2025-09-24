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
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const status = String(body?.status || '').trim();
    const lost_reason_raw = typeof body?.lost_reason === 'string' ? body.lost_reason : undefined;
    const lost_reason = lost_reason_raw ? String(lost_reason_raw).slice(0, 500) : undefined;

    // Respect check constraint on public.people.status (new|pending_verification|verified|rejected)
    // For patient leads we only allow switching between 'new' and 'rejected'.
    const allowed = new Set(['new', 'rejected']);
    if (!allowed.has(status)) {
      return NextResponse.json({ data: null, error: 'Invalid status' }, { status: 400 });
    }

    // Ensure the person exists and is a patient lead
    const { data: person, error: pErr } = await supabaseServer
      .from('people')
      .select('id, type, status, metadata')
      .eq('id', id)
      .single();
    if (pErr || !person) {
      await logError('admin.api.leads.update', pErr, { stage: 'load_person', id });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }
    const type = (person as { type?: string | null })?.type || null;
    if (type !== 'patient') {
      return NextResponse.json({ data: null, error: 'Only patient leads can be updated' }, { status: 400 });
    }

    // EARTH-131: Prevent reverting a matched lead back to new via admin UI/API
    const currentStatus = (person as { status?: string | null })?.status || null;
    if (currentStatus === 'matched' && status === 'new') {
      return NextResponse.json({ data: null, error: 'Cannot change matched lead back to new' }, { status: 400 });
    }

    // Merge metadata with optional lost_reason when rejecting
    function isObject(v: unknown): v is Record<string, unknown> {
      return typeof v === 'object' && v !== null && !Array.isArray(v);
    }
    type PersonWithMeta = { metadata?: Record<string, unknown> | null };
    const metaSource = (person as PersonWithMeta).metadata;
    const currentMeta: Record<string, unknown> = isObject(metaSource) ? metaSource : {};
    let nextMeta: Record<string, unknown> | undefined = undefined;
    if (status === 'rejected') {
      const metaUpdate: Record<string, unknown> = { ...currentMeta };
      if (typeof lost_reason === 'string' && lost_reason.trim()) {
        metaUpdate.lost_reason = lost_reason.trim();
        metaUpdate.lost_reason_at = new Date().toISOString();
      }
      nextMeta = metaUpdate;
    } else if (status === 'new') {
      // Optionally clear lost reason when moving back to new
      const metaUpdate: Record<string, unknown> = { ...currentMeta };
      if ('lost_reason' in metaUpdate) delete metaUpdate.lost_reason;
      if ('lost_reason_at' in metaUpdate) delete metaUpdate.lost_reason_at;
      nextMeta = metaUpdate;
    }

    const updatePayload: Record<string, unknown> = { status };
    if (nextMeta) updatePayload.metadata = nextMeta;

    const { error } = await supabaseServer
      .from('people')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      await logError('admin.api.leads.update', error, { stage: 'update', id, status });
      return NextResponse.json({ data: null, error: 'Failed to update lead' }, { status: 500 });
    }

    return NextResponse.json({ data: { id, status }, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.leads.update', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
