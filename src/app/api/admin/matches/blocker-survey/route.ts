import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderPatientBlockerSurvey } from '@/lib/email/templates/patientBlockerSurvey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

// Helper to detect if we've already sent the blocker survey for this match in the recent window
async function alreadySentForMatch(match_id: string): Promise<boolean> {
  try {
    const sinceIso = daysAgo(60); // generous lookback to avoid duplicates
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, created_at, properties')
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
      const mid = typeof p['match_id'] === 'string' ? (p['match_id'] as string) : '';
      if (kind === 'patient_blocker_survey' && mid === match_id) return true;
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
    // Auth: admin cookie or Cron secret headers
    const cronSecretHeader = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization') || '';
    const isAuthBearer = Boolean(cronSecret && authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret);
    let isCron = Boolean(cronSecret && cronSecretHeader && cronSecretHeader === cronSecret) || isAuthBearer;
    if (!isCron && req.headers.get('x-vercel-cron')) isCron = true;

    const isAdmin = await assertAdmin(req);
    if (!isAdmin && !isCron) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.matches.blocker_survey', props: {}, ip, ua });

    // Find patient selections that happened ~7 days ago
    const fromIso = daysAgo(8);
    const toIso = daysAgo(7);
    const { data: events, error: evErr } = await supabaseServer
      .from('events')
      .select('id, created_at, properties')
      .eq('type', 'patient_selected')
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .limit(5000);

    if (evErr) {
      await logError('admin.api.matches.blocker_survey', evErr, { stage: 'fetch_events' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch events' }, { status: 500 });
    }

    type EventRow = { id: string; created_at?: string | null; properties?: Record<string, unknown> | null; props?: Record<string, unknown> | null };
    const rows = (events as EventRow[] | null) || [];

    const matchIds = new Set<string>();
    for (const e of rows) {
      const p = (e.properties && typeof e.properties === 'object' ? e.properties : e.props && typeof e.props === 'object' ? e.props : null) as Record<string, unknown> | null;
      if (!p) continue;
      const mid = typeof p['match_id'] === 'string' ? (p['match_id'] as string) : '';
      if (mid) matchIds.add(mid);
    }

    let processed = 0;
    let sent = 0;
    let skippedStatus = 0;
    let skippedMissingEmail = 0;
    let skippedDuplicate = 0;
    let skippedTherapistContacted = 0;

    for (const match_id of matchIds) {
      processed++;
      // Load match and ensure still in patient_selected and no patient_confirmed_at
      const { data: matchRow } = await supabaseServer
        .from('matches')
        .select('id, patient_id, therapist_id, status, patient_confirmed_at, therapist_contacted_at')
        .eq('id', match_id)
        .maybeSingle();
      const m = (matchRow as { id: string; patient_id: string; therapist_id: string; status?: string | null; patient_confirmed_at?: string | null; therapist_contacted_at?: string | null } | null);
      if (!m) continue;
      const status = String(m.status || '').toLowerCase();
      if (status !== 'patient_selected' || m.patient_confirmed_at) {
        skippedStatus++;
        continue;
      }

      // If therapist has already initiated contact, skip this survey to avoid confusion
      if (m.therapist_contacted_at) {
        skippedTherapistContacted++;
        continue;
      }

      // De-dup per match
      const dup = await alreadySentForMatch(match_id);
      if (dup) {
        skippedDuplicate++;
        continue;
      }

      // Load entities
      const [{ data: patientRow }, { data: therapistRow }] = await Promise.all([
        supabaseServer.from('people').select('id, name, email').eq('id', m.patient_id).single(),
        supabaseServer.from('therapists').select('id, first_name, last_name').eq('id', m.therapist_id).single(),
      ]);

      const to = String(((patientRow as { email?: string | null } | null)?.email || '').trim());
      if (!to) {
        skippedMissingEmail++;
        continue;
      }
      const patientName = (patientRow as { name?: string | null } | null)?.name || null;
      const therapistFirst = (therapistRow as { first_name?: string | null } | null)?.first_name || '';
      const therapistLast = (therapistRow as { last_name?: string | null } | null)?.last_name || '';
      const therapistName = [therapistFirst || '', therapistLast || ''].join(' ').trim() || null;

      const content = renderPatientBlockerSurvey({ patientName, therapistName, matchId: match_id });

      try {
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.matches.blocker_survey', props: { match_id } });
        const emailSent = await sendEmail({ to, subject: content.subject, html: content.html, text: content.text, context: { kind: 'patient_blocker_survey', match_id } });
        if (emailSent) {
          sent++;
        } else {
          await logError('admin.api.matches.blocker_survey', new Error('Email send returned false'), { stage: 'send_email_failed', match_id, email: to }, ip, ua);
        }
      } catch (e) {
        await logError('admin.api.matches.blocker_survey', e, { stage: 'send_email', match_id }, ip, ua);
      }
    }

    void track({ type: 'cron_completed', level: 'info', source: 'admin.api.matches.blocker_survey', props: { processed, sent, skipped_status: skippedStatus, skipped_missing_email: skippedMissingEmail, skipped_duplicate: skippedDuplicate, skipped_therapist_contacted: skippedTherapistContacted, duration_ms: Date.now() - startedAt }, ip, ua });

    return NextResponse.json({ data: { processed, sent, skipped_status: skippedStatus, skipped_missing_email: skippedMissingEmail, skipped_duplicate: skippedDuplicate, skipped_therapist_contacted: skippedTherapistContacted }, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.matches.blocker_survey', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.matches.blocker_survey' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
