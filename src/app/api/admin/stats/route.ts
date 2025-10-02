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

// Helper to normalize an ISO timestamp to YYYY-MM-DD (UTC)
function toDayKey(iso: string) {
  return startOfDayUTC(new Date(iso)).toISOString().slice(0, 10);
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
      supabaseServer
        .from('therapists')
        .select('id', { count: 'exact', head: true })
        .not('metadata->>is_test', 'eq', 'true'),
      supabaseServer
        .from('people')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'patient')
        .not('metadata->>is_test', 'eq', 'true'),
      supabaseServer.from('matches').select('id', { count: 'exact', head: true }),
    ]);
    // Be resilient: log but continue with defaults
    if (therapistsRes.error || clientsRes.error || matchesTotalRes.error) {
      const err = therapistsRes.error || clientsRes.error || matchesTotalRes.error;
      await logError('admin.api.stats', err, { stage: 'totals' });
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
    }

    const countsMap = new Map<string, number>();
    for (const b of buckets) countsMap.set(b, 0);
    const recentRows = matchesRecentError ? [] : (matchesRecent || []);
    for (const row of recentRows) {
      const d = new Date(row.created_at as string);
      const key = startOfDayUTC(d).toISOString().slice(0, 10);
      if (countsMap.has(key)) countsMap.set(key, (countsMap.get(key) || 0) + 1);
    }
    const series = buckets.map((date) => ({ date, count: countsMap.get(date) || 0 }));

    // --- Additional datasets (hardened with fallbacks) ---
    // Defaults
    let funnelByDay: Array<{ day: string; leads: number; viewed_profiles: number; selections: number }> = buckets.map((day) => ({ day, leads: 0, viewed_profiles: 0, selections: 0 }));
    let leadQuality: Array<{ key: string; count: number }> = [
      { key: 'self_pay_confirmed', count: 0 },
      { key: 'self_pay_declined', count: 0 },
    ];
    let responseTimes: { buckets: Array<{ bucket: string; count: number }>; avgHours: number } = { buckets: [], avgHours: 0 };
    let topCities: Array<{ city: string; count: number }> = [];
    let therapistAcceptance: { lastNDays: { accepted: number; declined: number; rate: number } } = { lastNDays: { accepted: 0, declined: 0, rate: 0 } };

    try {
      // 1) Funnel conversion by day (events)
      const [leadsEventsRes, selectionsEventsRes, viewedEventsRes] = await Promise.all([
        supabaseServer
          .from('events')
          .select('created_at, properties')
          .eq('type', 'lead_submitted')
          .not('properties->>is_test', 'eq', 'true')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: true })
          .limit(10000),
        supabaseServer
          .from('events')
          .select('created_at, properties')
          .eq('type', 'patient_selected')
          .not('properties->>is_test', 'eq', 'true')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: true })
          .limit(10000),
        supabaseServer
          .from('events')
          .select('created_at, properties')
          .eq('type', 'profile_viewed')
          .not('properties->>is_test', 'eq', 'true')
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
      funnelByDay = buckets.map((day) => {
        const e = funnelMap.get(day)!;
        return { day, leads: e.leads.size, viewed_profiles: e.viewed.size, selections: e.selected.size };
      });

      // 2) Lead quality breakdown (self-pay signal)
      const [spcRes, spdRes] = await Promise.all([
        supabaseServer
          .from('events')
          .select('properties')
          .eq('type', 'self_pay_confirmed')
          .not('properties->>is_test', 'eq', 'true')
          .gte('created_at', sinceIso)
          .limit(10000),
        supabaseServer
          .from('events')
          .select('properties')
          .eq('type', 'self_pay_declined')
          .not('properties->>is_test', 'eq', 'true')
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
      leadQuality = [
        { key: 'self_pay_confirmed', count: spConfirmedSessions.size },
        { key: 'self_pay_declined', count: spDeclinedSessions.size },
      ];

      // 3) Response times
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
          if (!leadByPatientId.has(pid) || new Date(t) < new Date(leadByPatientId.get(pid)!.created_at)) {
            leadByPatientId.set(pid, { created_at: t });
          }
        }
      }
      const patientIds = Array.from(leadByPatientId.keys());
      let matchesByPatient: Array<{ patient_id: string; created_at: string }> = [];
      if (patientIds.length > 0) {
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
            matchesByPatient = matchesByPatient.concat(mBatch as Array<{ patient_id: string; created_at: string }>);
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
      responseTimes = {
        buckets: Array.from(responseBuckets.entries()).map(([bucket, count]) => ({ bucket, count })),
        avgHours: matchedCount > 0 ? Math.round((sumHours / matchedCount) * 10) / 10 : 0,
      };

      // 4) City patterns (top cities)
      const cityCounts = new Map<string, number>();
      for (const row of patientLeads) {
        const props = (row.properties || {}) as Record<string, unknown>;
        const city = String((props['city'] as string | undefined) || '').trim();
        const key = city || 'Unbekannt';
        cityCounts.set(key, (cityCounts.get(key) || 0) + 1);
      }
      topCities = Array.from(cityCounts.entries())
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
      therapistAcceptance = {
        lastNDays: { accepted: acc, declined: dec, rate: acc + dec > 0 ? Math.round((acc / (acc + dec)) * 1000) / 10 : 0 },
      };
    } catch (e) {
      // Swallow optional dataset errors; leave defaults
      await logError('admin.api.stats', e, { stage: 'optional_datasets' });
    }

    // --- Pre-signup: Wizard funnel + FAQ engagement ---
    let preSignup: {
      wizardFunnel: { page_views: number; step1: number; step2: number; step3: number; step4: number; step5: number; form_completed: number; start_rate: number };
      faqClicks: Array<{ title: string; count: number }>;
    } = {
      wizardFunnel: { page_views: 0, step1: 0, step2: 0, step3: 0, step4: 0, step5: 0, form_completed: 0, start_rate: 0 },
      faqClicks: [],
    };
    try {
      // Wizard steps: unique sessions per step using client session_id
      const { data: stepEvents, error: stepErr } = await supabaseServer
        .from('events')
        .select('created_at, properties')
        .eq('type', 'screen_viewed')
        .gte('created_at', sinceIso)
        .limit(20000);
      if (!stepErr && Array.isArray(stepEvents)) {
        const sessionsByStep = {
          1: new Set<string>(),
          2: new Set<string>(),
          3: new Set<string>(),
          4: new Set<string>(),
          5: new Set<string>(),
        } as const;
        for (const row of stepEvents as Array<{ properties?: Record<string, unknown> }>) {
          try {
            const props = (row.properties || {}) as Record<string, unknown>;
            const sid = String((props['session_id'] as string | undefined) || '').trim();
            const stepRaw = String((props['step'] as string | number | undefined) ?? '');
            const stepNum = Number(stepRaw);
            if (sid && [1, 2, 3, 4, 5].includes(stepNum)) {
              // @ts-expect-error narrowed by includes
              sessionsByStep[stepNum].add(sid);
            }
          } catch {}
        }
        preSignup.wizardFunnel.step1 = sessionsByStep[1].size;
        preSignup.wizardFunnel.step2 = sessionsByStep[2].size;
        preSignup.wizardFunnel.step3 = sessionsByStep[3].size;
        preSignup.wizardFunnel.step4 = sessionsByStep[4].size;
        preSignup.wizardFunnel.step5 = sessionsByStep[5].size;
      }

      // Page views: unique sessions with page_view in window
      try {
        const { data: pvEvents } = await supabaseServer
          .from('events')
          .select('properties')
          .eq('type', 'page_view')
          .gte('created_at', sinceIso)
          .limit(50000);
        const pvSessions = new Set<string>();
        for (const row of (pvEvents || []) as Array<{ properties?: Record<string, unknown> }>) {
          try {
            const props = (row.properties || {}) as Record<string, unknown>;
            const sid = String((props['session_id'] as string | undefined) || '').trim();
            if (sid) pvSessions.add(sid);
          } catch {}
        }
        preSignup.wizardFunnel.page_views = pvSessions.size;
      } catch {}

      // Form completed: count via people.metadata.form_completed_at within window (patients only, exclude tests)
      try {
        const completedRes = await supabaseServer
          .from('people')
          .select('id', { count: 'exact', head: true })
          .eq('type', 'patient')
          .not('metadata->>is_test', 'eq', 'true')
          .gte('metadata->>form_completed_at', sinceIso);
        preSignup.wizardFunnel.form_completed = completedRes.error ? 0 : (completedRes.count || 0);
      } catch {}

      // Start rate: step1 unique sessions over page_view unique sessions
      try {
        const den = preSignup.wizardFunnel.page_views;
        const num = preSignup.wizardFunnel.step1;
        preSignup.wizardFunnel.start_rate = den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
      } catch {}

      // FAQ clicks: aggregate last N days by title
      const { data: faqEvents, error: faqErr } = await supabaseServer
        .from('events')
        .select('created_at, properties')
        .eq('type', 'faq_open')
        .gte('created_at', sinceIso)
        .limit(10000);
      if (!faqErr && Array.isArray(faqEvents)) {
        const map = new Map<string, number>();
        for (const row of faqEvents as Array<{ properties?: Record<string, unknown> }>) {
          try {
            const props = (row.properties || {}) as Record<string, unknown>;
            const title = String((props['title'] as string | undefined) || '').trim() || 'Unbekannt';
            map.set(title, (map.get(title) || 0) + 1);
          } catch {}
        }
        preSignup.faqClicks = Array.from(map.entries())
          .map(([title, count]) => ({ title, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);
      }
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'pre_signup' });
    }

    // --- Post-signup: last-7 signups and client funnel ---
    let postSignup: {
      last7: { clients_new: number; therapists_new: number };
      clientFunnel: { pre_confirmation: number; new: number; selected: number; session_booked: number };
    } = { last7: { clients_new: 0, therapists_new: 0 }, clientFunnel: { pre_confirmation: 0, new: 0, selected: 0, session_booked: 0 } };
    try {
      // Clients with status 'new' transitioned within window (use email_confirmed_at as transition marker)
      const clientsNewRes = await supabaseServer
        .from('people')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'patient')
        .eq('status', 'new')
        .not('metadata->>is_test', 'eq', 'true')
        .gte('metadata->>email_confirmed_at', sinceIso);
      postSignup.last7.clients_new = clientsNewRes.error ? 0 : (clientsNewRes.count || 0);

      // Therapists created within window (exclude tests where possible)
      const therapistsNewRes = await supabaseServer
        .from('therapists')
        .select('id', { count: 'exact', head: true })
        .not('metadata->>is_test', 'eq', 'true')
        .gte('created_at', sinceIso);
      postSignup.last7.therapists_new = therapistsNewRes.error ? 0 : (therapistsNewRes.count || 0);

      // Client funnel steps within window
      const preConfRes = await supabaseServer
        .from('people')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'patient')
        .eq('status', 'pre_confirmation')
        .not('metadata->>is_test', 'eq', 'true')
        .gte('created_at', sinceIso);
      postSignup.clientFunnel.pre_confirmation = preConfRes.error ? 0 : (preConfRes.count || 0);

      const newRes = await supabaseServer
        .from('people')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'patient')
        .eq('status', 'new')
        .not('metadata->>is_test', 'eq', 'true')
        .gte('metadata->>email_confirmed_at', sinceIso);
      postSignup.clientFunnel.new = newRes.error ? 0 : (newRes.count || 0);

      // Therapist selected: unique patients in patient_selected events within window
      try {
        const { data: selEv, error: selErr } = await supabaseServer
          .from('events')
          .select('created_at, properties')
          .eq('type', 'patient_selected')
          .gte('created_at', sinceIso)
          .limit(20000);
        if (!selErr && Array.isArray(selEv)) {
          const patients = new Set<string>();
          for (const row of selEv as Array<{ properties?: Record<string, unknown> }>) {
            try {
              const props = (row.properties || {}) as Record<string, unknown>;
              const pid = String((props['patient_id'] as string | undefined) || '').trim();
              if (pid) patients.add(pid);
            } catch {}
          }
          postSignup.clientFunnel.selected = patients.size;
        }
      } catch {}

      // Session booked: prefer patient_confirmed_at timestamp if present; fallback to created_at
      let sessionBooked = 0;
      try {
        const { data: sbRows, error: sbErr } = await supabaseServer
          .from('matches')
          .select('id, status, patient_confirmed_at, created_at')
          .in('status', ['session_booked', 'completed'])
          .gte('patient_confirmed_at', sinceIso)
          .limit(20000);
        if (!sbErr && Array.isArray(sbRows)) {
          sessionBooked = (sbRows as unknown[]).length;
        } else {
          // Fallback: filter by created_at when patient_confirmed_at not available
          const { data: sbRows2 } = await supabaseServer
            .from('matches')
            .select('id, status, created_at')
            .in('status', ['session_booked', 'completed'])
            .gte('created_at', sinceIso)
            .limit(20000);
          sessionBooked = Array.isArray(sbRows2) ? (sbRows2 as unknown[]).length : 0;
        }
      } catch {
        // Final fallback: 0
      }
      postSignup.clientFunnel.session_booked = sessionBooked;
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'post_signup' });
    }

    // 6) Campaign performance (patient leads with campaign attribution)
    type PeopleRow = { status?: string | null; campaign_source?: string | null; campaign_variant?: string | null };
    const { data: peopleRows, error: peopleErr } = await supabaseServer
      .from('people')
      .select('status, campaign_source, campaign_variant, type, created_at')
      .eq('type', 'patient')
      .not('campaign_source', 'is', null)
      .not('metadata->>is_test', 'eq', 'true')
      .gte('created_at', sinceIso)
      .limit(50000);
    if (peopleErr) {
      await logError('admin.api.stats', peopleErr, { stage: 'campaign_stats', sinceIso, days });
    }
    const cmap = new Map<string, { campaign_source: string; campaign_variant: string; leads: number; confirmed: number }>();
    for (const row of ((peopleRows || []) as Array<PeopleRow>)) {
      const src = String(row.campaign_source || '').trim();
      const vRaw = String(row.campaign_variant || '').toUpperCase();
      const v = vRaw === 'B' ? 'B' : vRaw === 'C' ? 'C' : 'A';
      if (!src) continue;
      const key = `${src}__${v}`;
      if (!cmap.has(key)) cmap.set(key, { campaign_source: src, campaign_variant: v, leads: 0, confirmed: 0 });
      const agg = cmap.get(key)!;
      agg.leads += 1;
      if (String(row.status || '') !== 'pre_confirmation') agg.confirmed += 1;
    }
    const campaignStats = Array.from(cmap.values())
      .sort((a, b) => b.leads - a.leads)
      .map((r) => ({
        ...r,
        confirmation_rate: r.leads > 0 ? Math.round((r.confirmed / r.leads) * 1000) / 10 : 0,
      }));

    // 6b) Daily campaign breakdown
    const dailyMap = new Map<string, { day: string; campaign_source: string; campaign_variant: string; leads: number; confirmed: number }>();
    for (const row of ((peopleRows || []) as Array<PeopleRow & { created_at?: string }>)) {
      const src = String(row.campaign_source || '').trim();
      const vRaw = String(row.campaign_variant || '').toUpperCase();
      const v = vRaw === 'B' ? 'B' : vRaw === 'C' ? 'C' : 'A';
      if (!src) continue;
      const createdAtIso = (row as { created_at?: string }).created_at ?? new Date().toISOString();
      const day = toDayKey(createdAtIso);
      const key = `${day}__${src}__${v}`;
      if (!dailyMap.has(key)) dailyMap.set(key, { day, campaign_source: src, campaign_variant: v, leads: 0, confirmed: 0 });
      const agg = dailyMap.get(key)!;
      agg.leads += 1;
      if (String(row.status || '') !== 'pre_confirmation') agg.confirmed += 1;
    }
    const campaignByDay = Array.from(dailyMap.values())
      .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.campaign_source.localeCompare(b.campaign_source) || a.campaign_variant.localeCompare(b.campaign_variant)))
      .map((r) => ({
        ...r,
        confirmation_rate: r.leads > 0 ? Math.round((r.confirmed / r.leads) * 1000) / 10 : 0,
      }));

    // 7) Session blockers breakdown (last 30 days)
    let breakdown: Array<{ reason: string; count: number; percentage: number }> = [];
    try {
      const since30Iso = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString();
      const { data: blockersRows, error: blockersErr } = await supabaseServer
        .from('session_blockers')
        .select('reason, created_at')
        .gte('created_at', since30Iso)
        .limit(10000);
      if (blockersErr) {
        await logError('admin.api.stats', blockersErr, { stage: 'blockers', since30Iso });
      }
      const reasonCounts = new Map<string, number>();
      let totalBlockers = 0;
      for (const row of (blockersRows || []) as Array<{ reason?: string | null }>) {
        const r = String(row.reason || '').toLowerCase();
        if (!r) continue;
        reasonCounts.set(r, (reasonCounts.get(r) || 0) + 1);
        totalBlockers += 1;
      }
      breakdown = Array.from(reasonCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => ({ reason, count, percentage: totalBlockers > 0 ? Math.round((count * 1000) / totalBlockers) / 10 : 0 }));
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'blockers_optional' });
    }

    // Compute blockers total from breakdown as a safe fallback
    const blockersTotal = Array.isArray(breakdown) ? breakdown.reduce((sum, b) => sum + (b.count || 0), 0) : 0;

    const data = {
      totals: {
        therapists: therapistsRes.error ? 0 : (therapistsRes.count || 0),
        clients: clientsRes.error ? 0 : (clientsRes.count || 0),
        matches: matchesTotalRes.error ? 0 : (matchesTotalRes.count || 0),
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
      // Campaign performance (patient leads with campaign attribution)
      campaignStats: campaignStats,
      campaignByDay,
      preSignup,
      postSignup,
      blockers: {
        last30Days: {
          total: blockersTotal,
          breakdown,
        },
      },
    };

    return NextResponse.json({ data, error: null }, { status: 200 });
  } catch (e) {
    // Best-effort fallback: try to at least return campaign aggregates so the dashboard remains usable
    try {
      await logError('admin.api.stats', e, { stage: 'exception' });
      const url = new URL(req.url);
      const daysRaw = url.searchParams.get('days') || '7';
      let days = Number.parseInt(daysRaw, 10);
      if (!Number.isFinite(days) || days <= 0) days = 7;
      if (days > 30) days = 30;
      const today = startOfDayUTC(new Date());
      const sinceIso = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();

      type PeopleRow = { status?: string | null; campaign_source?: string | null; campaign_variant?: string | null };
      const { data: peopleRows } = await supabaseServer
        .from('people')
        .select('status, campaign_source, campaign_variant, type, created_at')
        .eq('type', 'patient')
        .not('campaign_source', 'is', null)
        .not('metadata->>is_test', 'eq', 'true')
        .gte('created_at', sinceIso)
        .limit(50000);

      const cmap = new Map<string, { campaign_source: string; campaign_variant: string; leads: number; confirmed: number }>();
      for (const row of ((peopleRows || []) as Array<PeopleRow>)) {
        const src = String(row.campaign_source || '').trim();
        const vRaw = String(row.campaign_variant || '').toUpperCase();
        const v = vRaw === 'B' ? 'B' : vRaw === 'C' ? 'C' : 'A';
        if (!src) continue;
        const key = `${src}__${v}`;
        if (!cmap.has(key)) cmap.set(key, { campaign_source: src, campaign_variant: v, leads: 0, confirmed: 0 });
        const agg = cmap.get(key)!;
        agg.leads += 1;
        if (String(row.status || '') !== 'pre_confirmation') agg.confirmed += 1;
      }
      const campaignStats = Array.from(cmap.values())
        .sort((a, b) => b.leads - a.leads)
        .map((r) => ({
          ...r,
          confirmation_rate: r.leads > 0 ? Math.round((r.confirmed / r.leads) * 1000) / 10 : 0,
        }));

      const toDayKey = (iso: string) => startOfDayUTC(new Date(iso)).toISOString().slice(0, 10);
      const dailyMap = new Map<string, { day: string; campaign_source: string; campaign_variant: string; leads: number; confirmed: number }>();
      for (const row of ((peopleRows || []) as Array<PeopleRow & { created_at?: string }>)) {
        const src = String(row.campaign_source || '').trim();
        const vRaw = String(row.campaign_variant || '').toUpperCase();
        const v = vRaw === 'B' ? 'B' : vRaw === 'C' ? 'C' : 'A';
        if (!src) continue;
        const createdAtIso = (row as { created_at?: string }).created_at ?? new Date().toISOString();
        const day = toDayKey(createdAtIso);
        const key = `${day}__${src}__${v}`;
        if (!dailyMap.has(key)) dailyMap.set(key, { day, campaign_source: src, campaign_variant: v, leads: 0, confirmed: 0 });
        const agg = dailyMap.get(key)!;
        agg.leads += 1;
        if (String(row.status || '') !== 'pre_confirmation') agg.confirmed += 1;
      }
      const campaignByDay = Array.from(dailyMap.values())
        .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.campaign_source.localeCompare(b.campaign_source) || a.campaign_variant.localeCompare(b.campaign_variant)))
        .map((r) => ({
          ...r,
          confirmation_rate: r.leads > 0 ? Math.round((r.confirmed / r.leads) * 1000) / 10 : 0,
        }));

      const data = {
        totals: { therapists: 0, clients: 0, matches: 0 },
        matchesLastNDays: { days, series: [] as Array<{ date: string; count: number }> },
        funnelByDay: [] as Array<{ day: string; leads: number; viewed_profiles: number; selections: number }>,
        leadQuality: [] as Array<{ key: string; count: number }>,
        responseTimes: { buckets: [] as Array<{ bucket: string; count: number }>, avgHours: 0 },
        topCities: [] as Array<{ city: string; count: number }>,
        therapistAcceptance: { lastNDays: { accepted: 0, declined: 0, rate: 0 } },
        campaignStats,
        campaignByDay,
        blockers: { last30Days: { total: 0, breakdown: [] as Array<{ reason: string; count: number; percentage: number }> } },
      };
      return NextResponse.json({ data, error: null }, { status: 200 });
    } catch (secondary) {
      await logError('admin.api.stats', secondary, { stage: 'exception_fallback' });
      return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
    }
  }
}
