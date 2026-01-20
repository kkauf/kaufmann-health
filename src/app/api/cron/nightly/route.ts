import { NextResponse } from 'next/server';

/**
 * POST /api/cron/nightly
 * 
 * Runs daily at 3am. Combines:
 * - cal/reconcile-bookings - Sync Cal.com bookings with local state
 * - ads/sync-spend - Sync Google Ads spend data
 * 
 * Maintenance tasks that run during low-traffic hours.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';
  const results: Record<string, { success: boolean; error?: string }> = {};

  const jobs = [
    { name: 'reconcile-bookings', path: '/api/admin/cal/reconcile-bookings?days=7' },
    { name: 'sync-spend', path: '/api/admin/ads/sync-spend?days=1' },
  ];

  // Run sequentially - these can be heavy operations
  for (const job of jobs) {
    try {
      const res = await fetch(`${baseUrl}${job.path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      });
      results[job.name] = { success: res.ok };
      if (!res.ok) {
        results[job.name].error = `HTTP ${res.status}`;
      }
    } catch (err) {
      results[job.name] = { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }

  const allSuccess = Object.values(results).every(r => r.success);
  console.log('[cron/nightly]', JSON.stringify(results));

  return NextResponse.json({ success: allSuccess, results });
}

export async function GET(req: Request) {
  return POST(req);
}
