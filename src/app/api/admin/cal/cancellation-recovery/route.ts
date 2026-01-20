/**
 * GET /api/admin/cal/cancellation-recovery
 * 
 * Cron job that sends recovery emails to patients whose bookings were cancelled.
 * Runs hourly and targets cancellations from 2-4 hours ago.
 * 
 * WHY: Recover leads after a booking cancellation by showing alternative therapists.
 * The 2h delay avoids being intrusive while the experience is fresh.
 * 
 * Contract:
 * - Auth: Cron token or admin session
 * - Query params: limit (default 50)
 * - Returns: { processed, sent, skipped_* counters }
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderCancellationRecovery } from '@/lib/email/templates/cancellationRecovery';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { isCronAuthorized as isCronAuthorizedShared, sameOrigin as sameOriginShared } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Send 2-4 hours after cancellation
const MIN_HOURS = 2;
const MAX_HOURS = 4;

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

function isCronAuthorized(req: Request): boolean {
  return isCronAuthorizedShared(req);
}

function sameOrigin(req: Request): boolean {
  return sameOriginShared(req);
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

// Check if patient has any successful (non-cancelled) bookings
async function hasSuccessfulBooking(patientId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseServer
      .from('cal_bookings')
      .select('id')
      .eq('patient_id', patientId)
      .neq('status', 'CANCELLED')
      .limit(1);
    if (error) return false;
    return (data || []).length > 0;
  } catch {
    return false;
  }
}

// Check if we've already sent a recovery email for this patient (patient-level, not booking-level)
async function alreadySentRecoveryEmailForPatient(patientId: string): Promise<boolean> {
  try {
    const sinceIso = hoursAgo(72); // Look back 72h (covers the 2-4h window plus buffer)
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, properties')
      .eq('type', 'email_sent')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return false;
    const arr = (data as Array<{ properties?: Record<string, unknown> | null }> | null) || [];
    for (const e of arr) {
      const p = (e.properties && typeof e.properties === 'object' ? e.properties : null) as Record<string, unknown> | null;
      if (!p) continue;
      const kind = typeof p['kind'] === 'string' ? (p['kind'] as string) : '';
      const pid = typeof p['patient_id'] === 'string' ? (p['patient_id'] as string) : '';
      if (kind === 'cancellation_recovery' && pid === patientId) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  const startedAt = Date.now();

  try {
    const isAdmin = await assertAdmin(req);
    const isCron = isCronAuthorized(req);
    if (!isAdmin && !isCron) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }
    if (isAdmin && !isCron && !sameOrigin(req)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 50), 200));

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.cal.cancellation_recovery', props: { limit }, ip, ua });

    const fromIso = hoursAgo(MAX_HOURS);
    const toIso = hoursAgo(MIN_HOURS);

    // Find cancelled bookings in the window
    const { data: bookings, error: bErr } = await supabaseServer
      .from('cal_bookings')
      .select('cal_uid, patient_id, therapist_id, updated_at, is_test')
      .eq('status', 'CANCELLED')
      .gte('updated_at', fromIso)
      .lte('updated_at', toIso)
      .eq('is_test', false)
      .order('updated_at', { ascending: true })
      .limit(limit);

    if (bErr) {
      await logError('admin.api.cal.cancellation_recovery', bErr, { stage: 'fetch_bookings' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch bookings' }, { status: 500 });
    }

    type BookingRow = { cal_uid: string; patient_id: string | null; therapist_id: string | null; updated_at: string; is_test: boolean };
    const rows = (bookings as BookingRow[] | null) || [];

    let processed = 0;
    let sent = 0;
    let skippedNoPatient = 0;
    let skippedNoEmail = 0;
    let skippedAlreadySent = 0;
    let skippedHasSuccessfulBooking = 0;
    let skippedNoOtherMatches = 0;

    // Dedupe by patient_id - only process first cancellation per patient
    const seenPatients = new Set<string>();

    for (const booking of rows) {
      if (processed >= limit) break;
      processed++;

      if (!booking.patient_id) {
        skippedNoPatient++;
        continue;
      }

      // Skip if we've already processed this patient in this run
      if (seenPatients.has(booking.patient_id)) {
        continue;
      }
      seenPatients.add(booking.patient_id);

      // Check if patient has any successful (non-cancelled) bookings - they've recovered on their own
      const hasSuccessful = await hasSuccessfulBooking(booking.patient_id);
      if (hasSuccessful) {
        skippedHasSuccessfulBooking++;
        continue;
      }

      // Check if already sent recovery email to this patient (patient-level check)
      const alreadySent = await alreadySentRecoveryEmailForPatient(booking.patient_id);
      if (alreadySent) {
        skippedAlreadySent++;
        continue;
      }

      // Fetch patient info
      const { data: patient } = await supabaseServer
        .from('people')
        .select('id, name, email, metadata')
        .eq('id', booking.patient_id)
        .single();

      if (!patient) {
        skippedNoPatient++;
        continue;
      }

      const email = (patient.email || '').trim().toLowerCase();
      const isTempEmail = email.startsWith('temp_') && email.endsWith('@kaufmann.health');
      if (!email || isTempEmail) {
        skippedNoEmail++;
        continue;
      }

      // Fetch cancelled therapist name
      let cancelledTherapistName: string | null = null;
      if (booking.therapist_id) {
        const { data: therapist } = await supabaseServer
          .from('therapists')
          .select('first_name, last_name')
          .eq('id', booking.therapist_id)
          .single();
        if (therapist) {
          cancelledTherapistName = [therapist.first_name, therapist.last_name].filter(Boolean).join(' ') || null;
        }
      }

      // Count other matches (excluding the cancelled therapist)
      const { data: matches } = await supabaseServer
        .from('matches')
        .select('id, therapist_id, secure_uuid')
        .eq('patient_id', booking.patient_id)
        .neq('therapist_id', booking.therapist_id || '')
        .order('created_at', { ascending: false })
        .limit(10);

      const otherMatches = (matches || []).filter((m: { therapist_id: string }) => m.therapist_id !== booking.therapist_id);
      
      if (otherMatches.length === 0) {
        skippedNoOtherMatches++;
        continue;
      }

      // Get the secure_uuid from any match for this patient
      const { data: anyMatch } = await supabaseServer
        .from('matches')
        .select('secure_uuid')
        .eq('patient_id', booking.patient_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const matchesUrl = anyMatch?.secure_uuid ? `/matches/${anyMatch.secure_uuid}` : null;
      if (!matchesUrl) {
        skippedNoOtherMatches++;
        continue;
      }

      // Build and send email
      try {
        const content = renderCancellationRecovery({
          patientName: patient.name,
          cancelledTherapistName,
          matchesUrl,
          otherTherapistCount: otherMatches.length,
        });

        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'admin.api.cal.cancellation_recovery',
          ip,
          ua,
          props: { 
            kind: 'cancellation_recovery', 
            patient_id: booking.patient_id, 
            cal_uid: booking.cal_uid,
            subject: content.subject,
          },
        });

        const emailResult = await sendEmail({
          to: email,
          subject: content.subject,
          html: content.html,
          context: {
            kind: 'cancellation_recovery',
            patient_id: booking.patient_id,
            cal_uid: booking.cal_uid,
            template: 'cancellation_recovery',
          },
        });

        if (emailResult.sent) {
          sent++;
        } else if (emailResult.reason === 'failed') {
          await logError('admin.api.cal.cancellation_recovery', new Error('Email send returned false'), { stage: 'send_failed', patient_id: booking.patient_id, cal_uid: booking.cal_uid }, ip, ua);
        }
      } catch (e) {
        await logError('admin.api.cal.cancellation_recovery', e, { stage: 'send_email', patient_id: booking.patient_id, cal_uid: booking.cal_uid }, ip, ua);
      }
    }

    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'admin.api.cal.cancellation_recovery',
      ip,
      ua,
      props: {
        processed,
        sent,
        skipped_no_patient: skippedNoPatient,
        skipped_no_email: skippedNoEmail,
        skipped_already_sent: skippedAlreadySent,
        skipped_has_successful_booking: skippedHasSuccessfulBooking,
        skipped_no_other_matches: skippedNoOtherMatches,
        duration_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      data: {
        processed,
        sent,
        skipped_no_patient: skippedNoPatient,
        skipped_no_email: skippedNoEmail,
        skipped_already_sent: skippedAlreadySent,
        skipped_has_successful_booking: skippedHasSuccessfulBooking,
        skipped_no_other_matches: skippedNoOtherMatches,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.cal.cancellation_recovery', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.cal.cancellation_recovery', ip, ua });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
