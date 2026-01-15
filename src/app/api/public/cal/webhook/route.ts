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
import { sendEmail } from '@/lib/email/client';
import { renderCalBookingClientConfirmation } from '@/lib/email/templates/calBookingClientConfirmation';
import { renderCalBookingTherapistNotification } from '@/lib/email/templates/calBookingTherapistNotification';
import { buildCalBookingUrl } from '@/lib/cal/booking-url';
import {
  CalWebhookBody,
  CalWebhookProcessableEvent,
  CalWebhookBookingEvent,
  CalWebhookMeetingEvent,
  CalWebhookNoShowEvent,
  CAL_WEBHOOK_SIGNATURE_HEADER,
  type CalWebhookTriggerEvent,
} from '@/contracts/cal';
import { warmCacheForTherapist } from '@/lib/cal/slots-cache';
import { getCachedCalSlots } from '@/lib/cal/slots-cache';
import { renderCalIntroFollowup } from '@/lib/email/templates/calIntroFollowup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAL_WEBHOOK_SECRET = process.env.CAL_WEBHOOK_SECRET || '';
const LEADS_NOTIFY_EMAIL = (process.env.LEADS_NOTIFY_EMAIL || '').trim();

// EARTH-262: Failure tracking threshold for admin alerts
const WEBHOOK_FAILURE_ALERT_THRESHOLD = 3;

/**
 * Send Cal.com booking confirmation emails to client and therapist.
 * Called after webhook confirms BOOKING_CREATED.
 * 
 * Emails are idempotent: we check cal_bookings columns before sending
 * and update them after successful send.
 */
async function sendCalBookingEmails(params: {
  calUid: string;
  therapistId: string;
  patientId: string | null;
  attendeeEmail: string | null;
  attendeeName: string | null;
  startTime: string | null;
  bookingKind: string | null;
  isTest: boolean;
  // EARTH-273: Enhanced email fields
  videoUrl?: string | null;
  locationType?: 'video' | 'in_person';
  locationAddress?: string | null;
}): Promise<void> {
  const { calUid, therapistId, patientId, attendeeEmail, attendeeName, startTime, bookingKind, isTest, videoUrl, locationType, locationAddress } = params;
  
  // Check if emails already sent (idempotency)
  const { data: booking } = await supabaseServer
    .from('cal_bookings')
    .select('client_confirmation_sent_at, therapist_notification_sent_at')
    .eq('cal_uid', calUid)
    .maybeSingle();
  
  const clientAlreadySent = Boolean(booking?.client_confirmation_sent_at);
  const therapistAlreadySent = Boolean(booking?.therapist_notification_sent_at);
  
  if (clientAlreadySent && therapistAlreadySent) return;
  
  // Fetch therapist details
  const { data: therapist } = await supabaseServer
    .from('therapists')
    .select('email, first_name, last_name, typical_rate')
    .eq('id', therapistId)
    .maybeSingle();
  
  if (!therapist) return;
  
  const therapistName = [therapist.first_name || '', therapist.last_name || ''].filter(Boolean).join(' ');
  const therapistEmail = therapist.email || null;
  
  // Fetch patient details (if we have a patient_id)
  let patientName = attendeeName || null;
  let patientEmail = attendeeEmail || null;
  
  if (patientId) {
    const { data: patient } = await supabaseServer
      .from('people')
      .select('name, email')
      .eq('id', patientId)
      .maybeSingle();
    
    if (patient) {
      patientName = patient.name || patientName;
      patientEmail = patient.email || patientEmail;
    }
  }
  
  // Parse date/time from startTime (ISO format)
  let dateIso = '';
  let timeLabel = '';
  if (startTime) {
    try {
      const dt = new Date(startTime);
      // Format in Europe/Berlin timezone
      dateIso = dt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); // YYYY-MM-DD
      timeLabel = dt.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
    } catch {
      // Fallback: extract from ISO string
      dateIso = startTime.split('T')[0] || '';
      timeLabel = startTime.split('T')[1]?.slice(0, 5) || '';
    }
  }
  
  const isIntro = bookingKind === 'intro';
  const now = new Date().toISOString();
  
  // Determine recipient emails (test mode routes to sink)
  const clientRecipient = isTest ? (LEADS_NOTIFY_EMAIL || null) : patientEmail;
  const therapistRecipient = isTest ? (LEADS_NOTIFY_EMAIL || null) : therapistEmail;
  
  // Send client confirmation
  if (!clientAlreadySent && clientRecipient) {
    const content = renderCalBookingClientConfirmation({
      patientName,
      patientEmail,
      therapistName,
      therapistEmail,
      dateIso,
      timeLabel,
      isIntro,
      sessionPrice: therapist.typical_rate || null,
      // EARTH-273: Enhanced email fields
      bookingUid: calUid,
      videoUrl,
      locationType: locationType || 'video',
      locationAddress,
    });
    
    const sent = await sendEmail({
      to: clientRecipient,
      subject: content.subject,
      html: content.html,
      context: { kind: 'cal_booking_client_confirmation', cal_uid: calUid, is_test: isTest },
    });
    
    if (sent) {
      await supabaseServer
        .from('cal_bookings')
        .update({ client_confirmation_sent_at: now })
        .eq('cal_uid', calUid);
    }
  }
  
  // Send therapist notification
  if (!therapistAlreadySent && therapistRecipient) {
    const content = renderCalBookingTherapistNotification({
      therapistName,
      patientName,
      patientEmail,
      dateIso,
      timeLabel,
      isIntro,
    });
    
    const sent = await sendEmail({
      to: therapistRecipient,
      subject: content.subject,
      html: content.html,
      context: { kind: 'cal_booking_therapist_notification', cal_uid: calUid, is_test: isTest },
    });
    
    if (sent) {
      await supabaseServer
        .from('cal_bookings')
        .update({ therapist_notification_sent_at: now })
        .eq('cal_uid', calUid);
    }
  }
}

