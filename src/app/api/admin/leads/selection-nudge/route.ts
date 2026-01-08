import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderSelectionNudgeEmail } from '@/lib/email/templates/selectionNudge';
import { BASE_URL } from '@/lib/constants';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { isCronAuthorized as isCronAuthorizedShared, sameOrigin as sameOriginShared } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Send 5-6 days after email verification
const MIN_DAYS = 5;
const MAX_DAYS = 6;

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
async function alreadySentSelectionNudge(patientId: string): Promise<boolean> {
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

// Check if rich therapist email was sent (prerequisite)
async function richTherapistEmailSent(patientId: string): Promise<boolean> {
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
      if (kind === 'rich_therapist_d1' && pid === patientId) return true;
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

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.leads.selection_nudge', props: { limit }, ip, ua });

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
      await logError('admin.api.leads.selection_nudge', pErr, { stage: 'fetch_patients' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch patients' }, { status: 500 });
    }

    type PatientRow = { id: string; name?: string | null; email?: string | null; metadata?: Record<string, unknown> | null };
    const rows = (patients as PatientRow[] | null) || [];

    let processed = 0;
    let sent = 0;
    let skippedNoEmail = 0;
    let skippedOutsideWindow = 0;
    let skippedAlreadySent = 0;
    let skippedNoMatches = 0;
    let skippedHasSelection = 0;
    let skippedNoD1Email = 0;

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
      const alreadySent = await alreadySentSelectionNudge(patient.id);
      if (alreadySent) {
        skippedAlreadySent++;
        continue;
      }

      // Check if Day 1 email was sent (prerequisite)
      const d1Sent = await richTherapistEmailSent(patient.id);
      if (!d1Sent) {
        skippedNoD1Email++;
        continue;
      }

      // Check patient has matches and hasn't selected one yet
      const { data: matchRows } = await supabaseServer
        .from('matches')
        .select('id, therapist_id, status, secure_uuid, metadata')
        .eq('patient_id', patient.id)
        .limit(100);

      const matches = (matchRows as Array<{ id: string; therapist_id: string; status?: string | null; secure_uuid?: string | null; metadata?: Record<string, unknown> | null }> | null) || [];

      if (matches.length === 0) {
        skippedNoMatches++;
        continue;
      }

      // Skip if patient already selected or contacted a therapist
      const hasSelection = matches.some((m) => (m.status || '').toLowerCase() === 'patient_selected');
      const hasContacted = matches.some((m) => {
        const md = m.metadata;
        return md && typeof md === 'object' && (md as { patient_initiated?: boolean }).patient_initiated === true;
      });
      if (hasSelection || hasContacted) {
        skippedHasSelection++;
        continue;
      }

      // Get secure_uuid for matches page
      const secureUuid = matches.find((m) => m.secure_uuid)?.secure_uuid;
      if (!secureUuid) {
        skippedNoMatches++;
        continue;
      }

      // Build and send email
      const matchesUrl = `${BASE_URL}/matches/${encodeURIComponent(secureUuid)}`;

      try {
        const content = renderSelectionNudgeEmail({
          patientName: patient.name,
          matchesUrl,
        });

        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'admin.api.leads.selection_nudge',
          ip,
          ua,
          props: { kind: 'selection_nudge_d5', patient_id: patient.id, subject: content.subject },
        });

        const emailResult = await sendEmail({
          to: email,
          subject: content.subject,
          html: content.html,
          context: {
            kind: 'selection_nudge_d5',
            patient_id: patient.id,
            template: 'selection_nudge',
          },
        });

        if (emailResult.sent) {
          sent++;
        } else if (emailResult.reason === 'failed') {
          await logError('admin.api.leads.selection_nudge', new Error('Email send returned false'), { stage: 'send_failed', patient_id: patient.id }, ip, ua);
        }
      } catch (e) {
        await logError('admin.api.leads.selection_nudge', e, { stage: 'send_email', patient_id: patient.id }, ip, ua);
      }
    }

    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'admin.api.leads.selection_nudge',
      ip,
      ua,
      props: {
        processed,
        sent,
        skipped_no_email: skippedNoEmail,
        skipped_outside_window: skippedOutsideWindow,
        skipped_already_sent: skippedAlreadySent,
        skipped_no_matches: skippedNoMatches,
        skipped_has_selection: skippedHasSelection,
        skipped_no_d1_email: skippedNoD1Email,
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
        skipped_no_matches: skippedNoMatches,
        skipped_has_selection: skippedHasSelection,
        skipped_no_d1_email: skippedNoD1Email,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.leads.selection_nudge', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.leads.selection_nudge', ip, ua });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
