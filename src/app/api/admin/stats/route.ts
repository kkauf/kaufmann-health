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

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function toDayKey(iso: string): string {
  return startOfDayUTC(new Date(iso)).toISOString().slice(0, 10);
}

type StatsResponse = {
  totals: {
    therapists: number;
    clients: number;
    matches: number;
  };
  pageTraffic: {
    top: Array<{ page_path: string; sessions: number }>;
    daily: Array<{ day: string; page_path: string; sessions: number }>;
  };
  wizardFunnel: {
    page_views: number;
    steps: Record<number, number>; // step number => unique sessions
    form_completed: number;
    start_rate: number;
  };
  wizardDropoffs: Array<{
    step: number;
    from: number;
    to: number;
    drop: number;
    drop_rate: number;
  }>;
  abandonFieldsTop: Array<{ field: string; count: number }>;
  directory: {
    views: number;
    helpClicks: number;
    navClicks: number;
    contactOpened: number;
    contactSent: number;
  };
  journeyAnalysis: {
    fragebogen_only: number;
    therapeuten_only: number;
    both_fragebogen_first: number;
    both_therapeuten_first: number;
    neither: number;
    total_sessions: number;
    questionnaire_preference_rate: number;
    directory_to_questionnaire_rate: number;
  };
};

export async function GET(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const daysRaw = url.searchParams.get('days') || '30';
    let days = Number.parseInt(daysRaw, 10);
    if (!Number.isFinite(days) || days <= 0) days = 30;
    if (days > 90) days = 90;

    const today = startOfDayUTC(new Date());
    const sinceIso = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();

    // Optional funnel-only override (?since=YYYY-MM-DD) to filter wizard funnel data
    const sinceParam = url.searchParams.get('since');
    let funnelSinceIso = sinceIso;
    if (sinceParam) {
      try {
        // Accept YYYY-MM-DD or ISO; clamp to not be in the future
        const d = new Date(sinceParam);
        if (!Number.isNaN(d.getTime())) {
          const dUtc = startOfDayUTC(d);
          funnelSinceIso = (dUtc > today ? today : dUtc).toISOString();
        }
      } catch {}
    }

    // === TOTALS ===
    // Note: Queries ALL records (not filtered by time window) to show lifetime totals
    // Test filter: only exclude if metadata.is_test explicitly = 'true' (allow NULL/missing)
    const [therapistsRes, clientsRes, matchesRes] = await Promise.all([
      supabaseServer
        .from('therapists')
        .select('id', { count: 'exact', head: true }),
      supabaseServer
        .from('people')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'patient'),
      supabaseServer
        .from('matches')
        .select('id', { count: 'exact', head: true }),
    ]);

    // Log errors for debugging
    if (therapistsRes.error) {
      await logError('admin.api.stats', therapistsRes.error, { stage: 'totals_therapists' });
    }
    if (clientsRes.error) {
      await logError('admin.api.stats', clientsRes.error, { stage: 'totals_clients' });
    }
    if (matchesRes.error) {
      await logError('admin.api.stats', matchesRes.error, { stage: 'totals_matches' });
    }

    const totals = {
      therapists: therapistsRes.error ? 0 : (therapistsRes.count || 0),
      clients: clientsRes.error ? 0 : (clientsRes.count || 0),
      matches: matchesRes.error ? 0 : (matchesRes.count || 0),
    };

    // === PAGE TRAFFIC ===
    const pageTraffic: StatsResponse['pageTraffic'] = { top: [], daily: [] };
    try {
      const { data: pvRows } = await supabaseServer
        .from('events')
        .select('created_at, properties')
        .eq('type', 'page_view')
        .gte('created_at', sinceIso)
        .limit(50000);

      const sessionsByPath = new Map<string, Set<string>>();
      const sessionsByDayPath = new Map<string, Set<string>>();

      for (const row of (pvRows || []) as Array<{ created_at?: string; properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          // Skip local/test traffic
          const isTest = String((props['is_test'] as unknown) ?? '').toLowerCase() === 'true';
          if (isTest) continue;
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          const path = String((props['page_path'] as string | undefined) || '').trim();
          if (!sid || !path) continue;

          // Aggregate by path
          if (!sessionsByPath.has(path)) sessionsByPath.set(path, new Set<string>());
          sessionsByPath.get(path)!.add(sid);

          // Aggregate by day + path
          const day = toDayKey(row.created_at as string);
          const key = `${day}__${path}`;
          if (!sessionsByDayPath.has(key)) sessionsByDayPath.set(key, new Set<string>());
          sessionsByDayPath.get(key)!.add(sid);
        } catch {}
      }

      // Top 10 pages
      const topArr = Array.from(sessionsByPath.entries())
        .map(([page_path, set]) => ({ page_path, sessions: set.size }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 10);
      pageTraffic.top = topArr;

      // Daily series for top pages only
      const topSet = new Set(topArr.map((x) => x.page_path));
      pageTraffic.daily = Array.from(sessionsByDayPath.entries())
        .map(([k, set]) => {
          const [day, page_path] = k.split('__');
          return { day, page_path, sessions: set.size };
        })
        .filter((r) => topSet.has(r.page_path))
        .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.page_path.localeCompare(b.page_path)));
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'page_traffic' });
    }

    // === WIZARD FUNNEL (Steps 1-9) ===
    // PROPER COHORT-BASED FUNNEL ANALYSIS
    // Best practice: Track the SAME sessions moving sequentially through steps
    const wizardFunnel: StatsResponse['wizardFunnel'] = {
      page_views: 0,
      steps: {},
      form_completed: 0,
      start_rate: 0,
    };
    const wizardDropoffs: StatsResponse['wizardDropoffs'] = [];
    let abandonFieldsTop: StatsResponse['abandonFieldsTop'] = [];

    try {
      // STEP 1: Get all screen_viewed events and build session progression map
      const { data: stepEvents } = await supabaseServer
        .from('events')
        .select('properties')
        .eq('type', 'screen_viewed')
        .gte('created_at', funnelSinceIso)
        .limit(20000);

      // Map: session_id -> Set of steps viewed
      const sessionStepMap = new Map<string, Set<number>>();

      for (const row of (stepEvents || []) as Array<{ properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const isTest = String((props['is_test'] as unknown) ?? '').toLowerCase() === 'true';
          if (isTest) continue;
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          const stepVal = Number(String((props['step'] as string | number | undefined) ?? ''));
          const stepNum = Number.isFinite(stepVal) ? Math.floor(stepVal) : NaN;

          if (sid && stepNum >= 1 && stepNum <= 9) {
            if (!sessionStepMap.has(sid)) {
              sessionStepMap.set(sid, new Set<number>());
            }
            sessionStepMap.get(sid)!.add(stepNum);
          }
        } catch {}
      }

      // STEP 2: Calculate cohort sizes using sequential filtering
      // A session "reached step N" if it viewed step N AND all previous steps (1...N-1)
      const cohortByStep: Record<number, Set<string>> = {};

      for (let step = 1; step <= 9; step++) {
        cohortByStep[step] = new Set<string>();

        for (const [sid, stepsViewed] of sessionStepMap.entries()) {
          // Check if session reached this step AND all previous steps
          let reachedStep = true;
          for (let requiredStep = 1; requiredStep <= step; requiredStep++) {
            if (!stepsViewed.has(requiredStep)) {
              reachedStep = false;
              break;
            }
          }

          if (reachedStep) {
            cohortByStep[step].add(sid);
          }
        }
      }

      // STEP 3: Get page views for start rate calculation
      const { data: pvEvents } = await supabaseServer
        .from('events')
        .select('properties')
        .eq('type', 'page_view')
        .gte('created_at', funnelSinceIso)
        .limit(50000);

      const pvSessions = new Set<string>();
      for (const row of (pvEvents || []) as Array<{ properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const isTest = String((props['is_test'] as unknown) ?? '').toLowerCase() === 'true';
          if (isTest) continue;
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          const path = String((props['page_path'] as string | undefined) || '').trim();
          if (sid && path === '/fragebogen') pvSessions.add(sid);
        } catch {}
      }
      wizardFunnel.page_views = pvSessions.size;

      // STEP 4: Get form completions and match to sessions
      // Form completions are tracked via form_completed events in the events table
      const { data: completedEvents } = await supabaseServer
        .from('events')
        .select('properties')
        .eq('type', 'form_completed')
        .gte('created_at', funnelSinceIso)
        .limit(20000);

      const completedSessions = new Set<string>();
      for (const row of (completedEvents || []) as Array<{ properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          if (sid) completedSessions.add(sid);
        } catch {}
      }

      // Only count completions from sessions that reached step 9
      const step9Sessions = cohortByStep[9] || new Set<string>();
      let validCompletions = 0;
      for (const sid of completedSessions) {
        if (step9Sessions.has(sid)) {
          validCompletions++;
        }
      }
      wizardFunnel.form_completed = validCompletions;

      // STEP 5: Build funnel metrics
      wizardFunnel.steps = Object.fromEntries(
        Object.entries(cohortByStep).map(([k, v]) => [Number(k), v.size])
      );

      // Calculate start rate based on intersection of page_view sessions and step1 sessions
      const step1Sessions = cohortByStep[1] || new Set<string>();
      let startedFromPageViews = 0;
      for (const sid of step1Sessions) {
        if (pvSessions.has(sid)) startedFromPageViews++;
      }
      wizardFunnel.start_rate = pvSessions.size > 0 ? Math.round((startedFromPageViews / pvSessions.size) * 1000) / 10 : 0;

      // STEP 6: Calculate dropoffs between consecutive steps
      // Dropoffs are now guaranteed to be non-negative (cohorts only shrink)
      for (let k = 1; k <= 8; k++) {
        const from = cohortByStep[k]?.size || 0;
        const to = cohortByStep[k + 1]?.size || 0;
        const drop = from - to;
        const drop_rate = from > 0 ? Math.round((drop / from) * 1000) / 10 : 0;
        wizardDropoffs.push({ step: k, from, to, drop, drop_rate });
      }

      // STEP 7: Top abandoned fields (unchanged - this is independent)
      const { data: abandonRows } = await supabaseServer
        .from('events')
        .select('properties')
        .eq('type', 'field_abandonment')
        .gte('created_at', sinceIso)
        .limit(20000);

      const fieldCounts = new Map<string, number>();
      for (const row of (abandonRows || []) as Array<{ properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const fields = Array.isArray((props['fields'] as unknown)) ? ((props['fields'] as unknown[]) as string[]) : [];
          for (const f of fields) {
            const key = String(f || '').trim();
            if (!key) continue;
            fieldCounts.set(key, (fieldCounts.get(key) || 0) + 1);
          }
        } catch {}
      }

      abandonFieldsTop = Array.from(fieldCounts.entries())
        .map(([field, count]) => ({ field, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'wizard_funnel' });
    }

    // === DIRECTORY ENGAGEMENT ===
    const directory: StatsResponse['directory'] = {
      views: 0,
      helpClicks: 0,
      navClicks: 0,
      contactOpened: 0,
      contactSent: 0,
    };

    try {
      // Directory views: sessions with page_view on /therapeuten
      const { data: dirPvRows } = await supabaseServer
        .from('events')
        .select('properties')
        .eq('type', 'page_view')
        .gte('created_at', sinceIso)
        .limit(50000);

      const dirViewSessions = new Set<string>();
      for (const row of (dirPvRows || []) as Array<{ properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const isTest = String((props['is_test'] as unknown) ?? '').toLowerCase() === 'true';
          if (isTest) continue;
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          const path = String((props['page_path'] as string | undefined) || '').trim();
          if (sid && path === '/therapeuten') dirViewSessions.add(sid);
        } catch {}
      }
      directory.views = dirViewSessions.size;

      // Help clicks: cta_click with id=therapeuten-callout-fragebogen FROM /therapeuten page
      const { data: ctaRows } = await supabaseServer
        .from('events')
        .select('properties')
        .eq('type', 'cta_click')
        .gte('created_at', sinceIso)
        .limit(20000);

      const helpSessions = new Set<string>();
      const navSessions = new Set<string>();

      for (const row of (ctaRows || []) as Array<{ properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const isTest = String((props['is_test'] as unknown) ?? '').toLowerCase() === 'true';
          if (isTest) continue;
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          if (!sid) continue;

          const id = String((props['id'] as string | undefined) || '').toLowerCase();
          const source = String((props['source'] as string | undefined) || '').toLowerCase();
          const href = String((props['href'] as string | undefined) || '').toLowerCase();
          const pagePath = String((props['page_path'] as string | undefined) || '').toLowerCase();

          // Help clicks: only from /therapeuten page
          if (id === 'therapeuten-callout-fragebogen' && pagePath === '/therapeuten') {
            helpSessions.add(sid);
          }

          // Navigation clicks to /therapeuten (Alle Therapeuten ansehen)
          if (id === 'alle-therapeuten' || source === 'alle-therapeuten' || href.endsWith('/therapeuten')) {
            navSessions.add(sid);
          }
        } catch {}
      }

      directory.helpClicks = helpSessions.size;
      directory.navClicks = navSessions.size;

      // Contact engagement: modal opened and message sent on /therapeuten
      const { data: contactRows } = await supabaseServer
        .from('events')
        .select('type, properties')
        .in('type', ['contact_modal_opened', 'contact_message_sent'])
        .gte('created_at', sinceIso)
        .limit(20000);

      const openedSessions = new Set<string>();
      const sentSessions = new Set<string>();

      for (const row of (contactRows || []) as Array<{ type?: string; properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const isTest = String((props['is_test'] as unknown) ?? '').toLowerCase() === 'true';
          if (isTest) continue;
          const ref = String((props['referrer'] as string | undefined) || '').toLowerCase();
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          if (!ref.includes('/therapeuten') || !sid) continue;

          const t = String(row.type || '').toLowerCase();
          if (t === 'contact_modal_opened') openedSessions.add(sid);
          if (t === 'contact_message_sent') sentSessions.add(sid);
        } catch {}
      }

      directory.contactOpened = openedSessions.size;
      directory.contactSent = sentSessions.size;
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'directory' });
    }

    // === JOURNEY ANALYSIS (Fragebogen vs. Therapeuten) ===
    const journeyAnalysis: StatsResponse['journeyAnalysis'] = {
      fragebogen_only: 0,
      therapeuten_only: 0,
      both_fragebogen_first: 0,
      both_therapeuten_first: 0,
      neither: 0,
      total_sessions: 0,
      questionnaire_preference_rate: 0,
      directory_to_questionnaire_rate: 0,
    };

    try {
      // Get all page_view events and group by session
      const { data: allPvRows } = await supabaseServer
        .from('events')
        .select('created_at, properties')
        .eq('type', 'page_view')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true })
        .limit(50000);

      // Map session_id -> array of {timestamp, path}
      const sessionPaths = new Map<string, Array<{ ts: string; path: string }>>();

      for (const row of (allPvRows || []) as Array<{ created_at?: string; properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          const path = String((props['page_path'] as string | undefined) || '').trim();
          const ts = String(row.created_at || '');
          if (!sid || !path || !ts) continue;

          if (!sessionPaths.has(sid)) sessionPaths.set(sid, []);
          sessionPaths.get(sid)!.push({ ts, path });
        } catch {}
      }

      // Analyze each session's journey
      for (const [sid, visits] of sessionPaths.entries()) {
        const paths = visits.map(v => v.path);
        const hasFrage = paths.includes('/fragebogen');
        const hasTher = paths.includes('/therapeuten');

        if (!hasFrage && !hasTher) {
          journeyAnalysis.neither++;
        } else if (hasFrage && !hasTher) {
          journeyAnalysis.fragebogen_only++;
        } else if (hasTher && !hasFrage) {
          journeyAnalysis.therapeuten_only++;
        } else {
          // Both: determine which came first
          const firstFrage = visits.find(v => v.path === '/fragebogen');
          const firstTher = visits.find(v => v.path === '/therapeuten');
          if (firstFrage && firstTher) {
            if (firstFrage.ts < firstTher.ts) {
              journeyAnalysis.both_fragebogen_first++;
            } else {
              journeyAnalysis.both_therapeuten_first++;
            }
          }
        }
      }

      journeyAnalysis.total_sessions = sessionPaths.size;

      // Calculate rates
      const qTotal = journeyAnalysis.fragebogen_only + journeyAnalysis.both_fragebogen_first;
      const tTotal = journeyAnalysis.therapeuten_only + journeyAnalysis.both_therapeuten_first;
      const engaged = qTotal + tTotal; // Sessions that visited at least one key page

      journeyAnalysis.questionnaire_preference_rate =
        engaged > 0 ? Math.round((qTotal / engaged) * 1000) / 10 : 0;

      const startedWithDirectory = journeyAnalysis.therapeuten_only + journeyAnalysis.both_therapeuten_first;
      journeyAnalysis.directory_to_questionnaire_rate =
        startedWithDirectory > 0
          ? Math.round((journeyAnalysis.both_therapeuten_first / startedWithDirectory) * 1000) / 10
          : 0;
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'journey_analysis' });
    }

    const data: StatsResponse = {
      totals,
      pageTraffic,
      wizardFunnel,
      wizardDropoffs,
      abandonFieldsTop,
      directory,
      journeyAnalysis,
    };

    return NextResponse.json({ data, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.stats', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
