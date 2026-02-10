/**
 * GET /api/admin/cal/reconcile-bookings
 * 
 * Nightly reconciliation: syncs KH-originated Cal.com bookings that may have
 * missed webhooks. Only syncs bookings with kh_* metadata to distinguish
 * KH bookings from therapists' own bookings.
 * 
 * Query params:
 *   - days: Number of days to look back (default: 7)
 *   - dryRun: If "true", logs but doesn't insert
 * 
 * Scheduled: Nightly at 3:00 AM UTC via vercel.json cron
 */
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { supabaseServer } from '@/lib/supabase-server';
import { track, logError } from '@/lib/logger';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface CalBooking {
  id: number;
  uid: string;
  userId: number;
  username: string;
  startTime: Date;
  endTime: Date;
  status: string;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
}

async function handler(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days') || '7', 10);
  const dryRun = url.searchParams.get('dryRun') === 'true';

  const calDbUrl = process.env.CAL_DATABASE_URL;
  if (!calDbUrl) {
    return NextResponse.json({ error: 'CAL_DATABASE_URL not configured' }, { status: 500 });
  }

  const pool = new Pool({
    connectionString: calDbUrl,
    ssl: { rejectUnauthorized: false },
  });

  let calClient;
  try {
    calClient = await pool.connect();

    // Get therapist mappings
    const { data: therapists } = await supabaseServer
      .from('therapists')
      .select('id, cal_username')
      .not('cal_username', 'is', null);

    const therapistMap = new Map<string, string>();
    for (const t of therapists || []) {
      if (t.cal_username) {
        therapistMap.set(t.cal_username, t.id);
      }
    }

    // Get existing bookings
    const { data: existingBookings } = await supabaseServer
      .from('cal_bookings')
      .select('cal_uid');

    const existingUids = new Set((existingBookings || []).map(b => b.cal_uid));

    // Get recent Cal.com bookings
    const result = await calClient.query<CalBooking>(`
      SELECT 
        b.id,
        b.uid,
        b."userId",
        u.username,
        b."startTime",
        b."endTime",
        b.status,
        b."createdAt",
        b.metadata
      FROM "Booking" b
      LEFT JOIN users u ON u.id = b."userId"
      WHERE b."createdAt" > NOW() - INTERVAL '${days} days'
      ORDER BY b."createdAt" DESC
    `);

    // Collect candidate patient IDs to validate against people table
    const candidatePatientIds = new Set<string>();
    for (const booking of result.rows) {
      const meta = booking.metadata || {};
      if (typeof meta.kh_patient_id === 'string') {
        candidatePatientIds.add(meta.kh_patient_id);
      }
    }

    // Validate which patient IDs actually exist
    const validPatientIds = new Set<string>();
    if (candidatePatientIds.size > 0) {
      const { data: existingPatients } = await supabaseServer
        .from('people')
        .select('id')
        .in('id', Array.from(candidatePatientIds));
      for (const p of existingPatients || []) {
        validPatientIds.add(p.id);
      }
    }

    // Filter to KH bookings not yet synced
    const toSync: Array<{
      cal_uid: string;
      last_trigger_event: string;
      organizer_username: string;
      start_time: string;
      end_time: string;
      therapist_id: string | null;
      patient_id: string | null;
      booking_kind: string | null;
      source: string | null;
      status: string;
      is_test: boolean;
      metadata: Record<string, unknown>;
    }> = [];

    for (const booking of result.rows) {
      if (existingUids.has(booking.uid)) continue;

      const meta = booking.metadata || {};
      const isKhBooking = 'kh_source' in meta || 'kh_booking_kind' in meta;
      if (!isKhBooking) continue;

      const therapistId = therapistMap.get(booking.username) || null;
      const rawPatientId = typeof meta.kh_patient_id === 'string' ? meta.kh_patient_id : null;
      const patientId = rawPatientId && validPatientIds.has(rawPatientId) ? rawPatientId : null;
      const rawKind = typeof meta.kh_booking_kind === 'string' ? meta.kh_booking_kind : null;
      const bookingKind = rawKind && ['intro', 'full_session'].includes(rawKind) ? rawKind : null;
      const rawSource = typeof meta.kh_source === 'string' ? meta.kh_source : null;
      const source = rawSource && ['directory', 'questionnaire'].includes(rawSource) ? rawSource : null;
      const isTest = meta.kh_test === true || meta.kh_test === 'true';

      toSync.push({
        cal_uid: booking.uid,
        last_trigger_event: 'RECONCILED',
        organizer_username: booking.username,
        start_time: booking.startTime.toISOString(),
        end_time: booking.endTime.toISOString(),
        therapist_id: therapistId,
        patient_id: patientId,
        booking_kind: bookingKind,
        source: source,
        status: booking.status,
        is_test: isTest,
        metadata: meta,
      });
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        calBookings: result.rows.length,
        existingBookings: existingUids.size,
        toSync: toSync.length,
        bookings: toSync.map(b => ({ cal_uid: b.cal_uid, organizer: b.organizer_username, kind: b.booking_kind })),
      });
    }

    let synced = 0;
    const errors: Array<{ cal_uid: string; error: string }> = [];
    for (const row of toSync) {
      const { error } = await supabaseServer
        .from('cal_bookings')
        .upsert(row, { onConflict: 'cal_uid' });

      if (error) {
        errors.push({ cal_uid: row.cal_uid, error: error.message });
      } else {
        synced++;
      }
    }

    if (errors.length > 0) {
      await logError('admin.cal.reconcile-bookings', new Error(`${errors.length}/${toSync.length} inserts failed`), { errors });
    }

    void track({
      type: 'cal_bookings_reconciled',
      level: 'info',
      source: 'api.admin.cal.reconcile-bookings',
      props: {
        days,
        calBookings: result.rows.length,
        existingBookings: existingUids.size,
        synced,
      },
    });

    return NextResponse.json({
      success: true,
      calBookings: result.rows.length,
      existingBookings: existingUids.size,
      synced,
    });

  } catch (err) {
    await logError('admin.cal.reconcile-bookings', err, { days });
    return NextResponse.json(
      { error: 'Internal error', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    );
  } finally {
    if (calClient) calClient.release();
    await pool.end();
  }
}

export const GET = handler;
export const POST = handler;
