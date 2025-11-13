import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';

export const runtime = 'nodejs';

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

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const daysRaw = url.searchParams.get('days') || '30';
    let days = Number.parseInt(daysRaw, 10);
    if (!Number.isFinite(days) || days <= 0) days = 30;
    if (days > 90) days = 90;

    const today = startOfDayUTC(new Date());
    const sinceIso = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();

    const { data: fsRows } = await supabaseServer
      .from('form_sessions')
      .select('data, updated_at')
      .gte('updated_at', sinceIso)
      .order('updated_at', { ascending: false })
      .limit(50000);

    const cm = new Map<string, number>();
    const sp = new Map<string, number>();
    const ok = new Map<string, number>();
    const mm = new Map<string, number>();
    const st = new Map<string, number>();
    const ts = new Map<string, number>();
    const gd = new Map<string, number>();
    const mt = new Map<string, number>();
    const steps = new Map<string, number>();

    const add = (map: Map<string, number>, key?: string | null) => {
      const k = (key || '').trim();
      if (!k) return;
      map.set(k, (map.get(k) || 0) + 1);
    };
    // no budget bucketing or therapy experience in direct booking flow

    let total = 0;
    for (const row of (fsRows || []) as Array<{ data?: unknown }>) {
      try {
        const d = (row.data || {}) as Record<string, unknown>;
        const name = String((d['name'] as string | undefined) || '').toLowerCase();
        if (name.includes('konstantin')) continue; // filter test entries
        total++;
        add(cm, (d['contact_method'] as string | undefined) || undefined);
        add(sp, (d['session_preference'] as string | undefined) || undefined);
        let okVal: string | undefined;
        if (typeof d['online_ok'] === 'boolean') {
          okVal = (d['online_ok'] as boolean) ? 'true' : 'false';
        } else {
          const pref = String((d['session_preference'] as string | undefined) || '').toLowerCase().trim();
          if (pref === 'online' || pref === 'either') okVal = 'true';
          else if (pref === 'in_person') okVal = 'false';
          else okVal = 'unknown';
        }
        add(ok, okVal);
        add(mm, typeof d['modality_matters'] === 'boolean' ? ((d['modality_matters'] as boolean) ? 'true' : 'false') : undefined);
        add(st, (d['start_timing'] as string | undefined) || undefined);
        // Aggregate preferred time slots (array of strings)
        const timeSlots = Array.isArray(d['time_slots']) ? (d['time_slots'] as unknown[]) : [];
        for (const t of timeSlots) {
          const v = String(t || '').trim();
          if (!v) continue;
          ts.set(v, (ts.get(v) || 0) + 1);
        }
        add(gd, (d['gender'] as string | undefined) || undefined);
        add(steps, String((d['step'] as string | number | undefined) || ''));
        const methods = Array.isArray(d['methods']) ? (d['methods'] as unknown[]) : [];
        for (const m of methods) {
          const v = String(m || '').trim();
          if (!v) continue;
          mt.set(v, (mt.get(v) || 0) + 1);
        }
      } catch {}
    }

    const K = 3; // k-anonymity threshold
    const toKAnonArr = (map: Map<string, number>) => {
      let other = 0;
      const arr = Array.from(map.entries())
        .map(([option, count]) => ({ option: option || 'unknown', count }))
        .sort((a, b) => b.count - a.count);
      const kept = [] as Array<{ option: string; count: number }>;
      for (const item of arr) {
        if (item.count < K) other += item.count;
        else kept.push(item);
      }
      if (other > 0) kept.push({ option: 'other(<3)', count: other });
      return kept;
    };

    // Build CSV
    const lines: string[] = [];
    const addSection = (title: string, items: Array<{ option: string; count: number }>) => {
      lines.push(`Category,Option,Count`);
      for (const it of items) lines.push(`${title},"${it.option.replaceAll('"', '""')}",${it.count}`);
      lines.push('');
    };

    lines.push(`Meta,TotalSessions,${total}`);
    lines.push('');
    addSection('contact_method', toKAnonArr(cm));
    addSection('session_preference', toKAnonArr(sp));
    addSection('online_ok', toKAnonArr(ok));
    addSection('modality_matters', toKAnonArr(mm));
    addSection('start_timing', toKAnonArr(st));
    addSection('time_slots', toKAnonArr(ts));
    addSection('gender', toKAnonArr(gd));
    addSection('methods', toKAnonArr(mt));
    addSection('step', toKAnonArr(steps));

    const csv = lines.join('\n');
    const resp = new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="questionnaire_insights.csv"',
        'Cache-Control': 'no-store',
      },
    });
    return resp;
  } catch (e) {
    return new NextResponse('Unexpected error', { status: 500 });
  }
}
