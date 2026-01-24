/**
 * GET /api/admin/cal/booking-followups
 *
 * Cron endpoint for Cal.com booking reminders (EARTH-261, EARTH-260)
 *
 * Usage:
 *   GET /api/admin/cal/booking-followups              (processes ALL stages)
 *   GET /api/admin/cal/booking-followups?stage=confirmation_recovery
 *   GET /api/admin/cal/booking-followups?stage=reminder_24h
 *   GET /api/admin/cal/booking-followups?stage=reminder_1h
 *   GET /api/admin/cal/booking-followups?stage=session_followup
 *
 * Stages:
 * - confirmation_recovery: Resend booking confirmations that failed during webhook
 * - reminder_24h: Send reminder 24h before appointment
 * - reminder_1h: Send reminder 1h before appointment
 * - session_followup: Send "book next session" email 3-5 days after completed full session
 *                     (only if therapist has available slots)
 *
 * NOTE: post_intro follow-up emails are now sent via MEETING_ENDED webhook
 * in /api/public/cal/webhook for immediate delivery after the call ends.
 *
 * Idempotency: Uses client_confirmation_sent_at, reminder_*_sent_at, session_followup_sent_at columns
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { track, logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { sendTransactionalSms } from '@/lib/sms/client';
import { renderCalBookingReminder } from '@/lib/email/templates/calBookingReminder';
import { renderCalSessionFollowup } from '@/lib/email/templates/calSessionFollowup';
import { renderCalBookingClientConfirmation } from '@/lib/email/templates/calBookingClientConfirmation';
import { getCachedCalSlots } from '@/lib/cal/slots-cache';
import { buildCalBookingUrl } from '@/lib/cal/booking-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || '';

type Stage = 'confirmation_recovery' | 'reminder_24h' | 'reminder_1h' | 'session_followup';

interface CalBooking {
  id: string;
  cal_uid: string;
  therapist_id: string | null;
  patient_id: string | null;
  match_id: string | null;
  start_time: string;
  end_time: string;
  booking_kind: string | null;
  is_test: boolean;
  client_confirmation_sent_at: string | null;
  therapist_notification_sent_at: string | null;
  followup_sent_at: string | null;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  session_followup_sent_at: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
}

function verifyCron(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${CRON_SECRET}`) return true;
  const token = req.nextUrl.searchParams.get('token');
  return token === CRON_SECRET;
}

type StageCounters = {
  processed: number;
  sent_email: number;
  sent_sms: number;
  skipped_already_sent: number;
  skipped_no_patient: number;
  skipped_no_contact: number;
  skipped_no_availability: number;
  skipped_test: number;
  errors: number;
};

async function processStage(
  stage: Stage,
  limit: number,
  _ip: string
): Promise<{ stage: Stage; counters: StageCounters }> {
  const counters: StageCounters = {
    processed: 0,
    sent_email: 0,
    sent_sms: 0,
    skipped_already_sent: 0,
    skipped_no_patient: 0,
    skipped_no_contact: 0,
    skipped_no_availability: 0,
    skipped_test: 0,
    errors: 0,
  };

  const now = new Date();
  let bookings: CalBooking[] = [];

  try {
    if (stage === 'confirmation_recovery') {
      // Find bookings where confirmation emails weren't sent
      // Created > 10 min ago (give webhook time), start_time in future, has patient+therapist
      const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
      const { data, error } = await supabaseServer
        .from('cal_bookings')
        .select('*')
        .lt('created_at', tenMinAgo)
        .gt('start_time', now.toISOString())
        .is('client_confirmation_sent_at', null)
        .not('patient_id', 'is', null)
        .not('therapist_id', 'is', null)
        .in('status', ['ACCEPTED', 'PENDING'])
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      bookings = (data || []) as CalBooking[];
    } else if (stage === 'reminder_24h') {
      const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
      const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseServer
        .from('cal_bookings')
        .select('*')
        .gte('start_time', windowStart)
        .lte('start_time', windowEnd)
        .is('reminder_24h_sent_at', null)
        .not('patient_id', 'is', null)
        .order('start_time', { ascending: true })
        .limit(limit);
      if (error) throw error;
      bookings = (data || []) as CalBooking[];
    } else if (stage === 'reminder_1h') {
      const windowStart = new Date(now.getTime() + 50 * 60 * 1000).toISOString();
      const windowEnd = new Date(now.getTime() + 70 * 60 * 1000).toISOString();
      const { data, error } = await supabaseServer
        .from('cal_bookings')
        .select('*')
        .gte('start_time', windowStart)
        .lte('start_time', windowEnd)
        .is('reminder_1h_sent_at', null)
        .not('patient_id', 'is', null)
        .order('start_time', { ascending: true })
        .limit(limit);
      if (error) throw error;
      bookings = (data || []) as CalBooking[];
    } else if (stage === 'session_followup') {
      // 3-5 days after session end (72h to 120h window)
      const windowStart = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const windowEnd = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseServer
        .from('cal_bookings')
        .select('*')
        .gte('end_time', windowStart)
        .lte('end_time', windowEnd)
        .eq('booking_kind', 'full_session')
        .is('session_followup_sent_at', null)
        .not('patient_id', 'is', null)
        .not('therapist_id', 'is', null)
        .order('end_time', { ascending: true })
        .limit(limit);
      if (error) throw error;
      bookings = (data || []) as CalBooking[];
    }

    for (const booking of bookings) {
      counters.processed++;

      if (booking.is_test) {
        counters.skipped_test++;
        continue;
      }

      // Patient lookup - MUST check error to catch schema mismatches
      const { data: patient, error: patientError } = await supabaseServer
        .from('people')
        .select('id, email, phone_number, name')
        .eq('id', booking.patient_id)
        .single();

      if (patientError) {
        // Log loudly - this should never happen silently
        await logError('api.admin.cal.booking-followups', patientError, {
          booking_id: booking.id,
          patient_id: booking.patient_id,
          stage,
          reason: 'patient_lookup_failed',
        });
        counters.errors++;
        continue;
      }

      if (!patient) {
        counters.skipped_no_patient++;
        continue;
      }

      const hasEmail = patient.email && !patient.email.startsWith('temp_');
      const hasPhone = Boolean(patient.phone_number);

      if (!hasEmail && !hasPhone) {
        counters.skipped_no_contact++;
        continue;
      }

      // Therapist lookup - MUST check error
      const { data: therapist, error: therapistError } = await supabaseServer
        .from('therapists')
        .select('id, first_name, last_name, cal_username')
        .eq('id', booking.therapist_id)
        .single();

      if (therapistError && therapistError.code !== 'PGRST116') {
        // PGRST116 = no rows found (acceptable), other errors are not
        await logError('api.admin.cal.booking-followups', therapistError, {
          booking_id: booking.id,
          therapist_id: booking.therapist_id,
          stage,
          reason: 'therapist_lookup_failed',
        });
        counters.errors++;
        continue;
      }

      const therapistName = therapist
        ? `${therapist.first_name || ''} ${therapist.last_name || ''}`.trim()
        : 'Ihr:e Therapeut:in';

      try {
        if (stage === 'confirmation_recovery') {
          // Resend booking confirmation email
          const { data: therapistData, error: therapistDataError } = await supabaseServer
            .from('therapists')
            .select('email, first_name, last_name, typical_rate')
            .eq('id', booking.therapist_id)
            .single();

          if (therapistDataError) {
            await logError('api.admin.cal.booking-followups', therapistDataError, {
              booking_id: booking.id,
              therapist_id: booking.therapist_id,
              stage,
              reason: 'therapist_data_lookup_failed',
            });
            counters.errors++;
            continue;
          }

          if (!therapistData) {
            // Therapist record doesn't exist - log as error, not silent skip
            await logError('api.admin.cal.booking-followups', new Error('Therapist not found'), {
              booking_id: booking.id,
              therapist_id: booking.therapist_id,
              stage,
              reason: 'therapist_not_found',
            });
            counters.errors++;
            continue;
          }

          const therapistFullName = [therapistData.first_name, therapistData.last_name]
            .filter(Boolean)
            .join(' ');

          // Parse date/time from start_time
          const startDate = new Date(booking.start_time);
          const dateIso = startDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
          const timeLabel = startDate.toLocaleTimeString('de-DE', {
            timeZone: 'Europe/Berlin',
            hour: '2-digit',
            minute: '2-digit',
          });

          const isIntro = booking.booking_kind === 'intro';

          if (hasEmail) {
            const content = renderCalBookingClientConfirmation({
              patientName: patient.name || null,
              patientEmail: patient.email,
              therapistName: therapistFullName,
              therapistEmail: therapistData.email,
              dateIso,
              timeLabel,
              isIntro,
              sessionPrice: therapistData.typical_rate || null,
              bookingUid: booking.cal_uid,
              locationType: 'video',
            });

            const result = await sendEmail({
              to: patient.email!,
              subject: content.subject,
              html: content.html,
              context: {
                kind: 'cal_booking_client_confirmation',
                cal_uid: booking.cal_uid,
                is_test: booking.is_test,
                recovery: true,
              },
            });

            if (result.sent) {
              counters.sent_email++;
              const { error: updateError } = await supabaseServer
                .from('cal_bookings')
                .update({ client_confirmation_sent_at: now.toISOString() })
                .eq('id', booking.id);
              if (updateError) {
                await logError('api.admin.cal.booking-followups', updateError, {
                  booking_id: booking.id,
                  stage,
                  reason: 'update_sent_at_failed',
                });
              }
            }
          }
        } else if (stage === 'session_followup') {
          // Check if therapist has available slots before sending
          const cachedSlots = await getCachedCalSlots([booking.therapist_id!]);
          const cache = cachedSlots.get(booking.therapist_id!);
          const hasAvailability = cache && (cache.full_slots_count || 0) > 0;

          if (!hasAvailability) {
            counters.skipped_no_availability++;
            continue;
          }

          // Build booking URL
          const fullSessionUrl = therapist?.cal_username
            ? buildCalBookingUrl({
                calUsername: therapist.cal_username,
                eventType: 'full_session',
                metadata: {
                  kh_therapist_id: booking.therapist_id!,
                  kh_patient_id: booking.patient_id!,
                  kh_match_id: booking.match_id || undefined,
                  kh_source: 'session_followup_email',
                },
                prefillName: patient.name || undefined,
                prefillEmail: patient.email || undefined,
              })
            : null;

          if (hasEmail && fullSessionUrl) {
            const content = renderCalSessionFollowup({
              patientName: patient.name || null,
              therapistName,
              fullSessionUrl,
              nextSlotDateIso: cache?.next_full_date_iso || null,
              nextSlotTimeLabel: cache?.next_full_time_label || null,
              matchUuid: booking.match_id,
            });
            const result = await sendEmail({
              to: patient.email!,
              subject: content.subject,
              html: content.html,
              context: { booking_id: booking.id, stage },
            });
            if (result.sent) {
              counters.sent_email++;
              const { error: updateError } = await supabaseServer
                .from('cal_bookings')
                .update({ session_followup_sent_at: now.toISOString() })
                .eq('id', booking.id);
              if (updateError) {
                await logError('api.admin.cal.booking-followups', updateError, {
                  booking_id: booking.id,
                  stage,
                  reason: 'update_session_followup_sent_at_failed',
                });
              }
            }
          }
        } else if (stage === 'reminder_24h' || stage === 'reminder_1h') {
          const startDate = new Date(booking.start_time);
          const dateStr = startDate.toLocaleDateString('de-DE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          });
          const timeStr = startDate.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Berlin'
          });

          let emailSent = false;
          let smsSent = false;

          if (hasEmail) {
            const content = renderCalBookingReminder({
              patientName: patient.name || null,
              therapistName,
              dateStr,
              timeStr,
              isOnline: booking.booking_kind !== 'in_person',
              hoursUntil: stage === 'reminder_24h' ? 24 : 1,
            });
            const result = await sendEmail({
              to: patient.email!,
              subject: content.subject,
              html: content.html,
              context: { booking_id: booking.id, stage },
            });
            if (result.sent) {
              counters.sent_email++;
              emailSent = true;
            }
          }

          if (hasPhone) {
            const smsText = stage === 'reminder_24h'
              ? `Erinnerung: Morgen ${timeStr} Uhr Termin mit ${therapistName}. Wir freuen uns auf Sie!`
              : `In 1 Stunde: Termin mit ${therapistName} um ${timeStr} Uhr. Bis gleich!`;
            const smsResult = await sendTransactionalSms(patient.phone_number!, smsText);
            if (smsResult) {
              counters.sent_sms++;
              smsSent = true;
            }
          }

          // Only mark as sent if at least one delivery succeeded
          if (emailSent || smsSent) {
            const updateField = stage === 'reminder_24h' ? 'reminder_24h_sent_at' : 'reminder_1h_sent_at';
            const { error: updateError } = await supabaseServer
              .from('cal_bookings')
              .update({ [updateField]: now.toISOString() })
              .eq('id', booking.id);
            if (updateError) {
              await logError('api.admin.cal.booking-followups', updateError, {
                booking_id: booking.id,
                stage,
                reason: 'update_reminder_sent_at_failed',
              });
            }
          }
        }
      } catch (err) {
        counters.errors++;
        await logError('api.admin.cal.booking-followups', err, {
          booking_id: booking.id,
          stage,
          patient_id: patient.id,
        });
      }
    }
  } catch (e) {
    await logError('api.admin.cal.booking-followups', e, { stage });
  }

  return { stage, counters };
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'cron';

  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stageParam = req.nextUrl.searchParams.get('stage') as Stage | null;
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 200);

  // If no stage specified, process ALL stages sequentially
  const allStages: Stage[] = ['confirmation_recovery', 'reminder_24h', 'reminder_1h', 'session_followup'];
  const stagesToProcess: Stage[] = stageParam && allStages.includes(stageParam)
    ? [stageParam]
    : allStages;

  try {
    const results: Array<{ stage: Stage; counters: StageCounters }> = [];
    
    for (const stage of stagesToProcess) {
      const result = await processStage(stage, limit, ip);
      results.push(result);
    }

    // Aggregate totals
    const totals = results.reduce(
      (acc, r) => ({
        processed: acc.processed + r.counters.processed,
        sent_email: acc.sent_email + r.counters.sent_email,
        sent_sms: acc.sent_sms + r.counters.sent_sms,
        skipped_already_sent: acc.skipped_already_sent + r.counters.skipped_already_sent,
        skipped_no_patient: acc.skipped_no_patient + r.counters.skipped_no_patient,
        skipped_no_contact: acc.skipped_no_contact + r.counters.skipped_no_contact,
        skipped_no_availability: acc.skipped_no_availability + r.counters.skipped_no_availability,
        skipped_test: acc.skipped_test + r.counters.skipped_test,
        errors: acc.errors + r.counters.errors,
      }),
      { processed: 0, sent_email: 0, sent_sms: 0, skipped_already_sent: 0, skipped_no_patient: 0, skipped_no_contact: 0, skipped_no_availability: 0, skipped_test: 0, errors: 0 } as StageCounters
    );

    void track({
      type: 'cal_booking_followups_completed',
      level: 'info',
      source: 'api.admin.cal.booking-followups',
      ip,
      props: { stages: stagesToProcess, totals },
    });

    return NextResponse.json({ ok: true, stages: stagesToProcess, results, totals });
  } catch (e) {
    await logError('api.admin.cal.booking-followups', e, { stages: stagesToProcess }, ip);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
