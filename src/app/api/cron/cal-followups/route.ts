import { NextResponse } from 'next/server';

/**
 * POST /api/cron/cal-followups
 * 
 * Runs every 30 minutes. Combines:
 * - cal/booking-followups - Send follow-up emails after Cal.com bookings
 * - cal/cancellation-recovery - Attempt to recover cancelled bookings
 * 
 * Both are Cal.com related and can share the same schedule.
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
    { name: 'booking-followups', path: '/api/admin/cal/booking-followups?limit=50' },
    { name: 'cancellation-recovery', path: '/api/admin/cal/cancellation-recovery?limit=50' },
  ];

  await Promise.all(
    jobs.map(async (job) => {
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
    })
  );

  const allSuccess = Object.values(results).every(r => r.success);
  console.log('[cron/cal-followups]', JSON.stringify(results));

  return NextResponse.json({ success: allSuccess, results });
}

export async function GET(req: Request) {
  return POST(req);
}
