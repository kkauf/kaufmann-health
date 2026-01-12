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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for warming all therapists

export async function GET(req: NextRequest) {
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

    return NextResponse.json(
      { error: 'Cache warming failed', details: errMsg },
      { status: 500 }
    );
  }
}
