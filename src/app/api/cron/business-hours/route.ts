import { NextResponse } from 'next/server';

/**
 * POST /api/cron/business-hours
 * 
 * Runs hourly 7am-8pm. Combines:
 * - matches/therapist-action-reminders - Remind therapists to respond
 * - leads/confirmation-reminders - Remind leads to confirm email
 * 
 * Both are time-sensitive nudges that should only run during business hours.
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
    { name: 'therapist-action-reminders', path: '/api/admin/matches/therapist-action-reminders?stage=20h' },
    { name: 'confirmation-reminders', path: '/api/admin/leads/confirmation-reminders?threshold=all&limit=200' },
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
  console.log('[cron/business-hours]', JSON.stringify(results));

  return NextResponse.json({ success: allSuccess, results });
}

export async function GET(req: Request) {
  return POST(req);
}
