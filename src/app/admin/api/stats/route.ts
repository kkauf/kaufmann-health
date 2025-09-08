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

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const daysRaw = url.searchParams.get('days') || '7';
    let days = Number.parseInt(daysRaw, 10);
    if (!Number.isFinite(days) || days <= 0) days = 7;
    if (days > 30) days = 30;

    // Build day buckets (UTC) for last N days including today
    const today = startOfDayUTC(new Date());
    const buckets: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      buckets.push(dt.toISOString().slice(0, 10)); // YYYY-MM-DD
    }
    const sinceIso = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();

    // Totals
    const [therapistsRes, clientsRes, matchesTotalRes] = await Promise.all([
      supabaseServer.from('therapists').select('id', { count: 'exact', head: true }),
      supabaseServer.from('people').select('id', { count: 'exact', head: true }).eq('type', 'patient'),
      supabaseServer.from('matches').select('id', { count: 'exact', head: true }),
    ]);

    if (therapistsRes.error || clientsRes.error || matchesTotalRes.error) {
      const err = therapistsRes.error || clientsRes.error || matchesTotalRes.error;
      await logError('admin.api.stats', err, { stage: 'totals' });
      return NextResponse.json({ data: null, error: 'Failed to load totals' }, { status: 500 });
    }

    // Matches per day (last N days)
    const { data: matchesRecent, error: matchesRecentError } = await supabaseServer
      .from('matches')
      .select('created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(5000);

    if (matchesRecentError) {
      await logError('admin.api.stats', matchesRecentError, { stage: 'matches_recent', sinceIso, days });
      return NextResponse.json({ data: null, error: 'Failed to load recent matches' }, { status: 500 });
    }

    const countsMap = new Map<string, number>();
    for (const b of buckets) countsMap.set(b, 0);
    for (const row of matchesRecent || []) {
      const d = new Date(row.created_at as string);
      const key = startOfDayUTC(d).toISOString().slice(0, 10);
      if (countsMap.has(key)) countsMap.set(key, (countsMap.get(key) || 0) + 1);
    }
    const series = buckets.map((date) => ({ date, count: countsMap.get(date) || 0 }));

    const data = {
      totals: {
        therapists: therapistsRes.count || 0,
        clients: clientsRes.count || 0,
        matches: matchesTotalRes.count || 0,
      },
      matchesLastNDays: {
        days,
        series,
      },
    };

    return NextResponse.json({ data, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.stats', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
