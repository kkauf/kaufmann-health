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

    // --- Additional datasets ---
    // 1) Funnel conversion by day (events)
    const [leadsEventsRes, selectionsEventsRes, viewedEventsRes] = await Promise.all([
      supabaseServer
        .from('events')
        .select('created_at, properties')
        .eq('type', 'lead_submitted')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true })
        .limit(10000),
      supabaseServer
        .from('events')
        .select('created_at, properties')
        .eq('type', 'patient_selected')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true })
        .limit(10000),
      supabaseServer
        .from('events')
        .select('created_at, properties')
        .eq('type', 'profile_viewed')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true })
        .limit(10000),
    ]);

    const toDayKey = (iso: string) => startOfDayUTC(new Date(iso)).toISOString().slice(0, 10);
    const funnelMap = new Map<string, { leads: Set<string>; viewed: Set<string>; selected: Set<string> }>();
    for (const b of buckets) funnelMap.set(b, { leads: new Set(), viewed: new Set(), selected: new Set() });

    for (const row of (leadsEventsRes.data || [])) {
      try {
        const day = toDayKey(row.created_at as string);
        const props = (row.properties || {}) as Record<string, unknown>;
        const leadId = String((props['id'] as string | undefined) || '');
        if (funnelMap.has(day) && leadId) funnelMap.get(day)!.leads.add(leadId);
      } catch {}
    }
    for (const row of (selectionsEventsRes.data || [])) {
      try {
        const day = toDayKey(row.created_at as string);
        const props = (row.properties || {}) as Record<string, unknown>;
        const patientId = String((props['patient_id'] as string | undefined) || '');
        if (funnelMap.has(day) && patientId) funnelMap.get(day)!.selected.add(patientId);
      } catch {}
    }
    for (const row of (viewedEventsRes.data || [])) {
      try {
        const day = toDayKey(row.created_at as string);
        const props = (row.properties || {}) as Record<string, unknown>;
        const leadId = String((props['id'] as string | undefined) || (props['lead_id'] as string | undefined) || '');
        if (funnelMap.has(day) && leadId) funnelMap.get(day)!.viewed.add(leadId);
      } catch {}
    }
    const funnelByDay = buckets.map((day) => {
      const e = funnelMap.get(day)!;
      return { day, leads: e.leads.size, viewed_profiles: e.viewed.size, selections: e.selected.size };
    });

    // 2) Lead quality breakdown (self-pay signal). We fall back to self_pay_confirmed/declined events.
    const [spcRes, spdRes] = await Promise.all([
      supabaseServer
        .from('events')
        .select('properties')
        .eq('type', 'self_pay_confirmed')
        .gte('created_at', sinceIso)
        .limit(10000),
      supabaseServer
        .from('events')
        .select('properties')
        .eq('type', 'self_pay_declined')
        .gte('created_at', sinceIso)
        .limit(10000),
    ]);
    const spConfirmedSessions = new Set<string>();
    const spDeclinedSessions = new Set<string>();
    for (const row of (spcRes.data || [])) {
      const props = (row.properties || {}) as Record<string, unknown>;
      const sid = String((props['session_id'] as string | undefined) || '') || String((props['id'] as string | undefined) || '');
      if (sid) spConfirmedSessions.add(sid);
    }
    for (const row of (spdRes.data || [])) {
      const props = (row.properties || {}) as Record<string, unknown>;
      const sid = String((props['session_id'] as string | undefined) || '') || String((props['id'] as string | undefined) || '');
      if (sid) spDeclinedSessions.add(sid);
    }
    const leadQuality = [
      { key: 'self_pay_confirmed', count: spConfirmedSessions.size },
      { key: 'self_pay_declined', count: spDeclinedSessions.size },
    ];

    // 3) Response times: time from patient lead_submitted -> first match
    const patientLeads = (leadsEventsRes.data || []).filter((r) => {
      const props = (r.properties || {}) as Record<string, unknown>;
      return String((props['lead_type'] as string | undefined) || '').toLowerCase() === 'patient';
    });
    const leadByPatientId = new Map<string, { created_at: string }>();
    for (const row of patientLeads) {
      const props = (row.properties || {}) as Record<string, unknown>;
      const pid = String((props['id'] as string | undefined) || '');
      if (pid) {
        const t = row.created_at as string;
        // keep earliest for that patient within window
        if (!leadByPatientId.has(pid) || new Date(t) < new Date(leadByPatientId.get(pid)!.created_at)) {
          leadByPatientId.set(pid, { created_at: t });
        }
      }
    }
    const patientIds = Array.from(leadByPatientId.keys());
    let matchesByPatient: Array<{ patient_id: string; created_at: string }> = [];
    if (patientIds.length > 0) {
      // Supabase 'in' has limits; split batches of 300
      const batchSize = 300;
      for (let i = 0; i < patientIds.length; i += batchSize) {
        const batch = patientIds.slice(i, i + batchSize);
        const { data: mBatch, error: mErr } = await supabaseServer
          .from('matches')
          .select('patient_id, created_at')
          .in('patient_id', batch)
          .order('created_at', { ascending: true })
          .limit(10000);
        if (!mErr && Array.isArray(mBatch)) {
          matchesByPatient = matchesByPatient.concat(
            mBatch as Array<{ patient_id: string; created_at: string }>
          );
        }
      }
    }
    const firstMatchMap = new Map<string, string>();
    for (const m of matchesByPatient) {
      const pid = String(m.patient_id);
      const t = String(m.created_at);
      if (!firstMatchMap.has(pid)) firstMatchMap.set(pid, t);
    }
    const bucketsCfg = [
      { key: '0-2h', maxH: 2 },
      { key: '2-8h', maxH: 8 },
      { key: '8-24h', maxH: 24 },
      { key: '1-3d', maxH: 72 },
      { key: '>3d', maxH: Infinity },
    ] as const;
    const responseBuckets = new Map<string, number>();
    for (const b of bucketsCfg) responseBuckets.set(b.key, 0);
    responseBuckets.set('no_match', 0);
    let sumHours = 0;
    let matchedCount = 0;
    for (const [pid, lead] of leadByPatientId.entries()) {
      const leadTs = new Date(lead.created_at).getTime();
      const matchTsStr = firstMatchMap.get(pid);
      if (!matchTsStr) {
        responseBuckets.set('no_match', (responseBuckets.get('no_match') || 0) + 1);
        continue;
      }
      const deltaH = (new Date(matchTsStr).getTime() - leadTs) / (1000 * 60 * 60);
      sumHours += deltaH;
      matchedCount += 1;
      const bucket = bucketsCfg.find((b) => deltaH <= b.maxH)?.key || '>3d';
      responseBuckets.set(bucket, (responseBuckets.get(bucket) || 0) + 1);
    }
    const responseTimes = {
      buckets: Array.from(responseBuckets.entries()).map(([bucket, count]) => ({ bucket, count })),
      avgHours: matchedCount > 0 ? Math.round((sumHours / matchedCount) * 10) / 10 : 0,
    };

    // 4) City patterns (top cities by patient leads)
    const cityCounts = new Map<string, number>();
    for (const row of patientLeads) {
      const props = (row.properties || {}) as Record<string, unknown>;
      const city = String((props['city'] as string | undefined) || '').trim();
      const key = city || 'Unbekannt';
      cityCounts.set(key, (cityCounts.get(key) || 0) + 1);
    }
    const topCities = Array.from(cityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([city, count]) => ({ city, count }));

    // 5) Therapist acceptance rates (last N days)
    const { data: matchesWindow, error: matchesWindowErr } = await supabaseServer
      .from('matches')
      .select('status, created_at')
      .gte('created_at', sinceIso)
      .limit(10000);
    if (matchesWindowErr) {
      await logError('admin.api.stats', matchesWindowErr, { stage: 'matches_window', sinceIso, days });
    }
    let acc = 0;
    let dec = 0;
    for (const m of ((matchesWindow || []) as Array<{ status?: string | null }>)) {
      const s = String(m.status || '').toLowerCase();
      if (s === 'accepted') acc += 1;
      else if (s === 'declined') dec += 1;
    }
    const therapistAcceptance = {
      lastNDays: { accepted: acc, declined: dec, rate: acc + dec > 0 ? Math.round((acc / (acc + dec)) * 1000) / 10 : 0 },
    };

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
      funnelByDay,
      leadQuality,
      responseTimes,
      topCities,
      therapistAcceptance,
    };

    return NextResponse.json({ data, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.stats', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
