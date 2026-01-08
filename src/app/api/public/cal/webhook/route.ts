/**
 * POST /api/public/cal/webhook
 *
 * Cal.com webhook ingestion endpoint (EARTH-245)
 *
 * WHY: Receive booking events from Cal.com and mirror them into Supabase
 * for attribution, analytics, and downstream automation (emails, follow-ups).
 *
 * EARTH-262: Idempotent on retry (upsert by cal_uid), tracks failures, alerts on 3+ failures.
 *
 * Contract:
 * - Input: CalWebhookBody (triggerEvent, payload with uid, organizer, attendees, metadata)
 * - Signature: x-cal-signature-256 HMAC-SHA256 of raw body with CAL_WEBHOOK_SECRET
 * - Output: { ok: true } on success, 401 on sig failure, 400 on validation failure
 */

import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import {
  CalWebhookBody,
  CAL_WEBHOOK_SIGNATURE_HEADER,
  type CalWebhookTriggerEvent,
} from '@/contracts/cal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAL_WEBHOOK_SECRET = process.env.CAL_WEBHOOK_SECRET || '';

// EARTH-262: Failure tracking threshold for admin alerts
const WEBHOOK_FAILURE_ALERT_THRESHOLD = 3;

/**
 * EARTH-262: Track webhook failures and alert admin if threshold exceeded
 */
async function trackWebhookFailure(
  calUid: string,
  triggerEvent: string,
  error: unknown,
  ip: string,
  ua: string
): Promise<void> {
  await logError('api.public.cal.webhook', error, {
    cal_uid: calUid,
    trigger_event: triggerEvent,
  });

  // Count recent failures for this cal_uid in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseServer
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'error')
    .gte('created_at', oneHourAgo)
    .contains('properties', { source: 'api.public.cal.webhook', cal_uid: calUid });

  const failureCount = (count ?? 0) + 1; // Include current failure

  // Track this specific failure
  void track({
    type: 'cal_webhook_failure',
    level: 'error',
    source: 'api.public.cal.webhook',
    ip,
    ua,
    props: {
      cal_uid: calUid,
      trigger_event: triggerEvent,
      failure_count: failureCount,
      error_message: error instanceof Error ? error.message : 'unknown',
    },
  });

  // Alert admin if threshold exceeded
  if (failureCount >= WEBHOOK_FAILURE_ALERT_THRESHOLD) {
    void track({
      type: 'cal_webhook_alert',
      level: 'error',
      source: 'api.public.cal.webhook',
      props: {
        cal_uid: calUid,
        trigger_event: triggerEvent,
        failure_count: failureCount,
        alert: `Cal.com webhook failed ${failureCount}+ times for booking ${calUid}`,
      },
    });

    // TODO: Send actual admin notification email when email templates are ready
    console.error(`[ALERT] Cal.com webhook failed ${failureCount}+ times for booking ${calUid}`);
  }
}

/**
 * Verify HMAC-SHA256 signature from Cal.com webhook
 */
function verifySignature(rawBody: string, signature: string): boolean {
  if (!CAL_WEBHOOK_SECRET || !signature) return false;

  try {
    const expected = createHmac('sha256', CAL_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    // Cal.com sends signature as hex string directly
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Map organizer.username to therapist_id via therapists.cal_username
 */
async function lookupTherapistId(calUsername: string | null | undefined): Promise<string | null> {
  if (!calUsername) return null;

  const { data } = await supabaseServer
    .from('therapists')
    .select('id')
    .eq('cal_username', calUsername)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Map patient email to patient_id via people table
 */
async function lookupPatientId(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;

  const { data } = await supabaseServer
    .from('people')
    .select('id')
    .eq('email', email.toLowerCase())
    .eq('type', 'patient')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Map analytics event name from Cal trigger event
 */
function getAnalyticsEventType(triggerEvent: CalWebhookTriggerEvent): string {
  switch (triggerEvent) {
    case 'BOOKING_CREATED':
      return 'cal_booking_created';
    case 'BOOKING_RESCHEDULED':
      return 'cal_booking_rescheduled';
    case 'BOOKING_CANCELLED':
      return 'cal_booking_cancelled';
    default:
      return 'cal_booking_event';
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = req.headers.get('user-agent') || '';

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get(CAL_WEBHOOK_SIGNATURE_HEADER) || '';

    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      void track({
        type: 'cal_webhook_signature_failed',
        level: 'warn',
        source: 'api.public.cal.webhook',
        props: { has_secret: Boolean(CAL_WEBHOOK_SECRET), has_signature: Boolean(signature) },
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse and validate body
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const result = CalWebhookBody.safeParse(parsed);
    if (!result.success) {
      await logError('api.public.cal.webhook', new Error('Validation failed'), {
        errors: result.error.flatten(),
        raw_keys: Object.keys(parsed as Record<string, unknown>),
      });
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const { triggerEvent, payload } = result.data;
    const { uid, eventTypeId, startTime, endTime, organizer, attendees, metadata, status } = payload;

    // Extract KH metadata if present
    const khMeta = metadata ?? {};
    const bookingKind = ('kh_booking_kind' in khMeta ? khMeta.kh_booking_kind : null) || null;
    const source = ('kh_source' in khMeta ? khMeta.kh_source : null) || null;
    const isTest = Boolean('kh_test' in khMeta ? khMeta.kh_test : false);
    const matchIdFromMeta = 'kh_match_id' in khMeta ? khMeta.kh_match_id : null;

    // Look up therapist by cal_username
    const organizerUsername = organizer?.username || null;
    const therapistId = await lookupTherapistId(organizerUsername);

    // Look up patient by attendee email (first attendee)
    const attendeeEmail = attendees?.[0]?.email || null;
    const patientId = await lookupPatientId(attendeeEmail);

    // Match ID from metadata
    const matchId = matchIdFromMeta || null;

    // Upsert into cal_bookings (idempotent by cal_uid)
    const { error: upsertError } = await supabaseServer
      .from('cal_bookings')
      .upsert(
        {
          cal_uid: uid,
          last_trigger_event: triggerEvent,
          organizer_username: organizerUsername,
          event_type_id: typeof eventTypeId === 'number' ? eventTypeId : null,
          start_time: startTime || null,
          end_time: endTime || null,
          therapist_id: therapistId,
          patient_id: patientId,
          match_id: matchId,
          booking_kind: bookingKind,
          source: source,
          status: status || null,
          is_test: isTest,
          metadata: khMeta,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'cal_uid' }
      );

    if (upsertError) {
      // EARTH-262: Track webhook failure and check if we need to alert
      await trackWebhookFailure(uid, triggerEvent, upsertError, ip, ua);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Track analytics event
    void track({
      type: getAnalyticsEventType(triggerEvent),
      level: 'info',
      source: 'api.public.cal.webhook',
      ip,
      ua,
      props: {
        cal_uid: uid,
        trigger_event: triggerEvent,
        therapist_id: therapistId,
        patient_id: patientId,
        match_id: matchId,
        booking_kind: bookingKind,
        source: source,
        is_test: isTest,
        organizer_username: organizerUsername,
        attendee_email: attendeeEmail ? '***' : null, // redact for privacy
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError('api.public.cal.webhook', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
