import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendTherapistEmail } from '@/lib/email/client';
import { renderTherapistDemandDigest, type DemandItem, type OpportunityGap } from '@/lib/email/templates/therapistDemandDigest';
import { BASE_URL } from '@/lib/constants';
import { createTherapistOptOutToken } from '@/lib/signed-links';
import { isCronAuthorized as isCronAuthorizedShared, sameOrigin as sameOriginShared } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TherapistRow = {
  id: string;
  status?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  city?: string | null;
  schwerpunkte?: string[] | null;
  session_preferences?: string[] | null;
  cal_enabled?: boolean | null;
  accepting_new?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

/** Get date range for previous month (cron runs on 1st, reports on last month) */
function getPreviousMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  // First day of current month
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // First day of previous month
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { start: startOfPrevMonth, end: endOfPrevMonth };
}

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

// Cooldown: 28 days minimum between digest sends
const COOLDOWN_MS = 28 * 24 * 60 * 60 * 1000;

type EmailEventRow = { id: string; created_at?: string | null; properties?: Record<string, unknown> | null };

async function getDigestHistory(therapistId: string): Promise<{ lastSentAt: Date | null }> {
  try {
    const sinceIso = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, created_at, properties')
      .eq('type', 'email_sent')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) return { lastSentAt: null };
    const arr = (data as EmailEventRow[] | null) || [];
    const filtered = arr.filter((e) => {
      const p = e.properties as Record<string, unknown> | null;
      if (!p) return false;
      const stage = typeof p['stage'] === 'string' ? p['stage'] : '';
      const tid = typeof p['therapist_id'] === 'string' ? p['therapist_id'] : '';
      return stage === 'therapist_demand_digest' && tid === therapistId;
    });
    const last = filtered[0]?.created_at ? new Date(filtered[0].created_at as string) : null;
    return { lastSentAt: last };
  } catch {
    return { lastSentAt: null };
  }
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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  const startedAt = Date.now();

  try {
    // Auth: allow either admin cookie OR Cron secret
    const isCron = isCronAuthorizedShared(req);
    const isAdmin = await assertAdmin(req);
    if (!isAdmin && !isCron) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }
    if (isAdmin && !isCron && !sameOriginShared(req)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const limitQS = url.searchParams.get('limit');
    const limit = Math.max(1, Math.min(Number(limitQS || 100), 500));
    const dryRun = url.searchParams.get('dry_run') === 'true';
    const testTherapistId = url.searchParams.get('therapist_id');

    // Monitoring: log cron start
    const isVercelCron = Boolean(req.headers.get('x-vercel-cron'));
    void track({
      type: 'cron_executed',
      level: 'info',
      source: 'admin.api.therapists.demand-digest',
      props: {
        limit,
        dry_run: dryRun,
        triggered_by: isCron ? (isVercelCron ? 'vercel_cron' : 'secret') : 'manual',
      },
      ip,
      ua,
    });

    // Step 1: Fetch lead demand from previous month
    // Uses people.metadata.schwerpunkte (the topics leads selected during sign-up)
    const { start: monthStart, end: monthEnd } = getPreviousMonthRange();

    const { data: leadsData, error: leadsError } = await supabaseServer
      .from('people')
      .select('metadata')
      .eq('type', 'patient')
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString());

    if (leadsError) {
      await logError('admin.api.therapists.demand-digest', leadsError, { stage: 'fetch_leads' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch lead demand' }, { status: 500 });
    }

    // Aggregate demand by city + schwerpunkt from leads
    const demandByCityAndSchwerpunkt = new Map<string, Map<string, number>>();
    const demandByOnlineAndSchwerpunkt = new Map<string, number>();

    for (const lead of (leadsData || [])) {
      const meta = lead.metadata as Record<string, unknown> | null;
      if (!meta) continue;

      const schwerpunkte = Array.isArray(meta.schwerpunkte) ? (meta.schwerpunkte as string[]) : [];
      const city = typeof meta.city === 'string' ? meta.city : null;
      const sessionPrefs = Array.isArray(meta.session_preferences) ? (meta.session_preferences as string[]) : [];
      const wantsOnline = sessionPrefs.includes('online');

      for (const sp of schwerpunkte) {
        if (!sp) continue;

        // Aggregate by city
        if (city) {
          if (!demandByCityAndSchwerpunkt.has(city)) {
            demandByCityAndSchwerpunkt.set(city, new Map());
          }
          const cityMap = demandByCityAndSchwerpunkt.get(city)!;
          cityMap.set(sp, (cityMap.get(sp) || 0) + 1);
        }

        // Aggregate online sessions (for therapists who offer online)
        if (wantsOnline) {
          demandByOnlineAndSchwerpunkt.set(sp, (demandByOnlineAndSchwerpunkt.get(sp) || 0) + 1);
        }
      }
    }

    // Step 2: Fetch eligible therapists
    let therapistQuery = supabaseServer
      .from('therapists')
      .select('id, status, first_name, last_name, email, city, schwerpunkte, session_preferences, cal_enabled, accepting_new, metadata')
      .eq('status', 'verified')
      .eq('cal_enabled', true)
      .eq('accepting_new', true)
      .limit(limit);

    // If testing a specific therapist, override filters
    if (testTherapistId) {
      therapistQuery = supabaseServer
        .from('therapists')
        .select('id, status, first_name, last_name, email, city, schwerpunkte, session_preferences, cal_enabled, accepting_new, metadata')
        .eq('id', testTherapistId)
        .limit(1);
    }

    const { data: therapistsData, error: therapistsError } = await therapistQuery;

    if (therapistsError) {
      await logError('admin.api.therapists.demand-digest', therapistsError, { stage: 'fetch_therapists' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch therapists' }, { status: 500 });
    }

    const therapists = (therapistsData as TherapistRow[] | null) || [];

    let processed = 0;
    let sent = 0;
    let skippedOptOut = 0;
    let skippedCooldown = 0;
    let skippedNoData = 0;
    let skippedNoEmail = 0;
    const examples: Array<{ id: string; city: string; demand_count: number }> = [];

    for (const t of therapists) {
      processed++;

      // Skip if no email
      const to = t.email || undefined;
      if (!to) {
        skippedNoEmail++;
        continue;
      }

      // Check opt-out
      const metadata = isObject(t.metadata) ? t.metadata : {};
      const notifications = isObject(metadata.notifications) ? (metadata.notifications as Record<string, unknown>) : {};
      const optedOut = Boolean(notifications.demand_digest_opt_out === true);
      if (optedOut && !testTherapistId) {
        skippedOptOut++;
        continue;
      }

      // Check cooldown (skip for test mode)
      if (!testTherapistId) {
        const history = await getDigestHistory(String(t.id));
        if (history.lastSentAt && Date.now() - history.lastSentAt.getTime() < COOLDOWN_MS) {
          skippedCooldown++;
          continue;
        }
      }

      // Build demand data for this therapist
      const therapistCity = t.city || '';
      const therapistSchwerpunkte = new Set(Array.isArray(t.schwerpunkte) ? t.schwerpunkte : []);
      const offersOnline = Array.isArray(t.session_preferences) && t.session_preferences.includes('online');

      // Combine city demand + online demand (avoid double-counting)
      const demandMap = new Map<string, number>();

      // Add city-specific demand
      // Match therapist city to demand cities (handle variations like "Berlin - Tegel & Mitte" -> "Berlin")
      for (const [demandCity, cityDemandMap] of demandByCityAndSchwerpunkt) {
        // Check if therapist's city matches or contains the demand city
        const cityMatches = therapistCity.toLowerCase().includes(demandCity.toLowerCase()) ||
                           demandCity.toLowerCase().includes(therapistCity.toLowerCase());
        if (cityMatches) {
          for (const [sp, count] of cityDemandMap) {
            demandMap.set(sp, (demandMap.get(sp) || 0) + count);
          }
        }
      }

      // Add online demand if therapist offers online
      // Note: some leads may overlap (want both in-person and online), but this gives
      // therapists a sense of the online market opportunity
      if (offersOnline) {
        for (const [sp, count] of demandByOnlineAndSchwerpunkt) {
          demandMap.set(sp, (demandMap.get(sp) || 0) + count);
        }
      }

      // Skip if no demand data for this therapist's region
      if (demandMap.size === 0) {
        skippedNoData++;
        continue;
      }

      // Build top demand list (sorted by count, top 5)
      // Shows absolute ranking so therapists can see both what they offer and what they don't
      const topDemand: DemandItem[] = Array.from(demandMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([sp, count]) => ({
          schwerpunkt: sp,
          count,
          offered: therapistSchwerpunkte.has(sp),
        }));

      // Opportunity gap: highest-demand schwerpunkt that therapist doesn't offer
      // (simpler than before - no gender data from leads, just schwerpunkt)
      let opportunityGap: OpportunityGap = null;
      const sortedDemand = Array.from(demandMap.entries()).sort((a, b) => b[1] - a[1]);
      for (const [sp, count] of sortedDemand) {
        if (!therapistSchwerpunkte.has(sp)) {
          opportunityGap = { schwerpunkt: sp, gender: null, count };
          break;
        }
      }

      const name = [(t.first_name || ''), (t.last_name || '')].join(' ').trim();
      const profileUrl = `${BASE_URL}/portal`;

      const token = await createTherapistOptOutToken(String(t.id));
      const optOutUrl = `${BASE_URL}/api/public/therapists/demand-digest-opt-out?token=${encodeURIComponent(token)}`;

      const digest = renderTherapistDemandDigest({
        name,
        city: therapistCity || 'deiner Region',
        topDemand,
        currentSchwerpunkte: Array.from(therapistSchwerpunkte),
        opportunityGap,
        profileUrl,
        optOutUrl,
      });

      if (dryRun) {
        sent++;
        if (examples.length < 5) {
          examples.push({
            id: t.id as string,
            city: therapistCity,
            demand_count: topDemand.reduce((sum, d) => sum + d.count, 0),
          });
        }
        continue;
      }

      try {
        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'admin.api.therapists.demand-digest',
          props: { stage: 'therapist_demand_digest', therapist_id: t.id, subject: digest.subject },
        });

        const emailResult = await sendTherapistEmail({
          to,
          subject: digest.subject,
          html: digest.html,
          headers: {
            'List-Unsubscribe': `<${optOutUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          context: { stage: 'therapist_demand_digest', therapist_id: t.id },
        });

        if (emailResult.sent) {
          sent++;
          if (examples.length < 5) {
            examples.push({
              id: t.id as string,
              city: therapistCity,
              demand_count: topDemand.reduce((sum, d) => sum + d.count, 0),
            });
          }
        } else if (emailResult.reason === 'failed') {
          await logError('admin.api.therapists.demand-digest', new Error('Email send returned false'), {
            stage: 'send_email_failed',
            therapist_id: t.id,
            email: to,
          }, ip, ua);
        }
      } catch (e) {
        await logError('admin.api.therapists.demand-digest', e, { stage: 'send_email', therapist_id: t.id }, ip, ua);
      }
    }

    // Monitoring: success completion
    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'admin.api.therapists.demand-digest',
      props: {
        processed,
        sent,
        skipped_opt_out: skippedOptOut,
        skipped_cooldown: skippedCooldown,
        skipped_no_data: skippedNoData,
        skipped_no_email: skippedNoEmail,
        duration_ms: Date.now() - startedAt,
        dry_run: dryRun,
      },
      ip,
      ua,
    });

    return NextResponse.json({
      data: {
        processed,
        sent,
        skipped_opt_out: skippedOptOut,
        skipped_cooldown: skippedCooldown,
        skipped_no_data: skippedNoData,
        skipped_no_email: skippedNoEmail,
        examples,
        dry_run: dryRun,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.therapists.demand-digest', e, { stage: 'exception' }, ip, ua);
    void track({
      type: 'cron_failed',
      level: 'error',
      source: 'admin.api.therapists.demand-digest',
      props: { duration_ms: Date.now() - startedAt },
      ip,
      ua,
    });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}

// Support POST for cron aggregator compatibility
export async function POST(req: Request) {
  return GET(req);
}
