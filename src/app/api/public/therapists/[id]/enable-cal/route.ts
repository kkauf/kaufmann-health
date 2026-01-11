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

    // Enable (unhide) event types and link to schedules in Cal.com
    const pool = new Pool({ connectionString: CAL_DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();

    try {
      // Get user ID
      const { rows: users } = await client.query(
        'SELECT id FROM users WHERE username = $1',
        [therapist.cal_username]
      );
      
      if (users.length === 0) {
        return NextResponse.json({ error: 'Cal.com user not found' }, { status: 400 });
      }
      
      const calUserId = users[0].id;
      
      // Get therapist's schedules
      const { rows: schedules } = await client.query(
        'SELECT id, name FROM "Schedule" WHERE "userId" = $1 ORDER BY id',
        [calUserId]
      );
      
      if (schedules.length === 0) {
        return NextResponse.json({ 
          error: 'Keine Zeitpläne gefunden. Bitte richte zuerst deine Verfügbarkeit in Cal.com ein.' 
        }, { status: 400 });
      }
      
      // Find appropriate schedules for each event type
      const kennenlernSchedule = schedules.find((s: { name: string }) => 
        s.name.toLowerCase().includes('kennenlerngespräch') || 
        s.name.toLowerCase().includes('kennenlerng')
      );
      const sitzungenSchedule = schedules.find((s: { name: string }) => 
        s.name.toLowerCase().includes('sitzung')
      );
      const defaultSchedule = schedules[0];
      
      const introScheduleId = (kennenlernSchedule || defaultSchedule).id;
      const fullSessionScheduleId = (sitzungenSchedule || defaultSchedule).id;
      
      // Update intro event type: unhide + link to schedule
      const introResult = await client.query(`
        UPDATE "EventType"
        SET hidden = false, "scheduleId" = $1
        WHERE "userId" = $2 AND slug = 'intro'
      `, [introScheduleId, calUserId]);
      
      // Update full-session event type: unhide + link to schedule
      const fullSessionResult = await client.query(`
        UPDATE "EventType"
        SET hidden = false, "scheduleId" = $1
        WHERE "userId" = $2 AND slug = 'full-session'
      `, [fullSessionScheduleId, calUserId]);
      
      const totalEnabled = (introResult.rowCount || 0) + (fullSessionResult.rowCount || 0);

      // Mark therapist as live in our database
      await supabaseServer
        .from('therapists')
        .update({ cal_bookings_live: true })
        .eq('id', id);

      void track({
        type: 'therapist_cal_enabled',
        level: 'info',
        source: 'api.therapists.enable-cal',
        ip,
        ua,
        props: {
          therapist_id: id,
          cal_username: therapist.cal_username,
          event_types_enabled: totalEnabled,
          intro_schedule_id: introScheduleId,
          full_session_schedule_id: fullSessionScheduleId,
        },
      });

      return NextResponse.json({ 
        success: true, 
        message: `${totalEnabled} Terminarten freigeschaltet` 
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