/**
 * Send intro follow-up email after MEETING_ENDED.
 * Prompts patient to book a full session.
 */
async function sendIntroFollowupEmail(params: {
  calUid: string;
  therapistId: string;
  patientId: string;
  matchId: string | null;
  isTest: boolean;
}): Promise<void> {
  const { calUid, therapistId, patientId, matchId, isTest } = params;

  // Check if already sent (idempotency)
  const { data: booking } = await supabaseServer
    .from('cal_bookings')
    .select('followup_sent_at')
    .eq('cal_uid', calUid)
    .maybeSingle();

  if (booking?.followup_sent_at) return;

  // Fetch patient details
  const { data: patient } = await supabaseServer
    .from('people')
    .select('email, first_name, phone')
    .eq('id', patientId)
    .maybeSingle();

  if (!patient) return;

  const hasEmail = patient.email && !patient.email.startsWith('temp_');
  if (!hasEmail) return; // SMS follow-up could be added later

  // Fetch therapist details
  const { data: therapist } = await supabaseServer
    .from('therapists')
    .select('first_name, last_name, cal_username')
    .eq('id', therapistId)
    .maybeSingle();

  const therapistName = therapist
    ? `${therapist.first_name || ''} ${therapist.last_name || ''}`.trim()
    : 'Ihr:e Therapeut:in';

  // Build full session URL with proper metadata for tracking
  const fullSessionUrl = therapist?.cal_username
    ? buildCalBookingUrl({
        calUsername: therapist.cal_username,
        eventType: 'full_session',
        metadata: {
          kh_therapist_id: therapistId,
          kh_patient_id: patientId,
          kh_match_id: matchId || undefined,
          kh_source: 'intro_followup_email',
        },
        prefillName: patient.first_name || undefined,
        prefillEmail: patient.email || undefined,
      })
    : null;

  // Fetch next full session slot from cache
  let nextSlotDateIso: string | null = null;
  let nextSlotTimeLabel: string | null = null;
  const cachedSlots = await getCachedCalSlots([therapistId]);
  const cached = cachedSlots.get(therapistId);
  if (cached?.next_full_date_iso && cached?.next_full_time_label) {
    nextSlotDateIso = cached.next_full_date_iso;
    nextSlotTimeLabel = cached.next_full_time_label;
  }

  // Render and send email
  const content = renderCalIntroFollowup({
    patientName: patient.first_name || null,
    therapistName,
    fullSessionUrl,
    nextSlotDateIso,
    nextSlotTimeLabel,
    matchUuid: matchId,
  });

  const recipient = isTest ? (LEADS_NOTIFY_EMAIL || null) : patient.email;
  if (!recipient) return;

  const sent = await sendEmail({
    to: recipient,
    subject: content.subject,
    html: content.html,
    context: { kind: 'cal_intro_followup', cal_uid: calUid, is_test: isTest },
  });

  if (sent) {
    await supabaseServer
      .from('cal_bookings')
      .update({ followup_sent_at: new Date().toISOString() })
      .eq('cal_uid', calUid);

    void track({
      type: 'cal_intro_followup_sent',
      level: 'info',
      source: 'api.public.cal.webhook',
      props: { cal_uid: calUid, therapist_id: therapistId, patient_id: patientId },
    });
  }
}

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
 * Returns { valid: true } or { valid: false, reason, debug }
 */
