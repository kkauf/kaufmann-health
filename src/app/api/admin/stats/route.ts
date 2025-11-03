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
    started_count?: number; // intersection of page_view sessions and step1
    sms_verification_views?: number; // step 8.5 unique sessions
    form_completed_lenient?: number; // cross-session tolerant completion count
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
    profileViewsSessions?: number;
    profileViewsTotal?: number;
    profilesPerSessionAvg?: number;
    ctaBookingSessions?: number;
    ctaConsultSessions?: number;
    verifyStartedPhoneSessions?: number;
    verifyStartedEmailSessions?: number;
    verifyCompletedPhoneSessions?: number;
    verifyCompletedEmailSessions?: number;
    openToVerifyRate?: number;
    verifyToSendRate?: number;
    openToSendRate?: number;
    patientInitiatedMatches?: number;
    patientInitiatedAccepted?: number;
    closeByStep?: Array<{ step: string; count: number }>;
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
  conversionFunnel: {
    total_leads: number;
    email_only: number;
    phone_only: number;
    email_confirmed: number;
    phone_verified: number;
    converted_to_new: number;
    // New: split activation semantics
    activated_via_verification?: number; // status=new AND verified by email/phone (not directory-only)
    activated_via_directory?: number;    // status=new created via directory contact before verification
    email_confirmation_rate: number; // % of email_only that are email_confirmed
    phone_verification_rate: number; // % of phone_only that are phone_verified
    overall_activation_rate: number; // % of total_leads that became status=new
    // New: activation breakdown rates
    activated_verified_rate?: number;   // activated_via_verification / total_leads
    activated_directory_rate?: number;  // activated_via_directory / total_leads
  };
  matchFunnel: {
    total_matches: number;
    therapist_contacted: number;
    therapist_responded: number;
    patient_selected: number;
    accepted: number;
    declined: number;
    response_rate: number;   // responded / contacted
    acceptance_rate: number; // accepted / responded
    overall_conversion: number; // accepted / total
  };
  questionnaireInsights: {
    contactMethod: Array<{ option: string; count: number }>;
    sessionPreference: Array<{ option: string; count: number }>;
    onlineOk: Array<{ option: string; count: number }>;
    modalityMatters: Array<{ option: string; count: number }>;
    startTiming: Array<{ option: string; count: number }>;
    budgetBuckets: Array<{ option: string; count: number }>;
    therapyExperience: Array<{ option: string; count: number }>;
    gender: Array<{ option: string; count: number }>;
    methodsTop: Array<{ option: string; count: number }>;
    totalSessions: number;
  };
  wizardSegments: {
    bySessionPreference: Array<{ option: string; started: number; completed: number; completion_rate: number }>;
    byOnlineOk: Array<{ option: string; started: number; completed: number; completion_rate: number }>;
    byStartTiming: Array<{ option: string; started: number; completed: number; completion_rate: number }>;
    byBudgetBucket: Array<{ option: string; started: number; completed: number; completion_rate: number }>;
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
    let sinceIso = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();

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

    // Global cutoff support: param override or hard default
    // - If ?cutoff is provided, use it
    // - Otherwise apply hard default cutoff of 2025-10-21 (ignore 2025-10-20 and earlier)
    const cutoffParam = url.searchParams.get('cutoff');
    let effectiveCutoffIso: string | null = null;
    if (cutoffParam) {
      try {
        const d = new Date(cutoffParam);
        if (!Number.isNaN(d.getTime())) {
          const dUtc = startOfDayUTC(d);
          effectiveCutoffIso = (dUtc > today ? today : dUtc).toISOString();
        }
      } catch {}
    } else {
      try {
        const dUtc = startOfDayUTC(new Date('2025-10-21'));
        effectiveCutoffIso = (dUtc > today ? today : dUtc).toISOString();
      } catch {}
    }
    if (effectiveCutoffIso) {
      // Use the later of (existing sinceIso, effectiveCutoffIso)
      sinceIso = effectiveCutoffIso > sinceIso ? effectiveCutoffIso : sinceIso;
      // If funnel since not explicitly overridden, align it as well
      if (!sinceParam) {
        funnelSinceIso = effectiveCutoffIso > funnelSinceIso ? effectiveCutoffIso : funnelSinceIso;
      }
    }

    // === TOTALS ===
    // Note: Queries ALL records (not filtered by time window) to show lifetime totals
    // Test filter: only exclude if metadata.is_test explicitly = 'true' (allow NULL/missing)
    const [therapistsRes, clientsRes, matchesRes] = await Promise.all([
      supabaseServer
        .from('therapists')
        .select('id', { count: 'exact', head: true })
        .or('metadata->>is_test.is.null,metadata->>is_test.eq.false')
        .not('email', 'ilike', '%@example.com'),
      supabaseServer
        .from('people')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'patient')
        .or('metadata->>is_test.is.null,metadata->>is_test.eq.false')
        .not('email', 'ilike', '%@example.com'),
      supabaseServer
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .or('metadata->>is_test.is.null,metadata->>is_test.eq.false'),
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
      sms_verification_views: 0,
      form_completed_lenient: 0,
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
      const sessionToFs = new Map<string, string>();
      // Track 8.5 (SMS verification) separately
      const step85Sessions = new Set<string>();

      for (const row of (stepEvents || []) as Array<{ properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const isTest = String((props['is_test'] as unknown) ?? '').toLowerCase() === 'true';
          if (isTest) continue;
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          const stepRaw = (props['step'] as unknown);
          const stepVal = Number(String(stepRaw ?? ''));
          const stepNum = Number.isFinite(stepVal) ? Math.floor(stepVal) : NaN;
          const fsid = String((props['form_session_id'] as string | undefined) || '').trim();

          if (sid) {
            // Capture 8.5 views
            if (Number.isFinite(stepVal) && stepVal >= 8.5 && stepVal < 9) {
              step85Sessions.add(sid);
            }
            if (fsid) {
              if (!sessionToFs.has(sid)) sessionToFs.set(sid, fsid);
            }
          }

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
        .in('type', ['form_completed', 'fragebogen_completed'])
        .gte('created_at', funnelSinceIso)
        .limit(20000);

      const completedSessions = new Set<string>();
      const completionKeys = new Set<string>(); // lenient unique keys: fs:<id> or sid:<id>
      for (const row of (completedEvents || []) as Array<{ properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          const fsid = String((props['form_session_id'] as string | undefined) || '').trim();
          if (sid) completedSessions.add(sid);
          if (fsid) completionKeys.add(`fs:${fsid}`);
          else if (sid) completionKeys.add(`sid:${sid}`);
          if (sid && fsid && !sessionToFs.has(sid)) sessionToFs.set(sid, fsid);
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
      wizardFunnel.sms_verification_views = step85Sessions.size;
      wizardFunnel.form_completed_lenient = completionKeys.size;

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
      wizardFunnel.started_count = startedFromPageViews;

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
        .select('created_at, properties')
        .eq('type', 'field_abandonment')
        .gte('created_at', sinceIso)
        .limit(20000);

      // Build a map of verification_code_verified per session to filter transitional phone_verified abandons
      const { data: verifyRows } = await supabaseServer
        .from('events')
        .select('created_at, properties')
        .eq('type', 'verification_code_verified')
        .gte('created_at', sinceIso)
        .limit(20000);

      const verifiedBySession = new Map<string, string[]>();
      for (const row of (verifyRows || []) as Array<{ created_at?: string; properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const ct = String((props['contact_type'] as string | undefined) || '').toLowerCase();
          if (ct !== 'phone') continue;
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          const fsid = String((props['form_session_id'] as string | undefined) || '').trim();
          const ts = String(row.created_at || '');
          if (!sid || !ts) continue;
          if (!verifiedBySession.has(sid)) verifiedBySession.set(sid, []);
          verifiedBySession.get(sid)!.push(ts);
          if (sid && fsid && !sessionToFs.has(sid)) sessionToFs.set(sid, fsid);
        } catch {}
      }

      const fieldCounts = new Map<string, number>();
      for (const row of (abandonRows || []) as Array<{ created_at?: string; properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const fields = Array.isArray((props['fields'] as unknown)) ? ((props['fields'] as unknown[]) as string[]) : [];
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          const fsidFromAbandon = String((props['form_session_id'] as string | undefined) || '').trim();
          if (sid && fsidFromAbandon && !sessionToFs.has(sid)) sessionToFs.set(sid, fsidFromAbandon);
          // Filter transitional 'phone_verified' abandons when same session verified code around the same time (±2h)
          const at = row.created_at ? Date.parse(String(row.created_at)) : NaN;
          let fieldsToCount = fields;
          if (sid && fields.includes('phone_verified') && !Number.isNaN(at)) {
            const verTs = (verifiedBySession.get(sid) || []).map((s) => Date.parse(s)).filter((n) => !Number.isNaN(n));
            const hasNearbyVerify = verTs.some((t) => Math.abs(t - at) <= 2 * 60 * 60 * 1000);
            if (hasNearbyVerify) {
              fieldsToCount = fields.filter((f) => f !== 'phone_verified');
            }
          }
          for (const f of fieldsToCount) {
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
      // === SEGMENTED FUNNEL RATES ===
      const startedSessionsSet = new Set<string>();
      for (const sid of (cohortByStep[1] || new Set<string>()) as Set<string>) {
        if (pvSessions.has(sid)) startedSessionsSet.add(sid);
      }
      const completedProperSet = new Set<string>();
      for (const sid of completedSessions) {
        if ((cohortByStep[9] || new Set<string>()).has(sid)) completedProperSet.add(sid);
      }

      const fsIds = Array.from(new Set(Array.from(sessionToFs.values()).filter((v) => !!v)));
      const fsDataById = new Map<string, Record<string, unknown>>();
      if (fsIds.length > 0) {
        const chunks: Array<string[]> = [];
        for (let i = 0; i < fsIds.length; i += 1000) chunks.push(fsIds.slice(i, i + 1000));
        const results = await Promise.all(
          chunks.map((ids) =>
            supabaseServer
              .from('form_sessions')
              .select('id, data')
              .in('id', ids)
          )
        );
        for (const r of results) {
          for (const row of ((r.data as Array<{ id: string; data: unknown }>) || [])) {
            fsDataById.set(row.id, (row.data || {}) as Record<string, unknown>);
          }
        }
      }

      const normalizeBudget = (raw?: string | null): string => {
        const s = (raw || '').toLowerCase().trim();
        if (!s) return 'unknown';
        if (s.includes('flex')) return 'flexible';
        if (s.includes('unter') || s.includes('<') || s.includes('bis 80')) return '<80';
        if (s.includes('80') && s.includes('100')) return '80-100';
        if (s.includes('100') && s.includes('120')) return '100-120';
        if (s.includes('über') || s.includes('>') || s.includes('120')) return '>120';
        return 'unknown';
      };

      const seg = {
        bySessionPreference: [] as Array<{ option: string; started: number; completed: number; completion_rate: number }>,
        byOnlineOk: [] as Array<{ option: string; started: number; completed: number; completion_rate: number }>,
        byStartTiming: [] as Array<{ option: string; started: number; completed: number; completion_rate: number }>,
        byBudgetBucket: [] as Array<{ option: string; started: number; completed: number; completion_rate: number }>,
      };

      const compute = (getter: (d?: Record<string, unknown>) => string) => {
        const started = new Map<string, number>();
        const completed = new Map<string, number>();
        const getOpt = (sid: string) => {
          const fsid = sessionToFs.get(sid) || '';
          const d = fsid ? fsDataById.get(fsid) : undefined;
          const val = getter(d);
          return val ? String(val) : 'unknown';
        };
        for (const sid of startedSessionsSet) {
          const opt = getOpt(sid);
          started.set(opt, (started.get(opt) || 0) + 1);
        }
        for (const sid of completedProperSet) {
          const opt = getOpt(sid);
          completed.set(opt, (completed.get(opt) || 0) + 1);
        }
        const arr = Array.from(started.entries()).map(([option, s]) => {
          const c = completed.get(option) || 0;
          const r = s > 0 ? Math.round((c / s) * 1000) / 10 : 0;
          return { option, started: s, completed: c, completion_rate: r };
        });
        arr.sort((a, b) => b.started - a.started);
        return arr;
      };

      const getSp = (d?: Record<string, unknown>) => String(((d?.['session_preference'] as string | undefined) || '').trim() || 'unknown');
      const getOk = (d?: Record<string, unknown>) => {
        const v = d?.['online_ok'];
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        const pref = String(((d?.['session_preference'] as string | undefined) || '').toLowerCase().trim());
        if (pref === 'online' || pref === 'either') return 'true';
        if (pref === 'in_person') return 'false';
        return 'unknown';
      };
      const getSt = (d?: Record<string, unknown>) => String(((d?.['start_timing'] as string | undefined) || '').trim() || 'unknown');
      const getBb = (d?: Record<string, unknown>) => normalizeBudget((d?.['budget'] as string | undefined) || undefined);

      const wizardSegments = {
        bySessionPreference: compute(getSp),
        byOnlineOk: compute(getOk),
        byStartTiming: compute(getSt),
        byBudgetBucket: compute(getBb),
      };
      // expose segments by attaching to closure scope for later response
      (wizardFunnel as unknown as { _segments?: unknown })._segments = wizardSegments;
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

      // Engagement events on /therapeuten: contact, profile, cta, verification
      const { data: engagementRows } = await supabaseServer
        .from('events')
        .select('type, properties')
        .in('type', [
          'contact_modal_opened',
          'contact_message_sent',
          'profile_modal_opened',
          'contact_cta_clicked',
          'contact_verification_started',
          'contact_verification_completed',
          'contact_modal_closed',
        ])
        .gte('created_at', sinceIso)
        .limit(50000);

      const openedSessions = new Set<string>();
      const sentSessions = new Set<string>();
      const profileViewSessions = new Set<string>();
      let profileViewTotal = 0;
      const ctaBookingSessions = new Set<string>();
      const ctaConsultSessions = new Set<string>();
      const verifyStartedPhone = new Set<string>();
      const verifyStartedEmail = new Set<string>();
      const verifyCompletedPhone = new Set<string>();
      const verifyCompletedEmail = new Set<string>();

      const closeByStepMap = new Map<string, number>();
      for (const row of (engagementRows || []) as Array<{ type?: string; properties?: Record<string, unknown> }>) {
        try {
          const props = (row.properties || {}) as Record<string, unknown>;
          const isTest = String((props['is_test'] as unknown) ?? '').toLowerCase() === 'true';
          if (isTest) continue;
          const sid = String((props['session_id'] as string | undefined) || '').trim();
          if (!sid) continue;
          const pagePath = String((props['page_path'] as string | undefined) || '').toLowerCase();
          const ref = String((props['referrer'] as string | undefined) || '').toLowerCase();
          const onDirectory = pagePath === '/therapeuten' || ref.includes('/therapeuten');
          if (!onDirectory) continue;

          const t = String(row.type || '').toLowerCase();
          if (t === 'contact_modal_opened') {
            openedSessions.add(sid);
          } else if (t === 'contact_message_sent') {
            sentSessions.add(sid);
          } else if (t === 'profile_modal_opened') {
            profileViewSessions.add(sid);
            profileViewTotal++;
          } else if (t === 'contact_cta_clicked') {
            const ct = String((props['contact_type'] as string | undefined) || '').toLowerCase();
            if (ct === 'booking') ctaBookingSessions.add(sid);
            else if (ct === 'consultation') ctaConsultSessions.add(sid);
          } else if (t === 'contact_verification_started') {
            const m = String((props['contact_method'] as string | undefined) || '').toLowerCase();
            if (m === 'phone') verifyStartedPhone.add(sid);
            else if (m === 'email') verifyStartedEmail.add(sid);
          } else if (t === 'contact_verification_completed') {
            const m = String((props['contact_method'] as string | undefined) || '').toLowerCase();
            if (m === 'phone') verifyCompletedPhone.add(sid);
            else if (m === 'email') verifyCompletedEmail.add(sid);
          } else if (t === 'contact_modal_closed') {
            const step = String((props['step'] as string | undefined) || 'unknown').toLowerCase();
            const key = step || 'unknown';
            closeByStepMap.set(key, (closeByStepMap.get(key) || 0) + 1);
          }
        } catch {}
      }

      directory.contactOpened = openedSessions.size;
      directory.contactSent = sentSessions.size;
      directory.profileViewsSessions = profileViewSessions.size;
      directory.profileViewsTotal = profileViewTotal;
      directory.profilesPerSessionAvg = profileViewSessions.size > 0 ? Math.round((profileViewTotal / profileViewSessions.size) * 10) / 10 : 0;
      directory.ctaBookingSessions = ctaBookingSessions.size;
      directory.ctaConsultSessions = ctaConsultSessions.size;
      directory.verifyStartedPhoneSessions = verifyStartedPhone.size;
      directory.verifyStartedEmailSessions = verifyStartedEmail.size;
      directory.verifyCompletedPhoneSessions = verifyCompletedPhone.size;
      directory.verifyCompletedEmailSessions = verifyCompletedEmail.size;
      directory.closeByStep = Array.from(closeByStepMap.entries())
        .map(([step, count]) => ({ step, count }))
        .sort((a, b) => b.count - a.count);

      // Derived rates
      const verifiedSessions = new Set<string>([...verifyCompletedPhone, ...verifyCompletedEmail]);
      const openedAndVerified = new Set<string>([...verifiedSessions].filter((s) => openedSessions.has(s)));
      const verifiedAndSent = new Set<string>([...sentSessions].filter((s) => verifiedSessions.has(s)));
      const openedAndSent = new Set<string>([...sentSessions].filter((s) => openedSessions.has(s)));

      directory.openToVerifyRate = openedSessions.size > 0 ? Math.round((openedAndVerified.size / openedSessions.size) * 1000) / 10 : 0;
      directory.verifyToSendRate = verifiedSessions.size > 0 ? Math.round((verifiedAndSent.size / verifiedSessions.size) * 1000) / 10 : 0;
      directory.openToSendRate = openedSessions.size > 0 ? Math.round((openedAndSent.size / openedSessions.size) * 1000) / 10 : 0;
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'directory' });
    }

    // Augment directory metrics with server-side events (email confirm + server contact processing)
    try {
      const { data: serverEventRows } = await supabaseServer
        .from('events')
        .select('type, properties')
        .in('type', ['directory_contact_conversion', 'contact_verification_completed'])
        .gte('created_at', sinceIso)
        .limit(50000);

      // Build session-aware sets and collect match_ids for de-noising tests
      const serverSentSessions = new Set<string>();
      const serverVerifyEmailSessions = new Set<string>();
      const serverVerifyPhoneSessions = new Set<string>();
      const serverSentNoSessionFallback: Array<{ match_id?: string | null }> = [];
      const candidateMatchIds = new Set<string>();

      for (const row of (serverEventRows || []) as Array<{ type?: string; properties?: Record<string, unknown> }>) {
        try {
          const t = String(row.type || '').toLowerCase();
          const props = (row.properties || {}) as Record<string, unknown>;
          const isTestProp = String((props['is_test'] as unknown) ?? '').toLowerCase() === 'true';
          if (isTestProp) continue; // skip explicit test events

          const sid = String((props['session_id'] as string | undefined) || '').trim();
          const matchId = String((props['match_id'] as string | undefined) || '').trim();
          if (matchId) candidateMatchIds.add(matchId);

          if (t === 'directory_contact_conversion') {
            if (sid) serverSentSessions.add(sid);
            else serverSentNoSessionFallback.push({ match_id: matchId || null });
          } else if (t === 'contact_verification_completed') {
            const m = String((props['contact_method'] as string | undefined) || '').toLowerCase();
            if (sid) {
              if (m === 'email') serverVerifyEmailSessions.add(sid);
              else if (m === 'phone') serverVerifyPhoneSessions.add(sid);
            }
          }
        } catch {}
      }

      // De-noise: load matches and patients for candidate match_ids to drop test/E2E rows
      const testMatchIds = new Set<string>();
      if (candidateMatchIds.size > 0) {
        try {
          const matchIdsArr = Array.from(candidateMatchIds);
          const { data: matchRows } = await supabaseServer
            .from('matches')
            .select('id, metadata, patient_id')
            .in('id', matchIdsArr)
            .limit(50000);
          const patientIds = new Set<string>();
          for (const r of (matchRows || []) as Array<{ id: string; metadata?: Record<string, unknown> | null; patient_id: string }>) {
            const md = (r.metadata || {}) as Record<string, unknown>;
            const isTest = String((md['is_test'] as unknown) ?? '').toLowerCase() === 'true';
            if (isTest) testMatchIds.add(r.id);
            patientIds.add(r.patient_id);
          }
          if (patientIds.size > 0) {
            const { data: peopleRows } = await supabaseServer
              .from('people')
              .select('id, email, metadata')
              .in('id', Array.from(patientIds))
              .limit(50000);
            for (const p of (peopleRows || []) as Array<{ id: string; email?: string | null; metadata?: Record<string, unknown> | null }>) {
              const email = (p.email || '').toLowerCase();
              const meta = (p.metadata || {}) as Record<string, unknown>;
              const isTest = String((meta['is_test'] as unknown) ?? '').toLowerCase() === 'true';
              const looksE2E = /^e2e-[a-z0-9]+@example\.com$/.test(email);
              if (isTest || looksE2E) {
                // Tag any matches for this patient as test
                for (const r of (matchRows || []) as Array<{ id: string; patient_id: string }>) {
                  if (r.patient_id === p.id) testMatchIds.add(r.id);
                }
              }
            }
          }
        } catch {}
      }

      // Remove test-derived sessions (by dropping events whose match_id is test)
      const cleanServerSentSessions = new Set<string>();
      for (const sid of serverSentSessions) cleanServerSentSessions.add(sid);
      // For fallbacks without session_id, just ignore if they belong to test matches
      const nonSessionServerSentCount = serverSentNoSessionFallback.filter((r) => r.match_id && !testMatchIds.has(r.match_id)).length;

      // Merge into session-based metrics and cap rates at 100
      const openCount = Number(directory.contactOpened || 0);
      const clientVerifyEmail = Number(directory.verifyCompletedEmailSessions || 0);
      const clientVerifyPhone = Number(directory.verifyCompletedPhoneSessions || 0);
      const verifySessionTotal = (clientVerifyEmail + clientVerifyPhone) + serverVerifyEmailSessions.size + serverVerifyPhoneSessions.size;

      const clientSentDisplayed = Number(directory.contactSent || 0);
      // Replace displayed Sends with client + server session-joinable, plus non-session fallback for context
      const sentSessionsUnion = new Set<string>([...cleanServerSentSessions]);
      // Note: we cannot get client sent sessions set here; keep displayed count consistent with sessions where possible
      directory.contactSent = sentSessionsUnion.size + nonSessionServerSentCount;
      directory.verifyCompletedEmailSessions = clientVerifyEmail + serverVerifyEmailSessions.size;
      directory.verifyCompletedPhoneSessions = clientVerifyPhone + serverVerifyPhoneSessions.size;

      directory.openToVerifyRate = openCount > 0 ? Math.min(100, Math.round((verifySessionTotal / openCount) * 1000) / 10) : directory.openToVerifyRate || 0;
      directory.verifyToSendRate = verifySessionTotal > 0 ? Math.min(100, Math.round(((directory.contactSent || 0) / verifySessionTotal) * 1000) / 10) : directory.verifyToSendRate || 0;
      directory.openToSendRate = openCount > 0 ? Math.min(100, Math.round(((directory.contactSent || 0) / openCount) * 1000) / 10) : directory.openToSendRate || 0;
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'directory_server_events' });
    }

    // Add patient-initiated matches summary (non-test) for the same window
    try {
      type MatchRow = { id: string; status?: string | null; metadata?: Record<string, unknown> | null; patient_id: string };
      const { data: piMatches } = await supabaseServer
        .from('matches')
        .select('id, status, metadata, patient_id, created_at')
        .gte('created_at', sinceIso)
        .limit(50000);
      let totalPi = 0;
      let acceptedPi = 0;
      if (Array.isArray(piMatches)) {
        // Prepare patient id collection to filter tests/e2e
        const rows = piMatches as unknown as MatchRow[];
        const filtered = rows.filter((r) => String((r.metadata || {})['patient_initiated'] || '').toLowerCase() === 'true');
        const ids = Array.from(new Set(filtered.map((r) => r.patient_id)));
        const patientMeta = new Map<string, { email: string; is_test: boolean }>();
        if (ids.length > 0) {
          const { data: peopleRows } = await supabaseServer
            .from('people')
            .select('id, email, metadata')
            .in('id', ids)
            .limit(50000);
          for (const p of (peopleRows || []) as Array<{ id: string; email?: string | null; metadata?: Record<string, unknown> | null }>) {
            const email = (p.email || '').toLowerCase();
            const meta = (p.metadata || {}) as Record<string, unknown>;
            const isTest = String((meta['is_test'] as unknown) ?? '').toLowerCase() === 'true' || /^e2e-[a-z0-9]+@example\.com$/.test(email);
            patientMeta.set(p.id, { email, is_test: isTest });
          }
        }
        for (const r of filtered) {
          const md = (r.metadata || {}) as Record<string, unknown>;
          const isTest = String((md['is_test'] as unknown) ?? '').toLowerCase() === 'true';
          const pm = patientMeta.get(r.patient_id);
          if (isTest || pm?.is_test) continue;
          totalPi++;
          if (String(r.status || '').toLowerCase() === 'accepted') acceptedPi++;
        }
      }
      directory.patientInitiatedMatches = totalPi;
      directory.patientInitiatedAccepted = acceptedPi;
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'directory_patient_initiated' });
    }

    // === CONVERSION FUNNEL (Email & Phone) ===
    const conversionFunnel: StatsResponse['conversionFunnel'] = {
      total_leads: 0,
      email_only: 0,
      phone_only: 0,
      email_confirmed: 0,
      phone_verified: 0,
      converted_to_new: 0,
      activated_via_verification: 0,
      activated_via_directory: 0,
      email_confirmation_rate: 0,
      phone_verification_rate: 0,
      overall_activation_rate: 0,
      activated_verified_rate: 0,
      activated_directory_rate: 0,
    };
    try {
      type PersonRow = {
        id: string;
        email?: string | null;
        phone_number?: string | null;
        status?: string | null;
        created_at?: string | null;
        metadata?: Record<string, unknown> | null;
      };
      const { data: peopleRows } = await supabaseServer
        .from('people')
        .select('id, email, phone_number, status, created_at, metadata')
        .eq('type', 'patient')
        .or('metadata->>is_test.is.null,metadata->>is_test.eq.false')
        .not('email', 'ilike', '%@example.com')
        .gte('created_at', sinceIso)
        .limit(50000);

      const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

      for (const row of (peopleRows || []) as PersonRow[]) {
        try {
          const email = (row.email || '').trim();
          const phone = (row.phone_number || '').trim();
          const status = String((row.status || '').toLowerCase());
          const meta = (row.metadata || {}) as Record<string, unknown>;
          const cmRaw = String((meta['contact_method'] as string | undefined) || '').toLowerCase();
          const isEmailOnly = cmRaw === 'email' || (!!email && !phone);
          const isPhoneOnly = cmRaw === 'phone' || (!!phone && !email);
          if (isEmailOnly) conversionFunnel.email_only++;
          if (isPhoneOnly) conversionFunnel.phone_only++;
          if (status === 'email_confirmed') conversionFunnel.email_confirmed++;
          if (status === 'new') {
            conversionFunnel.converted_to_new++;
            const emailVerified = typeof meta['email_confirmed_at'] === 'string' && !!meta['email_confirmed_at'];
            const phoneVerified = meta && typeof meta['phone_verified'] === 'boolean' ? (meta['phone_verified'] as boolean) : false;
            const viaDirectory = String((meta['source'] as string | undefined) || '').toLowerCase() === 'directory_contact';
            if (emailVerified || phoneVerified) conversionFunnel.activated_via_verification = (conversionFunnel.activated_via_verification || 0) + 1;
            else if (viaDirectory) conversionFunnel.activated_via_directory = (conversionFunnel.activated_via_directory || 0) + 1;
          }
          const phoneVerifiedFlag = meta && typeof meta['phone_verified'] === 'boolean' ? (meta['phone_verified'] as boolean) : false;
          if (phoneVerifiedFlag) conversionFunnel.phone_verified++;
        } catch {}
      }

      conversionFunnel.email_confirmation_rate = pct(conversionFunnel.email_confirmed, conversionFunnel.email_only);
      conversionFunnel.phone_verification_rate = pct(conversionFunnel.phone_verified, conversionFunnel.phone_only);
      conversionFunnel.overall_activation_rate = pct(conversionFunnel.converted_to_new, conversionFunnel.total_leads);
      conversionFunnel.activated_verified_rate = pct(conversionFunnel.activated_via_verification || 0, conversionFunnel.total_leads);
      conversionFunnel.activated_directory_rate = pct(conversionFunnel.activated_via_directory || 0, conversionFunnel.total_leads);
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'conversion_funnel' });
    }

    // === MATCH FUNNEL ===
    const matchFunnel: StatsResponse['matchFunnel'] = {
      total_matches: 0,
      therapist_contacted: 0,
      therapist_responded: 0,
      patient_selected: 0,
      accepted: 0,
      declined: 0,
      response_rate: 0,
      acceptance_rate: 0,
      overall_conversion: 0,
    };
    try {
      type MatchRow = { id: string; status?: string | null; created_at?: string | null };
      const { data: matchRows } = await supabaseServer
        .from('matches')
        .select('id, status, created_at')
        .or('metadata->>is_test.is.null,metadata->>is_test.eq.false')
        .gte('created_at', sinceIso)
        .limit(50000);

      const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
      const contactedSet = new Set<string>(['therapist_contacted','therapist_responded','patient_selected','accepted','declined','session_booked','completed','failed']);
      const respondedSet = new Set<string>(['therapist_responded','patient_selected','accepted','declined','session_booked','completed','failed']);
      const selectedSet = new Set<string>(['patient_selected','accepted','declined','session_booked','completed','failed']);
      const acceptedSet = new Set<string>(['accepted','session_booked','completed']);
      const declinedSet = new Set<string>(['declined']);

      for (const row of (matchRows || []) as MatchRow[]) {
        try {
          const s = String((row.status || '').toLowerCase());
          matchFunnel.total_matches++;
          if (contactedSet.has(s)) matchFunnel.therapist_contacted++;
          if (respondedSet.has(s)) matchFunnel.therapist_responded++;
          if (selectedSet.has(s)) matchFunnel.patient_selected++;
          if (acceptedSet.has(s)) matchFunnel.accepted++;
          if (declinedSet.has(s)) matchFunnel.declined++;
        } catch {}
      }

      matchFunnel.response_rate = pct(matchFunnel.therapist_responded, matchFunnel.therapist_contacted);
      matchFunnel.acceptance_rate = pct(matchFunnel.accepted, matchFunnel.therapist_responded);
      matchFunnel.overall_conversion = pct(matchFunnel.accepted, matchFunnel.total_matches);
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'match_funnel' });
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

    // === QUESTIONNAIRE INSIGHTS (form_sessions) ===
    const questionnaireInsights: StatsResponse['questionnaireInsights'] = {
      contactMethod: [],
      sessionPreference: [],
      onlineOk: [],
      modalityMatters: [],
      startTiming: [],
      budgetBuckets: [],
      therapyExperience: [],
      gender: [],
      methodsTop: [],
      totalSessions: 0,
    };

    try {
      // Fetch recent form_sessions and aggregate client-side to keep portability
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
      const bb = new Map<string, number>();
      const te = new Map<string, number>();
      const gd = new Map<string, number>();
      const mt = new Map<string, number>();

      const add = (map: Map<string, number>, key?: string | null) => {
        const k = (key || '').trim();
        if (!k) return;
        map.set(k, (map.get(k) || 0) + 1);
      };
      const normalizeBudget = (raw?: string | null): string => {
        const s = (raw || '').toLowerCase().trim();
        if (!s) return 'unknown';
        if (s.includes('flex')) return 'flexible';
        if (s.includes('unter') || s.includes('<') || s.includes('bis 80')) return '<80';
        if (s.includes('80') && s.includes('100')) return '80-100';
        if (s.includes('100') && s.includes('120')) return '100-120';
        if (s.includes('über') || s.includes('>') || s.includes('120')) return '>120';
        return 'unknown';
      };

      let total = 0;
      for (const row of (fsRows || []) as Array<{ data?: unknown }>) {
        try {
          const d = (row.data || {}) as Record<string, unknown>;
          const name = String((d['name'] as string | undefined) || '').toLowerCase();
          if (name.includes('konstantin')) continue; // filter test
          total++;

          add(cm, (d['contact_method'] as string | undefined) || undefined);
          // Count missing session_preference as "unknown" to match wizard funnel behavior
          const spVal = (d['session_preference'] as string | undefined) || undefined;
          add(sp, spVal || 'unknown');
          // Derive onlineOk from session_preference when boolean is absent
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
          add(bb, normalizeBudget((d['budget'] as string | undefined) || undefined));
          add(te, (d['therapy_experience'] as string | undefined) || undefined);
          add(gd, (d['gender'] as string | undefined) || undefined);

          const methods = Array.isArray(d['methods']) ? (d['methods'] as unknown[]) : [];
          for (const m of methods) {
            const v = String(m || '').trim();
            if (!v) continue;
            mt.set(v, (mt.get(v) || 0) + 1);
          }
        } catch {}
      }

      const toArr = (map: Map<string, number>) => Array.from(map.entries())
        .map(([option, count]) => ({ option, count }))
        .sort((a, b) => b.count - a.count);

      questionnaireInsights.contactMethod = toArr(cm);
      questionnaireInsights.sessionPreference = toArr(sp);
      questionnaireInsights.onlineOk = toArr(ok);
      questionnaireInsights.modalityMatters = toArr(mm);
      questionnaireInsights.startTiming = toArr(st);
      questionnaireInsights.budgetBuckets = toArr(bb);
      questionnaireInsights.therapyExperience = toArr(te);
      questionnaireInsights.gender = toArr(gd);
      questionnaireInsights.methodsTop = toArr(mt).slice(0, 15);
      questionnaireInsights.totalSessions = total;
    } catch (e) {
      await logError('admin.api.stats', e, { stage: 'questionnaire_insights' });
    }

    const segments = ((wizardFunnel as unknown as { _segments?: unknown })._segments as StatsResponse['wizardSegments']) || {
      bySessionPreference: [],
      byOnlineOk: [],
      byStartTiming: [],
      byBudgetBucket: [],
    };

    const data: StatsResponse = {
      totals,
      pageTraffic,
      wizardFunnel,
      wizardDropoffs,
      abandonFieldsTop,
      directory,
      journeyAnalysis,
      conversionFunnel,
      matchFunnel,
      questionnaireInsights,
      wizardSegments: segments,
    };

    return NextResponse.json({ data, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.stats', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
