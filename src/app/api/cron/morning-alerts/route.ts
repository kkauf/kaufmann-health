import { NextResponse } from 'next/server';

/**
 * POST /api/cron/morning-alerts
 *
 * Runs daily at 8am. Combines:
 * - ads/monitor (morning check with 3-day lookback)
 * - alerts/user-errors-digest
 * - alerts/booking-emails (sanity check for missed emails)
 * - alerts/unmatched-leads (safety net for leads >24h without matches)
 *
 * Morning monitoring and error digest.
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
    { name: 'ads-monitor-morning', path: '/api/admin/ads/monitor?apply=false&lookback=3&excludeToday=true&minSpendNoConv=30&budgetMultiple=2' },
    { name: 'user-errors-digest', path: '/api/admin/alerts/user-errors-digest' },
    { name: 'booking-emails-sanity', path: '/api/admin/alerts/booking-emails' },
    { name: 'unmatched-leads', path: '/api/admin/alerts/unmatched-leads' },
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
  console.log('[cron/morning-alerts]', JSON.stringify(results));

  return NextResponse.json({ success: allSuccess, results });
}

export async function GET(req: Request) {
  return POST(req);
}
