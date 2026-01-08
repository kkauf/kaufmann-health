/**
 * POST /api/public/therapists/[id]/enable-cal
 * 
 * Enables Cal.com event types for a therapist (unhides them).
 * Called when therapist confirms they've set up their availability.
 */

import { NextResponse } from 'next/server';
import { getTherapistSession } from '@/lib/auth/therapistSession';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { Pool } from 'pg';

export const runtime = 'nodejs';

const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = req.headers.get('user-agent') || '';

  try {
    // Verify therapist session
    const session = await getTherapistSession(req);
    if (!session || session.therapist_id !== id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get therapist's cal_username
    const { data: therapist, error: fetchErr } = await supabaseServer
      .from('therapists')
      .select('cal_username')
      .eq('id', id)
      .single();

    if (fetchErr || !therapist?.cal_username) {
      return NextResponse.json({ error: 'Cal.com not set up' }, { status: 400 });
    }

    if (!CAL_DATABASE_URL) {
      return NextResponse.json({ error: 'Cal.com not configured' }, { status: 500 });
    }

    // Enable (unhide) event types in Cal.com
    const pool = new Pool({ connectionString: CAL_DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
      const result = await client.query(`
        UPDATE "EventType" e
        SET hidden = false
        FROM users u
        WHERE e."userId" = u.id 
          AND u.username = $1
          AND e.slug IN ('intro', 'full-session')
      `, [therapist.cal_username]);

      void track({
        type: 'therapist_cal_enabled',
        level: 'info',
        source: 'api.therapists.enable-cal',
        ip,
        ua,
        props: {
          therapist_id: id,
          cal_username: therapist.cal_username,
          event_types_enabled: result.rowCount,
        },
      });

      return NextResponse.json({ 
        success: true, 
        message: `${result.rowCount} event types enabled` 
      });
    } finally {
      client.release();
      await pool.end();
    }
  } catch (e) {
    await logError('api.therapists.enable-cal', e, { therapist_id: id }, ip, ua);
    return NextResponse.json({ error: 'Failed to enable Cal.com' }, { status: 500 });
  }
}
