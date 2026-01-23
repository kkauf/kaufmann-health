import { NextResponse } from 'next/server';

/**
 * POST /api/cron/lead-nurturing
 * 
 * Runs daily at 9am. Combines:
 * - therapists/document-reminders - Remind pending therapists to upload documents (day 1, 3, 7)
 * - therapists/reminders - Remind verified therapists about incomplete profiles
 * - leads/rich-therapist-email - Send rich emails with therapist matches
 * - leads/selection-nudge - Nudge leads to select a therapist
 * 
 * Morning lead nurturing sequence.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';
  const results: Record<string, { success: boolean; error?: string }> = {};

  // Run sequentially to spread email load
  const jobs = [
    { name: 'therapist-document-reminders', path: '/api/admin/therapists/document-reminders?limit=100' },
    { name: 'therapist-reminders', path: '/api/admin/therapists/reminders?limit=200' },
    { name: 'rich-therapist-email', path: '/api/admin/leads/rich-therapist-email?limit=200' },
    { name: 'selection-nudge', path: '/api/admin/leads/selection-nudge?limit=200' },
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
  console.log('[cron/lead-nurturing]', JSON.stringify(results));

  return NextResponse.json({ success: allSuccess, results });
}

export async function GET(req: Request) {
  return POST(req);
}
