/**
 * GET /api/admin/cal/booking-followups
 *
 * Cron endpoint for Cal.com booking follow-ups and reminders (EARTH-261, EARTH-260)
 *
 * Usage:
 *   GET /api/admin/cal/booking-followups              (processes ALL stages)
 *   GET /api/admin/cal/booking-followups?stage=post_intro
 *   GET /api/admin/cal/booking-followups?stage=reminder_24h
 *   GET /api/admin/cal/booking-followups?stage=reminder_1h
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

type StageCounters = {
  processed: number;
  sent_email: number;
  sent_sms: number;
  skipped_already_sent: number;
  skipped_no_patient: number;
  skipped_no_contact: number;
  skipped_test: number;
  errors: number;
};

async function processStage(
  stage: Stage,
  limit: number,
  ip: string
): Promise<{ stage: Stage; counters: StageCounters }> {
  const counters: StageCounters = {
    processed: 0,
    sent_email: 0,
    sent_sms: 0,
    skipped_already_sent: 0,
    skipped_no_patient: 0,
    skipped_no_contact: 0,
    skipped_test: 0,
    errors: 0,
  };

  const now = new Date();
  let bookings: CalBooking[] = [];

  try {
    if (stage === 'post_intro') {
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
    }

    for (const booking of bookings) {
      counters.processed++;

      if (booking.is_test) {
        counters.skipped_test++;
        continue;
      }

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
            const smsText = `Wie war Ihr Kennenlerngespräch mit ${therapistName}? Möchten Sie einen Folgetermin buchen? Antworten Sie auf diese Nachricht oder besuchen Sie kaufmann-health.de`;
            const smsResult = await sendTransactionalSms(patient.phone!, smsText);
            if (smsResult) counters.sent_sms++;
          }

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
            const smsText = stage === 'reminder_24h'
              ? `Erinnerung: Morgen ${timeStr} Uhr Termin mit ${therapistName}. Wir freuen uns auf Sie!`
              : `In 1 Stunde: Termin mit ${therapistName} um ${timeStr} Uhr. Bis gleich!`;
            const smsResult = await sendTransactionalSms(patient.phone!, smsText);
            if (smsResult) counters.sent_sms++;
          }

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
  const stagesToProcess: Stage[] = stageParam && ['post_intro', 'reminder_24h', 'reminder_1h'].includes(stageParam)
    ? [stageParam]
    : ['post_intro', 'reminder_24h', 'reminder_1h'];

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
        skipped_test: acc.skipped_test + r.counters.skipped_test,
        errors: acc.errors + r.counters.errors,
      }),
      { processed: 0, sent_email: 0, sent_sms: 0, skipped_already_sent: 0, skipped_no_patient: 0, skipped_no_contact: 0, skipped_test: 0, errors: 0 }
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