function verifySignature(rawBody: string, signature: string): { valid: boolean; reason?: string; debug?: Record<string, unknown> } {
  if (!CAL_WEBHOOK_SECRET) {
    return { valid: false, reason: 'no_secret_configured' };
  }
  if (!signature) {
    return { valid: false, reason: 'no_signature_header' };
  }

  try {
    const expected = createHmac('sha256', CAL_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    // Cal.com may send signature with or without prefix - normalize both
    const normalizedSig = signature.replace(/^sha256=/, '').toLowerCase();
    const normalizedExpected = expected.toLowerCase();

    // Quick string comparison first for debugging
    if (normalizedSig !== normalizedExpected) {
      return {
        valid: false,
        reason: 'signature_mismatch',
        debug: {
          sig_length: normalizedSig.length,
          expected_length: normalizedExpected.length,
          sig_prefix: normalizedSig.substring(0, 8),
          expected_prefix: normalizedExpected.substring(0, 8),
          body_length: rawBody.length,
          body_preview: rawBody.substring(0, 100),
        },
      };
    }

    // Timing-safe comparison for production security
    const sigBuffer = Buffer.from(normalizedSig, 'hex');
    const expectedBuffer = Buffer.from(normalizedExpected, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return { valid: false, reason: 'buffer_length_mismatch' };
    }

    if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { valid: false, reason: 'timing_safe_mismatch' };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, reason: 'exception', debug: { error: String(e) } };
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
    const sigResult = verifySignature(rawBody, signature);
    if (!sigResult.valid) {
      void track({
        type: 'cal_webhook_signature_failed',
        level: 'warn',
        source: 'api.public.cal.webhook',
        props: {
          has_secret: Boolean(CAL_WEBHOOK_SECRET),
          has_signature: Boolean(signature),
          reason: sigResult.reason,
          ...(sigResult.debug || {}),
        },
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

    // Check if this is an event we actually process into cal_bookings
    const isProcessable = CalWebhookProcessableEvent.safeParse(triggerEvent).success;
    if (!isProcessable) {
      // Log ALL non-processable events with full context for future analysis
      // This includes no-shows, meeting events, pings, etc.
      const { uid, organizer, attendees, metadata } = payload;
      void track({
        type: 'cal_webhook_received',
        level: 'info',
        source: 'api.public.cal.webhook',
        ip,
        ua,
        props: {
          trigger_event: triggerEvent,
          action: 'logged_not_processed',
          cal_uid: uid,
          organizer_username: organizer?.username || null,
          attendee_email: attendees?.[0]?.email || null,
          has_metadata: Boolean(metadata && Object.keys(metadata).length > 0),
        },
      });
      return NextResponse.json({ ok: true, message: `Event ${triggerEvent} acknowledged and logged` });
    }

    const { uid, eventTypeId, startTime, endTime, organizer, attendees, metadata, status } = payload;

    // uid is required for processable events (booking create/reschedule/cancel)
    if (!uid) {
      void track({
        type: 'cal_webhook_received',
        level: 'warn',
        source: 'api.public.cal.webhook',
        ip,
        ua,
        props: { trigger_event: triggerEvent, action: 'skipped_no_uid' },
      });
      return NextResponse.json({ ok: true, message: `Event ${triggerEvent} skipped (no uid)` });
    }

    // Extract KH metadata if present
    const khMeta = metadata ?? {};
    const bookingKindRaw = 'kh_booking_kind' in khMeta ? khMeta.kh_booking_kind : null;
    const bookingKind: string | null = typeof bookingKindRaw === 'string' ? bookingKindRaw : null;
    const sourceRaw = 'kh_source' in khMeta ? khMeta.kh_source : null;
    const source: string | null = typeof sourceRaw === 'string' ? sourceRaw : null;
    const isTest = Boolean('kh_test' in khMeta ? khMeta.kh_test : false);
    const matchIdFromMeta = 'kh_match_id' in khMeta ? khMeta.kh_match_id : null;
    const patientIdFromMeta = 'kh_patient_id' in khMeta && typeof khMeta.kh_patient_id === 'string' 
      ? khMeta.kh_patient_id 
      : null;
    
    // EARTH-273: Extract video URL from metadata
    const videoCallUrl = 'videoCallUrl' in khMeta && typeof khMeta.videoCallUrl === 'string'
      ? khMeta.videoCallUrl
      : null;
    
    // EARTH-273: Extract location type from payload.location
    const locationStr = typeof payload.location === 'string' ? payload.location : '';
    const isInPerson = locationStr.includes('inPerson') || locationStr.includes('attendeeAddress');
    const locationType: 'video' | 'in_person' = isInPerson ? 'in_person' : 'video';

    // Look up therapist by cal_username
    const organizerUsername = organizer?.username || null;
    const therapistId = await lookupTherapistId(organizerUsername);

    // Look up patient by attendee email, fallback to kh_patient_id from metadata
    const attendeeEmail = attendees?.[0]?.email || null;
    const patientIdFromEmail = await lookupPatientId(attendeeEmail);
    const patientId = patientIdFromEmail || patientIdFromMeta;

    // Match ID from metadata
    const matchId = matchIdFromMeta || null;

    // Upsert into cal_bookings (idempotent by cal_uid)
    // IMPORTANT: Only set booking_kind/source/is_test if webhook has values,
    // otherwise preserve existing values (native booking pre-inserts these)
    const upsertData: Record<string, unknown> = {
      cal_uid: uid,
      last_trigger_event: triggerEvent,
      organizer_username: organizerUsername,
      event_type_id: typeof eventTypeId === 'number' ? eventTypeId : null,
      start_time: startTime || null,
      end_time: endTime || null,
      therapist_id: therapistId,
      patient_id: patientId,
      match_id: matchId,
      status: status || null,
      updated_at: new Date().toISOString(),
    };
    // Only set these if webhook has values (preserve native booking pre-insert)
    if (bookingKind) upsertData.booking_kind = bookingKind;
    if (source) upsertData.source = source;
    if (isTest) upsertData.is_test = isTest;
    if (Object.keys(khMeta).length > 0) upsertData.metadata = khMeta;

    const { error: upsertError } = await supabaseServer
      .from('cal_bookings')
      .upsert(upsertData, { onConflict: 'cal_uid' });

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

    // Invalidate slots cache for this therapist (fire-and-forget)
    // This ensures future users see updated availability after this booking
    if (therapistId && organizerUsername) {
      void warmCacheForTherapist(therapistId, organizerUsername).catch((err: unknown) => {
        void logError('api.public.cal.webhook', err, { stage: 'cache_invalidation', therapist_id: therapistId });
      });
    }

    // Send confirmation emails for new bookings (fire-and-forget)
    // Only for BOOKING_CREATED to avoid duplicate emails on reschedule
    if (triggerEvent === 'BOOKING_CREATED' && therapistId) {
      // Check if location is NOT Cal.com Video - alert if so (we won't get MEETING_ENDED)
      const location = typeof payload.location === 'string' ? payload.location : '';
      const isCalVideo = location.includes('daily') || location.includes('cal.com') || location.includes('integrations:daily');
      if (!isCalVideo && location) {
        void track({
          type: 'cal_booking_non_cal_video',
          level: 'warn',
          source: 'api.public.cal.webhook',
          ip,
          ua,
          props: {
            cal_uid: uid,
            therapist_id: therapistId,
            location,
            warning: 'Therapist using non-Cal.com video. MEETING_ENDED webhook will not fire.',
          },
        });
        // Send admin alert
        if (LEADS_NOTIFY_EMAIL) {
          void sendEmail({
            to: LEADS_NOTIFY_EMAIL,
            subject: `⚠️ Therapist using non-Cal.com video: ${organizerUsername}`,
            text: `Booking ${uid} uses "${location}" instead of Cal.com Video.\n\nThis means we won't receive MEETING_ENDED webhook and cannot automatically send intro follow-up emails.\n\nTherapist should use Cal.com Video for proper tracking.`,
            context: { cal_uid: uid, alert: 'non_cal_video' },
          }).catch(() => {});
        }
      }

      // EARTH-273: Fetch therapist's practice address for in-person emails
      let locationAddress: string | null = null;
      if (locationType === 'in_person' && therapistId) {
        const { data: therapistData } = await supabaseServer
          .from('therapists')
          .select('metadata')
          .eq('id', therapistId)
          .maybeSingle();
        locationAddress = therapistData?.metadata?.profile?.practice_address || null;
      }

      void sendCalBookingEmails({
        calUid: uid,
        therapistId,
        patientId,
        attendeeEmail,
        attendeeName: attendees?.[0]?.name || null,
        startTime: startTime || null,
        bookingKind,
        isTest,
        // EARTH-273: Enhanced email fields
        videoUrl: videoCallUrl,
        locationType,
        locationAddress,
      }).catch((err: unknown) => {
        void logError('api.public.cal.webhook', err, { stage: 'send_emails', cal_uid: uid });
      });
    }

    // Handle MEETING_ENDED: Update status to completed and send intro follow-up
    if (triggerEvent === 'MEETING_ENDED' && !isTest) {
      // Update booking status to completed
      await supabaseServer
        .from('cal_bookings')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('cal_uid', uid);

      // Send intro follow-up email if this was an intro call
      if (bookingKind === 'intro' && patientId && therapistId) {
        void sendIntroFollowupEmail({
          calUid: uid,
          therapistId,
          patientId,
          matchId: typeof matchId === 'string' ? matchId : null,
          isTest,
        }).catch((err: unknown) => {
          void logError('api.public.cal.webhook', err, { stage: 'intro_followup', cal_uid: uid });
        });
      }
    }

    // Handle no-show events: Update status and send appropriate notifications
    if (CalWebhookNoShowEvent.safeParse(triggerEvent).success && !isTest) {
      let newStatus: string;
      let alertType: string;

      if (triggerEvent === 'AFTER_GUESTS_CAL_VIDEO_NO_SHOW') {
        newStatus = 'no_show_guest';
        alertType = 'guest_no_show';
        // TODO: Send re-engagement email to patient
      } else if (triggerEvent === 'AFTER_HOSTS_CAL_VIDEO_NO_SHOW') {
        newStatus = 'no_show_host';
        alertType = 'host_no_show';
        // Alert admin - therapist missed the call
        if (LEADS_NOTIFY_EMAIL) {
          void sendEmail({
            to: LEADS_NOTIFY_EMAIL,
            subject: `🚨 Therapist no-show: ${organizerUsername}`,
            text: `Therapist ${organizerUsername} did not join booking ${uid}.\n\nStart time: ${startTime}\nPatient email: ${attendeeEmail || 'unknown'}\n\nPlease follow up with the therapist.`,
            context: { cal_uid: uid, alert: alertType },
          }).catch(() => {});
        }
      } else {
        newStatus = 'no_show';
        alertType = 'no_show_manual';
      }

      await supabaseServer
        .from('cal_bookings')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('cal_uid', uid);

      void track({
        type: 'cal_booking_no_show',
        level: 'warn',
        source: 'api.public.cal.webhook',
        ip,
        ua,
        props: {
          cal_uid: uid,
          trigger_event: triggerEvent,
          therapist_id: therapistId,
          patient_id: patientId,
          status: newStatus,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError('api.public.cal.webhook', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
