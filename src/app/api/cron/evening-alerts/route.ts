import { NextResponse } from 'next/server';

/**
 * POST /api/cron/evening-alerts
 * 
 * Runs daily at 8pm (20:00). Combines:
 * - ads/monitor (evening check with 1-day lookback)
 * - alerts/new-leads (also runs at 2pm separately if needed)
 * - alerts/user-errors-digest
 * - alerts/match-quality-report (moved from 7pm)
 * 
 * Evening monitoring, reporting, and digest.
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
    { name: 'ads-monitor-evening', path: '/api/admin/ads/monitor?apply=false&lookback=1&excludeToday=false&minSpendNoConv=30&budgetMultiple=1.5' },
    { name: 'new-leads', path: '/api/admin/alerts/new-leads?hours=6' },
    { name: 'user-errors-digest', path: '/api/admin/alerts/user-errors-digest' },
    { name: 'match-quality-report', path: '/api/admin/alerts/match-quality-report?days=1' },
  ];

  // Run sequentially to avoid overwhelming the system with reports
  for (const job of jobs) {
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
  }

  const allSuccess = Object.values(results).every(r => r.success);
  console.log('[cron/evening-alerts]', JSON.stringify(results));

  return NextResponse.json({ success: allSuccess, results });
}

export async function GET(req: Request) {
  return POST(req);
}
