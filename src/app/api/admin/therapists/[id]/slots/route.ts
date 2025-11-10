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

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const { data, error } = await supabaseServer
      .from('therapist_slots')
      .select('id, therapist_id, day_of_week, time_local, format, address, duration_minutes, active, created_at')
      .eq('therapist_id', id)
      .order('day_of_week', { ascending: true })
      .order('time_local', { ascending: true });
    if (error) {
      await logError('admin.api.therapists.slots', error, { stage: 'fetch', therapist_id: id });
      return NextResponse.json({ data: null, error: 'Failed to fetch slots' }, { status: 500 });
    }
    return NextResponse.json({ data: (data || []), error: null });
  } catch (e) {
    await logError('admin.api.therapists.slots', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const slots = Array.isArray(body?.slots) ? body.slots : [];
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ data: null, error: 'No slots provided' }, { status: 400 });
    }

    // Fallback address for in_person slots: use therapist-level practice address
    // This keeps compatibility with DBs that still enforce non-empty address for in_person.
    let practiceAddress = '';
    try {
      const { data: t } = await supabaseServer
        .from('therapists')
        .select('metadata')
        .eq('id', id)
        .single();
      const md = (t?.metadata as Record<string, unknown>) || {};
      const prof = (md['profile'] as Record<string, unknown> | undefined) || undefined;
      const pa = typeof prof?.['practice_address'] === 'string' ? (prof['practice_address'] as string) : '';
      practiceAddress = (pa || '').trim();
    } catch {}

    type SlotIn = {
      day_of_week: number;
      time_local: string;
      format: 'online' | 'in_person';
      address?: string;
      duration_minutes?: number;
      active?: boolean;
    };

    function isValidTime(v: string): boolean {
      return typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
    }

    const sanitized: (SlotIn & { therapist_id: string; address: string; duration_minutes: number; active: boolean })[] = [];
    for (const s of slots as SlotIn[]) {
      const dow = Number(s?.day_of_week);
      const fmt = s?.format === 'in_person' ? 'in_person' : 'online';
      const t = String(s?.time_local || '').slice(0, 5);
      const dur = Number.isFinite(Number(s?.duration_minutes)) ? Math.max(30, Math.min(240, Number(s!.duration_minutes))) : 60;
      const act = s?.active === false ? false : true;
      // Use explicit slot address if provided; otherwise fallback to therapist practice address for in_person
      const addr = fmt === 'in_person' ? (String(s?.address || '').trim() || practiceAddress) : '';
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
        return NextResponse.json({ data: null, error: 'Invalid day_of_week' }, { status: 400 });
      }
      if (!isValidTime(t)) {
        return NextResponse.json({ data: null, error: 'Invalid time_local (expected HH:MM)' }, { status: 400 });
      }
      // Address optional for in_person; if empty, therapist-level practice address will be used.
      sanitized.push({ therapist_id: id, day_of_week: dow, time_local: t, format: fmt, address: addr, duration_minutes: dur, active: act });
    }

    const { count } = await supabaseServer
      .from('therapist_slots')
      .select('id', { count: 'exact', head: true })
      .eq('therapist_id', id)
      .eq('active', true);
    const existingActive = typeof count === 'number' ? count : 0;
    const incomingActive = sanitized.filter((s) => s.active).length;
    if (existingActive >= 5 || existingActive + incomingActive > 5) {
      return NextResponse.json({ data: null, error: 'Active slots cap exceeded (max 5)' }, { status: 400 });
    }

    const { error: upErr } = await supabaseServer
      .from('therapist_slots')
      .upsert(sanitized, { ignoreDuplicates: true });

    if (upErr) {
      await logError('admin.api.therapists.slots', upErr, { stage: 'upsert', therapist_id: id });
      return NextResponse.json({ data: null, error: 'Failed to save slots' }, { status: 500 });
    }

    const { data: after, error: fetchErr } = await supabaseServer
      .from('therapist_slots')
      .select('id, therapist_id, day_of_week, time_local, format, address, duration_minutes, active, created_at')
      .eq('therapist_id', id)
      .order('day_of_week', { ascending: true })
      .order('time_local', { ascending: true });
    if (fetchErr) {
      await logError('admin.api.therapists.slots', fetchErr, { stage: 'fetch_after', therapist_id: id });
      return NextResponse.json({ data: null, error: 'Saved but failed to fetch' }, { status: 500 });
    }

    return NextResponse.json({ data: after || [], error: null });
  } catch (e) {
    await logError('admin.api.therapists.slots', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
