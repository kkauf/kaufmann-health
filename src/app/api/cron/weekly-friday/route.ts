import { NextResponse } from 'next/server';

/**
 * POST /api/cron/weekly-friday
 * 
 * Runs every Friday at 9am. Contains:
 * - therapists/availability-reminder - Remind therapists to update availability
 * 
 * Weekly therapist engagement.
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
    { name: 'availability-reminder', path: '/api/admin/therapists/availability-reminder?limit=100' },
  ];

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
  console.log('[cron/weekly-friday]', JSON.stringify(results));

  return NextResponse.json({ success: allSuccess, results });
}

export async function GET(req: Request) {
  return POST(req);
}
