/**
 * GET /api/admin/cal/warm-cache
 *
 * Cron endpoint to warm Cal.com slots cache for all therapists (EARTH-248)
 * 
 * Called by Vercel cron every 15 minutes to ensure fresh availability data.
 * 
 * Auth: CRON_SECRET or admin session
 */

import { NextRequest, NextResponse } from 'next/server';
import { warmCacheForAllTherapists } from '@/lib/cal/slots-cache';
import { isCalDbEnabled } from '@/lib/cal/slots-db';
import { ServerAnalytics } from '@/lib/server-analytics';
import { fireCriticalAlert } from '@/lib/critical-alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for warming all therapists

async function handleRequest(req: NextRequest) {
  // Auth: Check CRON_SECRET or admin cookie
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const tokenParam = req.nextUrl.searchParams.get('token');

  const isAuthorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronSecret && tokenParam === cronSecret);

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if Cal DB is configured
  if (!isCalDbEnabled()) {
    return NextResponse.json(
      { error: 'Cal.com database not configured' },
      { status: 503 }
    );
  }

  const startTime = Date.now();

  try {
    const results = await warmCacheForAllTherapists();
    const durationMs = Date.now() - startTime;

    // Track analytics
    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'cal_cache_warmed',
      source: 'api.admin.cal.warm-cache',
      props: {
        total: results.total,
        success: results.success,
        failed: results.failed,
        duration_ms: durationMs,
      },
    });

    // Log summary
    console.log(
      `[cal/warm-cache] Completed: ${results.success}/${results.total} success, ${results.failed} failed, ${durationMs}ms`
    );

    if (results.errors.length > 0) {
      console.warn('[cal/warm-cache] Errors:', results.errors.slice(0, 5));
    }

    // CRITICAL: Alert if all therapists failed or high failure rate
    const failureRate = results.total > 0 ? results.failed / results.total : 0;
    if (results.total > 0 && (results.success === 0 || failureRate > 0.5)) {
      fireCriticalAlert({
        type: 'booking_system_down',
        message: `Cal.com cache warming has high failure rate: ${results.failed}/${results.total} failed (${Math.round(failureRate * 100)}%)`,
        details: {
          total: results.total,
          success: results.success,
          failed: results.failed,
          failure_rate: failureRate,
          sample_errors: results.errors.slice(0, 3),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      ...results,
      duration_ms: durationMs,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cal/warm-cache] Fatal error:', errMsg);

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'cal_cache_warm_failed',
      source: 'api.admin.cal.warm-cache',
      props: { error: errMsg },
    });

    // CRITICAL: Cache warming failed - booking system will degrade
    fireCriticalAlert({
      type: 'booking_system_down',
      message: `Cal.com cache warming failed: ${errMsg}. Booking system will show fallback to users.`,
      details: {
        error: errMsg,
        stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
      },
    });

    return NextResponse.json(
      { error: 'Cache warming failed', details: errMsg },
      { status: 500 }
    );
  }
}

// Export both GET and POST handlers (cron uses POST)
export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}
