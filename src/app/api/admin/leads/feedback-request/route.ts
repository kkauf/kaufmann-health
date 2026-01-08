import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderFeedbackRequestEmail } from '@/lib/email/templates/feedbackRequest';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { isCronAuthorized as isCronAuthorizedShared, sameOrigin as sameOriginShared } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Send 10-11 days after email verification
const MIN_DAYS = 10;
const MAX_DAYS = 11;

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

function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

// Check if we've already sent this email for this patient
async function alreadySentFeedbackRequest(patientId: string): Promise<boolean> {
  try {
    const sinceIso = daysAgo(60);
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, properties')
      .eq('type', 'email_sent')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) return false;
    const arr = (data as Array<{ properties?: Record<string, unknown> | null }> | null) || [];
    for (const e of arr) {
      const p = (e.properties && typeof e.properties === 'object' ? e.properties : null) as Record<string, unknown> | null;
      if (!p) continue;
      const kind = typeof p['kind'] === 'string' ? (p['kind'] as string) : '';
      const pid = typeof p['patient_id'] === 'string' ? (p['patient_id'] as string) : '';
      if (kind === 'feedback_request_d10' && pid === patientId) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Check if selection nudge email was sent (prerequisite)
async function selectionNudgeEmailSent(patientId: string): Promise<boolean> {
  try {
    const sinceIso = daysAgo(60);
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, properties')
      .eq('type', 'email_sent')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) return false;
    const arr = (data as Array<{ properties?: Record<string, unknown> | null }> | null) || [];
    for (const e of arr) {
      const p = (e.properties && typeof e.properties === 'object' ? e.properties : null) as Record<string, unknown> | null;
      if (!p) continue;
      const kind = typeof p['kind'] === 'string' ? (p['kind'] as string) : '';
      const pid = typeof p['patient_id'] === 'string' ? (p['patient_id'] as string) : '';
      if (kind === 'selection_nudge_d5' && pid === patientId) return true;
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
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 500));

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.leads.feedback_request', props: { limit }, ip, ua });

    const fromIso = daysAgo(MAX_DAYS);
    const toIso = daysAgo(MIN_DAYS);

    // Find eligible patients
    const { data: patients, error: pErr } = await supabaseServer
      .from('people')
      .select('id, name, email, metadata')
      .eq('type', 'patient')
      .eq('status', 'new')
      .limit(limit);

    if (pErr) {
      await logError('admin.api.leads.feedback_request', pErr, { stage: 'fetch_patients' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch patients' }, { status: 500 });
    }

    type PatientRow = { id: string; name?: string | null; email?: string | null; metadata?: Record<string, unknown> | null };
    const rows = (patients as PatientRow[] | null) || [];

    let processed = 0;
    let sent = 0;
    let skippedNoEmail = 0;
    let skippedOutsideWindow = 0;
    let skippedAlreadySent = 0;
    let skippedHasBooking = 0;
    let skippedNoD5Email = 0;

    for (const patient of rows) {
      if (processed >= limit) break;
      processed++;

      const email = (patient.email || '').trim().toLowerCase();
      const isTempEmail = email.startsWith('temp_') && email.endsWith('@kaufmann.health');
      if (!email || isTempEmail) {
        skippedNoEmail++;
        continue;
      }

      const meta = (patient.metadata || {}) as Record<string, unknown>;

      // Check email_confirmed_at is within window
      const confirmedAt = typeof meta['email_confirmed_at'] === 'string' ? meta['email_confirmed_at'] : null;
      if (!confirmedAt) {
        skippedOutsideWindow++;
        continue;
      }
      const confirmedTime = new Date(confirmedAt).getTime();
      const fromTime = new Date(fromIso).getTime();
      const toTime = new Date(toIso).getTime();
      if (confirmedTime < fromTime || confirmedTime > toTime) {
        skippedOutsideWindow++;
        continue;
      }

      // Check if already sent
      const alreadySent = await alreadySentFeedbackRequest(patient.id);
      if (alreadySent) {
        skippedAlreadySent++;
        continue;
      }

      // Check if Day 5 email was sent (prerequisite)
      const d5Sent = await selectionNudgeEmailSent(patient.id);
      if (!d5Sent) {
        skippedNoD5Email++;
        continue;
      }

      // Check if patient has booked (skip if they have)
      const { data: bookings } = await supabaseServer
        .from('matches')
        .select('id, status, metadata')
        .eq('patient_id', patient.id)
        .limit(100);

      const hasBooking = (bookings || []).some((b: { status?: string | null; metadata?: Record<string, unknown> | null }) => {
        const status = (b.status || '').toLowerCase();
        const md = b.metadata;
        const contacted = md && typeof md === 'object' && (md as { patient_initiated?: boolean }).patient_initiated === true;
        return status === 'patient_selected' || status === 'booked' || contacted;
      });

      if (hasBooking) {
        skippedHasBooking++;
        continue;
      }

      // Build and send email
      try {
        const content = renderFeedbackRequestEmail({
          patientName: patient.name,
          patientId: patient.id,
        });

        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'admin.api.leads.feedback_request',
          ip,
          ua,
          props: { kind: 'feedback_request_d10', patient_id: patient.id, subject: content.subject },
        });

        const emailResult = await sendEmail({
          to: email,
          subject: content.subject,
          html: content.html,
          context: {
            kind: 'feedback_request_d10',
            patient_id: patient.id,
            template: 'feedback_request',
          },
        });

        if (emailResult.sent) {
          sent++;
        } else if (emailResult.reason === 'failed') {
          await logError('admin.api.leads.feedback_request', new Error('Email send returned false'), { stage: 'send_failed', patient_id: patient.id }, ip, ua);
        }
      } catch (e) {
        await logError('admin.api.leads.feedback_request', e, { stage: 'send_email', patient_id: patient.id }, ip, ua);
      }
    }

    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'admin.api.leads.feedback_request',
      ip,
      ua,
      props: {
        processed,
        sent,
        skipped_no_email: skippedNoEmail,
        skipped_outside_window: skippedOutsideWindow,
        skipped_already_sent: skippedAlreadySent,
        skipped_has_booking: skippedHasBooking,
        skipped_no_d5_email: skippedNoD5Email,
        duration_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json({
      data: {
        processed,
        sent,
        skipped_no_email: skippedNoEmail,
        skipped_outside_window: skippedOutsideWindow,
        skipped_already_sent: skippedAlreadySent,
        skipped_has_booking: skippedHasBooking,
        skipped_no_d5_email: skippedNoD5Email,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.leads.feedback_request', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.leads.feedback_request', ip, ua });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
