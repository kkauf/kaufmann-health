/**
 * GET /api/admin/therapists/[id]/cal-status
 *
 * Check Cal.com integration health status for a therapist.
 * Returns detailed status about event types, schedules, and availability.
 *
 * Contract:
 * - Input: None (therapist ID from URL)
 * - Output: { data: CalHealthStatus, error }
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError } from '@/lib/logger';
import { Pool } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;
const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k && typeof v === 'string') map.set(k, decodeURIComponent(v));
  }
  return map;
}

async function assertAdmin(req: Request): Promise<boolean> {
  try {
    const header = req.headers.get('cookie');
    const token = parseCookie(header).get(ADMIN_SESSION_COOKIE);
    if (!token) return false;
    return await verifySessionToken(token);
  } catch {
    return false;
  }
}

export interface CalHealthStatus {
  provisioned: boolean;
  cal_user_id: number | null;
  cal_username: string | null;
  booking_url: string | null;
  event_types: {
    intro: { exists: boolean; visible: boolean; has_schedule: boolean; schedule_name?: string } | null;
    full_session: { exists: boolean; visible: boolean; has_schedule: boolean; schedule_name?: string } | null;
  };
  schedules: { id: number; name: string; has_availability: boolean }[];
  issues: string[];
  ready_for_bookings: boolean;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await ctx.params;

    // Get therapist Cal.com info
    const { data: therapist, error: fetchErr } = await supabaseServer
      .from('therapists')
      .select('cal_user_id, cal_username, cal_enabled')
      .eq('id', id)
      .single();

    if (fetchErr || !therapist) {
      return NextResponse.json({ data: null, error: 'Therapist not found' }, { status: 404 });
    }

    const calUserId = therapist.cal_user_id;
    const calUsername = therapist.cal_username;
    const calEnabled = therapist.cal_enabled;

    // If no Cal.com account, return basic status
    if (!calUserId) {
      const status: CalHealthStatus = {
        provisioned: false,
        cal_user_id: null,
        cal_username: calUsername || null,
        booking_url: calUsername ? `${CAL_ORIGIN}/${calUsername}` : null,
        event_types: { intro: null, full_session: null },
        schedules: [],
        issues: ['Kein Cal.com Konto provisioniert'],
        ready_for_bookings: false,
      };
      return NextResponse.json({ data: status, error: null });
    }

    if (!CAL_DATABASE_URL) {
      return NextResponse.json({ data: null, error: 'Cal.com database not configured' }, { status: 500 });
    }

    const pool = new Pool({ connectionString: CAL_DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
      const client = await pool.connect();

      // Get event types with schedule info
      const { rows: eventTypes } = await client.query(
        `SELECT et.id, et.slug, et.hidden, et."scheduleId", s.name as schedule_name
         FROM "EventType" et
         LEFT JOIN "Schedule" s ON s.id = et."scheduleId"
         WHERE et."userId" = $1`,
        [calUserId]
      );

      // Get all schedules with availability count
      const { rows: schedules } = await client.query(
        `SELECT s.id, s.name, COUNT(a.id) as availability_count
         FROM "Schedule" s
         LEFT JOIN "Availability" a ON a."scheduleId" = s.id
         WHERE s."userId" = $1
         GROUP BY s.id, s.name
         ORDER BY s.id`,
        [calUserId]
      );

      client.release();

      // Build status
      const introEvent = eventTypes.find(e => e.slug === 'intro');
      const fullSessionEvent = eventTypes.find(e => e.slug === 'full-session');

      const issues: string[] = [];

      // Check intro event
      const introStatus = introEvent
        ? {
            exists: true,
            visible: !introEvent.hidden,
            has_schedule: introEvent.scheduleId !== null,
            schedule_name: introEvent.schedule_name || undefined,
          }
        : null;

      if (!introEvent) {
        issues.push('Kein "intro" Event-Typ vorhanden');
      } else {
        if (introEvent.hidden) issues.push('"intro" Event-Typ ist versteckt');
        if (!introEvent.scheduleId) issues.push('"intro" Event-Typ hat keinen Zeitplan verknüpft');
      }

      // Check full-session event
      const fullSessionStatus = fullSessionEvent
        ? {
            exists: true,
            visible: !fullSessionEvent.hidden,
            has_schedule: fullSessionEvent.scheduleId !== null,
            schedule_name: fullSessionEvent.schedule_name || undefined,
          }
        : null;

      if (!fullSessionEvent) {
        issues.push('Kein "full-session" Event-Typ vorhanden');
      } else {
        if (fullSessionEvent.hidden) issues.push('"full-session" Event-Typ ist versteckt');
        if (!fullSessionEvent.scheduleId) issues.push('"full-session" Event-Typ hat keinen Zeitplan verknüpft');
      }

      // Check schedules
      const schedulesWithAvailability = schedules.map(s => ({
        id: s.id,
        name: s.name,
        has_availability: parseInt(s.availability_count) > 0,
      }));

      if (schedules.length === 0) {
        issues.push('Keine Zeitpläne vorhanden');
      } else {
        const noAvailability = schedules.filter(s => parseInt(s.availability_count) === 0);
        if (noAvailability.length > 0) {
          issues.push(`Zeitplan(e) ohne Verfügbarkeit: ${noAvailability.map(s => s.name).join(', ')}`);
        }
      }

      if (!calEnabled) {
        issues.push('Cal.com Booking ist deaktiviert');
      }

      // Determine if ready for bookings
      const readyForBookings =
        calEnabled &&
        introEvent &&
        !introEvent.hidden &&
        introEvent.scheduleId !== null &&
        fullSessionEvent &&
        !fullSessionEvent.hidden &&
        fullSessionEvent.scheduleId !== null &&
        schedules.some(s => parseInt(s.availability_count) > 0);

      const status: CalHealthStatus = {
        provisioned: true,
        cal_user_id: calUserId,
        cal_username: calUsername || null,
        booking_url: calUsername ? `${CAL_ORIGIN}/${calUsername}` : null,
        event_types: {
          intro: introStatus,
          full_session: fullSessionStatus,
        },
        schedules: schedulesWithAvailability,
        issues,
        ready_for_bookings: readyForBookings,
      };

      return NextResponse.json({ data: status, error: null });
    } finally {
      await pool.end();
    }
  } catch (e) {
    await logError('admin.api.therapists.cal-status', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Internal error' }, { status: 500 });
  }
}
