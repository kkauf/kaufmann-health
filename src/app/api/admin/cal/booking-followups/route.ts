/**
 * GET /api/admin/cal/booking-followups
 *
 * Cron endpoint for Cal.com booking follow-ups and reminders (EARTH-261, EARTH-260)
 *
 * Stages:
 * - post_intro: Send follow-up 30min after intro call ends (prompt full session booking)
 * - reminder_24h: Send reminder 24h before appointment
 * - reminder_1h: Send reminder 1h before appointment
 *
 * Idempotency: Uses followup_sent_at, reminder_24h_sent_at, reminder_1h_sent_at columns
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { track, logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { sendTransactionalSms } from '@/lib/sms/client';
import { renderCalIntroFollowup } from '@/lib/email/templates/calIntroFollowup';
import { renderCalBookingReminder } from '@/lib/email/templates/calBookingReminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || '';

type Stage = 'post_intro' | 'reminder_24h' | 'reminder_1h';

interface CalBooking {
  id: string;
  cal_uid: string;
  therapist_id: string | null;
  patient_id: string | null;
  start_time: string;
  end_time: string;
  booking_kind: string | null;
  is_test: boolean;
  followup_sent_at: string | null;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  metadata: Record<string, unknown> | null;
}

function verifyCron(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${CRON_SECRET}`) return true;
  const token = req.nextUrl.searchParams.get('token');
  return token === CRON_SECRET;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'cron';

  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stage = (req.nextUrl.searchParams.get('stage') || 'post_intro') as Stage;
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 200);

  const counters = {
    processed: 0,
    sent_email: 0,
    sent_sms: 0,
    skipped_already_sent: 0,
    skipped_no_patient: 0,
    skipped_no_contact: 0,
    skipped_test: 0,
    errors: 0,
  };

  try {
    const now = new Date();
    let bookings: CalBooking[] = [];

    if (stage === 'post_intro') {
      // Find intro bookings where end_time is 30+ min ago and followup not sent
      const cutoff = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const { data, error } = await supabaseServer
        .from('cal_bookings')
        .select('*')
        .eq('booking_kind', 'intro')
        .lt('end_time', cutoff)
        .is('followup_sent_at', null)
        .not('patient_id', 'is', null)
        .order('end_time', { ascending: true })
        .limit(limit);

      if (error) throw error;
      bookings = (data || []) as CalBooking[];
    } else if (stage === 'reminder_24h') {
      // Find bookings where start_time is within 24-25h from now and reminder not sent
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
      // Find bookings where start_time is within 1-2h from now and reminder not sent
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
    }

    for (const booking of bookings) {
      counters.processed++;

      if (booking.is_test) {
        counters.skipped_test++;
        continue;
      }

      // Get patient details
      const { data: patient } = await supabaseServer
        .from('people')
        .select('id, email, phone, first_name')
        .eq('id', booking.patient_id)
        .single();

      if (!patient) {
        counters.skipped_no_patient++;
        continue;
      }

      const hasEmail = patient.email && !patient.email.startsWith('temp_');
      const hasPhone = Boolean(patient.phone);

      if (!hasEmail && !hasPhone) {
        counters.skipped_no_contact++;
        continue;
      }

      // Get therapist details
      const { data: therapist } = await supabaseServer
        .from('therapists')
        .select('id, first_name, last_name, cal_username')
        .eq('id', booking.therapist_id)
        .single();

      const therapistName = therapist
        ? `${therapist.first_name || ''} ${therapist.last_name || ''}`.trim()
        : 'Ihr:e Therapeut:in';

      try {
        if (stage === 'post_intro') {
          // Send post-intro follow-up
          const calBaseUrl = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';
          const fullSessionUrl = therapist?.cal_username
            ? `${calBaseUrl}/${therapist.cal_username}/full-session`
            : null;

          if (hasEmail) {
            const content = renderCalIntroFollowup({
              patientName: patient.first_name || null,
              therapistName,
              fullSessionUrl,
            });
            const sent = await sendEmail({
              to: patient.email!,
              subject: content.subject,
              html: content.html,
              context: { booking_id: booking.id, stage },
            });
            if (sent.sent) counters.sent_email++;
          }

          if (hasPhone && !hasEmail) {
            // SMS for phone-only users
            const smsText = `Wie war Ihr Kennenlerngespräch mit ${therapistName}? Möchten Sie einen Folgetermin buchen? Antworten Sie auf diese Nachricht oder besuchen Sie kaufmann-health.de`;
            const smsResult = await sendTransactionalSms(patient.phone!, smsText);
            if (smsResult) counters.sent_sms++;
          }

          // Mark as sent
          await supabaseServer
            .from('cal_bookings')
            .update({ followup_sent_at: now.toISOString() })
            .eq('id', booking.id);

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

          if (hasEmail) {
            const content = renderCalBookingReminder({
              patientName: patient.first_name || null,
              therapistName,
              dateStr,
              timeStr,
              isOnline: booking.booking_kind !== 'in_person',
              hoursUntil: stage === 'reminder_24h' ? 24 : 1,
            });
            const sent = await sendEmail({
              to: patient.email!,
              subject: content.subject,
              html: content.html,
              context: { booking_id: booking.id, stage },
            });
            if (sent.sent) counters.sent_email++;
          }

          if (hasPhone) {
            // SMS reminder for all phone users
            const smsText = stage === 'reminder_24h'
              ? `Erinnerung: Morgen ${timeStr} Uhr Termin mit ${therapistName}. Wir freuen uns auf Sie!`
              : `In 1 Stunde: Termin mit ${therapistName} um ${timeStr} Uhr. Bis gleich!`;
            const smsResult = await sendTransactionalSms(patient.phone!, smsText);
            if (smsResult) counters.sent_sms++;
          }

          // Mark as sent
          const updateField = stage === 'reminder_24h' ? 'reminder_24h_sent_at' : 'reminder_1h_sent_at';
          await supabaseServer
            .from('cal_bookings')
            .update({ [updateField]: now.toISOString() })
            .eq('id', booking.id);
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

    void track({
      type: 'cal_booking_followups_completed',
      level: 'info',
      source: 'api.admin.cal.booking-followups',
      ip,
      props: { stage, ...counters },
    });

    return NextResponse.json({ ok: true, stage, ...counters });
  } catch (e) {
    await logError('api.admin.cal.booking-followups', e, { stage }, ip);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
