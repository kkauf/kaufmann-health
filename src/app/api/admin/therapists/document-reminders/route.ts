import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendTherapistEmail } from '@/lib/email/client';
import { renderTherapistDocumentReminder, type ReminderStage } from '@/lib/email/templates/therapistDocumentReminder';
import { BASE_URL } from '@/lib/constants';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { isCronAuthorized as isCronAuthorizedShared, sameOrigin as sameOriginShared } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reminder thresholds: 3 days, 10 days, 21 days after signup
// Spaced out to respect therapists' time for gathering documents
const THRESHOLDS: Record<ReminderStage, number> = {
  day3: 3 * 24 * 60 * 60 * 1000,
  day10: 10 * 24 * 60 * 60 * 1000,
  day21: 21 * 24 * 60 * 60 * 1000,
};

// Max reminders before stopping (after day21, we stop)
const MAX_REMINDERS = 3;

type TherapistRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  status?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

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

type EmailEventRow = { id: string; created_at?: string | null; properties?: Record<string, unknown> | null };

// Get reminder history for a therapist
async function getReminderHistory(therapistId: string): Promise<{ count: number; stages: Set<string>; lastSentAt: Date | null }> {
  try {
    const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // Last 30 days
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, created_at, properties')
      .eq('type', 'email_sent')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(500);
    
    if (error || !data) return { count: 0, stages: new Set(), lastSentAt: null };
    
    const stages = new Set<string>();
    let lastSentAt: Date | null = null;
    
    for (const row of data as EmailEventRow[]) {
      const props = (row.properties || {}) as Record<string, unknown>;
      const stage = typeof props['stage'] === 'string' ? props['stage'] : '';
      const tid = typeof props['therapist_id'] === 'string' ? props['therapist_id'] : '';
      
      if (stage.startsWith('therapist_document_reminder_') && tid === therapistId) {
        stages.add(stage);
        if (!lastSentAt && row.created_at) {
          lastSentAt = new Date(row.created_at);
        }
      }
    }
    
    return { count: stages.size, stages, lastSentAt };
  } catch {
    return { count: 0, stages: new Set(), lastSentAt: null };
  }
}

// Determine which reminder stage to send based on signup time and history
function determineReminderStage(createdAt: Date, sentStages: Set<string>): ReminderStage | null {
  const now = Date.now();
  const age = now - createdAt.getTime();

  // Check each stage in reverse order (latest first)
  if (age >= THRESHOLDS.day21 && !sentStages.has('therapist_document_reminder_day21')) {
    return 'day21';
  }
  if (age >= THRESHOLDS.day10 && !sentStages.has('therapist_document_reminder_day10')) {
    return 'day10';
  }
  if (age >= THRESHOLDS.day3 && !sentStages.has('therapist_document_reminder_day3')) {
    return 'day3';
  }

  return null;
}

async function processBatch(limit: number, req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  const now = Date.now();

  // Fetch pending_verification therapists (signed up but not yet approved)
  const { data, error } = await supabaseServer
    .from('therapists')
    .select('id, first_name, last_name, email, status, created_at, metadata')
    .eq('status', 'pending_verification')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    await logError('admin.api.therapists.document_reminders', error, { stage: 'fetch' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Failed to fetch' }, { status: 500 });
  }

  const rows = (data as TherapistRow[] | null) || [];

  let processed = 0;
  let sent = 0;
  let skippedTooRecent = 0;
  let skippedNoEmail = 0;
  let skippedCapped = 0;
  let skippedNoStage = 0;

  for (const row of rows) {
    if (processed >= limit) break;
    processed++;

    const email = (row.email || '').toLowerCase().trim();
    if (!email) {
      skippedNoEmail++;
      continue;
    }

    const createdAt = row.created_at ? new Date(row.created_at) : null;
    if (!createdAt) {
      skippedTooRecent++;
      continue;
    }

    // Check if signed up less than 3 days ago
    if (now - createdAt.getTime() < THRESHOLDS.day3) {
      skippedTooRecent++;
      continue;
    }

    // Get reminder history
    const history = await getReminderHistory(row.id);
    
    // Stop if we've sent max reminders
    if (history.count >= MAX_REMINDERS) {
      skippedCapped++;
      continue;
    }

    // Determine which stage to send
    const stage = determineReminderStage(createdAt, history.stages);
    if (!stage) {
      skippedNoStage++;
      continue;
    }

    // Build upload URL
    const uploadUrl = `${BASE_URL}/therapists/complete-profile/${row.id}`;
    const name = [row.first_name || '', row.last_name || ''].join(' ').trim();

    // Render and send email
    try {
      const emailStage = `therapist_document_reminder_${stage}`;
      const content = renderTherapistDocumentReminder({
        name: name || undefined,
        uploadUrl,
        stage,
      });

      void track({
        type: 'email_attempted',
        level: 'info',
        source: 'admin.api.therapists.document_reminders',
        ip,
        ua,
        props: { stage: emailStage, therapist_id: row.id, subject: content.subject },
      });

      const emailResult = await sendTherapistEmail({
        to: email,
        subject: content.subject,
        html: content.html,
        context: {
          stage: emailStage,
          therapist_id: row.id,
          template: 'therapist_document_reminder',
        },
      });

      if (emailResult.sent) {
        sent++;
      } else if (emailResult.reason === 'failed') {
        await logError('admin.api.therapists.document_reminders', new Error('Email send failed'), {
          stage: 'send_email_failed',
          therapist_id: row.id,
          email,
        }, ip, ua);
      }
    } catch (e) {
      await logError('admin.api.therapists.document_reminders', e, {
        stage: 'send_email',
        therapist_id: row.id,
      }, ip, ua);
    }
  }

  void track({
    type: 'cron_completed',
    level: 'info',
    source: 'admin.api.therapists.document_reminders',
    ip,
    ua,
    props: {
      processed,
      sent,
      skipped_too_recent: skippedTooRecent,
      skipped_no_email: skippedNoEmail,
      skipped_capped: skippedCapped,
      skipped_no_stage: skippedNoStage,
    },
  });

  return NextResponse.json({
    data: {
      processed,
      sent,
      skipped_too_recent: skippedTooRecent,
      skipped_no_email: skippedNoEmail,
      skipped_capped: skippedCapped,
      skipped_no_stage: skippedNoStage,
    },
    error: null,
  });
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

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

    void track({
      type: 'cron_executed',
      level: 'info',
      source: 'admin.api.therapists.document_reminders',
      ip,
      ua,
      props: { method: 'GET', limit },
    });

    return await processBatch(limit, req);
  } catch (e) {
    await logError('admin.api.therapists.document_reminders', e, { stage: 'exception' }, ip, ua);
    void track({
      type: 'cron_failed',
      level: 'error',
      source: 'admin.api.therapists.document_reminders',
      ip,
      ua,
      props: { method: 'GET' },
    });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    const isAdmin = await assertAdmin(req);
    const isCron = isCronAuthorized(req);
    
    if (!isAdmin && !isCron) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }
    if (isAdmin && !isCron && !sameOrigin(req)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body.limit || 100), 500));

    void track({
      type: 'cron_executed',
      level: 'info',
      source: 'admin.api.therapists.document_reminders',
      ip,
      ua,
      props: { method: 'POST', limit },
    });

    return await processBatch(limit, req);
  } catch (e) {
    await logError('admin.api.therapists.document_reminders', e, { stage: 'exception' }, ip, ua);
    void track({
      type: 'cron_failed',
      level: 'error',
      source: 'admin.api.therapists.document_reminders',
      ip,
      ua,
      props: { method: 'POST' },
    });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
