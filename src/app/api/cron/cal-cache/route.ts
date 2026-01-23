/**
 * POST /api/cron/cal-cache
 * 
 * CRITICAL: Dedicated cron for Cal.com slot cache warming.
 * Runs every 10 minutes (more frequent than other crons).
 * 
 * This is separate from /api/cron/frequent because:
 * 1. It's critical booking infrastructure
 * 2. It needs higher frequency (10 min vs 15 min)
 * 3. Failures need immediate alerting
 * 4. Should be independently monitorable
 */

import { NextResponse } from 'next/server';
import { fireCriticalAlert } from '@/lib/critical-alerts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';
  const startTime = Date.now();

  try {
    const res = await fetch(`${baseUrl}/api/admin/cal/warm-cache`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const durationMs = Date.now() - startTime;
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'unknown');
      console.error(`[cron/cal-cache] warm-cache failed: HTTP ${res.status}`, errorText);
      
      // Fire critical alert for cron failure
      fireCriticalAlert({
        type: 'booking_system_down',
        message: `Cal cache cron failed: HTTP ${res.status}`,
        details: {
          status: res.status,
          error: errorText.slice(0, 500),
          duration_ms: durationMs,
        },
      });

      return NextResponse.json({ 
        success: false, 
        error: `HTTP ${res.status}`,
        duration_ms: durationMs,
      }, { status: 500 });
    }

    const result = await res.json().catch(() => ({}));
    console.log(`[cron/cal-cache] Success: ${result.success}/${result.total} in ${durationMs}ms`);

    return NextResponse.json({ 
      success: true, 
      ...result,
      duration_ms: durationMs,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    const durationMs = Date.now() - startTime;
    
    console.error('[cron/cal-cache] Fatal error:', errMsg);

    // Fire critical alert
    fireCriticalAlert({
      type: 'booking_system_down',
      message: `Cal cache cron threw exception: ${errMsg}`,
      details: {
        error: errMsg,
        duration_ms: durationMs,
      },
    });

    return NextResponse.json({ 
      success: false, 
      error: errMsg,
      duration_ms: durationMs,
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
