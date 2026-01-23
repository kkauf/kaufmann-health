import { NextResponse } from 'next/server';

/**
 * POST /api/cron/frequent
 * 
 * Runs every 15 minutes. Combines:
 * - leads/conversions/backfill - Track conversion events
 * - alerts/system - System health monitoring
 * - cal/warm-cache - Keep Cal.com slot cache warm
 * 
 * These are lightweight, frequent operations that benefit from batching.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';
  const results: Record<string, { success: boolean; error?: string }> = {};

  // Run jobs in parallel since they're independent
  const jobs = [
    { name: 'conversions-backfill', path: '/api/admin/leads/conversions/backfill?limit=200' },
    { name: 'system-alerts', path: '/api/admin/alerts/system?minutes=15' },
    { name: 'cal-warm-cache', path: '/api/admin/cal/warm-cache' },
  ];

  await Promise.all(
    jobs.map(async (job) => {
      try {
        const res = await fetch(`${baseUrl}${job.path}`, {
          method: 'GET',
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
    })
  );

  const allSuccess = Object.values(results).every(r => r.success);
  console.log('[cron/frequent]', JSON.stringify(results));

  return NextResponse.json({ success: allSuccess, results });
}

export async function GET(req: Request) {
  return POST(req);
}
