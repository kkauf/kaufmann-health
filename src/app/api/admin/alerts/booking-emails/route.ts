/**
 * GET /api/admin/alerts/booking-emails
 *
 * Sanity check: bookings should have emails sent within expected timeframes.
 * Alerts when too many bookings are missing expected emails.
 *
 * Logic:
 * - Bookings 24h-7d old with valid patient should have client_confirmation_sent_at
 * - Bookings with start_time in past should have reminder_24h_sent_at (if created >24h before start)
 * - If >X bookings missing expected emails, alert loudly
 *
 * This catches silent failures in webhooks, crons, and schema mismatches.
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { isCronAuthorized } from '@/lib/cron-auth';
import { getAdminNotifyEmail } from '@/lib/email/notification-recipients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Alert thresholds
const MISSING_CONFIRMATION_THRESHOLD = 2; // Alert if >2 bookings missing confirmation
const MISSING_REMINDER_THRESHOLD = 3; // Alert if >3 bookings missing reminders

function roundToWindowStart(durationMin: number) {
  const ms = durationMin * 60 * 1000;
  return Math.floor(Date.now() / ms) * ms;
}

interface BookingRow {
  id: string;
  cal_uid: string;
  created_at: string;
  start_time: string;
  patient_id: string | null;
  therapist_id: string | null;
  client_confirmation_sent_at: string | null;
  reminder_24h_sent_at: string | null;
  is_test: boolean;
  status: string | null;
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'cron';
  const ua = req.headers.get('user-agent') || '';

  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find bookings 24h-7d old that should have confirmation emails
    const { data: bookings, error: bookingsError } = await supabaseServer
      .from('cal_bookings')
      .select('id, cal_uid, created_at, start_time, patient_id, therapist_id, client_confirmation_sent_at, reminder_24h_sent_at, is_test, status')
      .gte('created_at', sevenDaysAgo)
      .lte('created_at', oneDayAgo)
      .not('patient_id', 'is', null)
      .not('therapist_id', 'is', null)
      .in('status', ['ACCEPTED', 'PENDING', 'completed'])
      .eq('is_test', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (bookingsError) {
      await logError('admin.api.alerts.booking-emails', bookingsError, { stage: 'fetch_bookings' });
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }

    const rows = (bookings || []) as BookingRow[];

    // Check for missing confirmations
    const missingConfirmation = rows.filter(b => !b.client_confirmation_sent_at);

    // Check for missing 24h reminders (only for bookings where start_time is in the past)
    const missingReminder = rows.filter(b => {
      if (!b.start_time) return false;
      const startTime = new Date(b.start_time);
      const createdAt = new Date(b.created_at);
      // Only expect reminder if booking was created >24h before start
      const createdMoreThan24hBefore = (startTime.getTime() - createdAt.getTime()) > 24 * 60 * 60 * 1000;
      // And start time is in the past (session should have happened)
      const sessionPassed = startTime < now;
      return createdMoreThan24hBefore && sessionPassed && !b.reminder_24h_sent_at;
    });

    const issues: string[] = [];

    if (missingConfirmation.length > MISSING_CONFIRMATION_THRESHOLD) {
      issues.push(`${missingConfirmation.length} bookings missing client confirmation email`);
    }

    if (missingReminder.length > MISSING_REMINDER_THRESHOLD) {
      issues.push(`${missingReminder.length} bookings missing 24h reminder (sessions already happened)`);
    }

    // No issues - return quietly
    if (issues.length === 0) {
      void track({
        type: 'booking_email_sanity_check',
        level: 'info',
        source: 'admin.api.alerts.booking-emails',
        ip,
        props: {
          total_checked: rows.length,
          missing_confirmation: missingConfirmation.length,
          missing_reminder: missingReminder.length,
          status: 'ok',
        },
      });
      return NextResponse.json({
        ok: true,
        checked: rows.length,
        missing_confirmation: missingConfirmation.length,
        missing_reminder: missingReminder.length,
        alert_sent: false,
      });
    }

    // De-dupe: don't send same alert within 6 hours
    const windowStart = roundToWindowStart(360); // 6 hour window
    const digestKey = `booking_email_sanity_${windowStart}`;

    const { data: prior } = await supabaseServer
      .from('events')
      .select('id')
      .eq('type', 'internal_alert_sent')
      .contains('properties', { kind: 'booking_email_sanity', digest_key: digestKey })
      .limit(1);

    if (Array.isArray(prior) && prior.length > 0) {
      return NextResponse.json({
        ok: true,
        checked: rows.length,
        missing_confirmation: missingConfirmation.length,
        missing_reminder: missingReminder.length,
        alert_sent: false,
        reason: 'already_alerted_this_window',
      });
    }

    // Send alert
    const to = getAdminNotifyEmail();
    if (!to) {
      await logError('admin.api.alerts.booking-emails', new Error('Missing ADMIN_NOTIFY_EMAIL'), { stage: 'send' });
      return NextResponse.json({ error: 'Missing recipient' }, { status: 500 });
    }

    const lines: string[] = [];
    lines.push('🚨 BOOKING EMAIL SANITY CHECK FAILED');
    lines.push('');
    lines.push(`Checked ${rows.length} bookings from last 7 days.`);
    lines.push('');
    lines.push('Issues found:');
    for (const issue of issues) {
      lines.push(`- ${issue}`);
    }
    lines.push('');

    if (missingConfirmation.length > 0) {
      lines.push('Bookings missing confirmation (sample):');
      for (const b of missingConfirmation.slice(0, 5)) {
        lines.push(`  - ${b.cal_uid} (created ${b.created_at})`);
      }
      lines.push('');
    }

    if (missingReminder.length > 0) {
      lines.push('Bookings missing 24h reminder (sample):');
      for (const b of missingReminder.slice(0, 5)) {
        lines.push(`  - ${b.cal_uid} (start ${b.start_time})`);
      }
      lines.push('');
    }

    lines.push('Likely causes:');
    lines.push('- Webhook failures not being recovered');
    lines.push('- Cron job schema mismatch (column names)');
    lines.push('- Email send failures not being retried');
    lines.push('');
    lines.push('Next steps:');
    lines.push('- Check /admin/errors for email.client errors');
    lines.push('- Check Vercel logs for booking-followups cron');
    lines.push('- Verify cal_bookings columns match code expectations');

    const subject = `🚨 [KH] Booking emails failing: ${issues.join(', ')}`;

    const result = await sendEmail({
      to,
      subject,
      text: lines.join('\n'),
      context: {
        kind: 'booking_email_sanity',
        digest_key: digestKey,
        missing_confirmation: missingConfirmation.length,
        missing_reminder: missingReminder.length,
      },
    });

    if (result.sent) {
      void track({
        type: 'internal_alert_sent',
        level: 'error',
        source: 'admin.api.alerts.booking-emails',
        ip,
        props: {
          kind: 'booking_email_sanity',
          digest_key: digestKey,
          missing_confirmation: missingConfirmation.length,
          missing_reminder: missingReminder.length,
          issues,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      checked: rows.length,
      missing_confirmation: missingConfirmation.length,
      missing_reminder: missingReminder.length,
      alert_sent: result.sent,
      issues,
    });
  } catch (e) {
    await logError('admin.api.alerts.booking-emails', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = GET;
