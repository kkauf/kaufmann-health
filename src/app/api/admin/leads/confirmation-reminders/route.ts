import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderEmailConfirmation } from '@/lib/email/templates/emailConfirmation';
import { BASE_URL } from '@/lib/constants';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { randomUUID } from 'crypto';
import { isCronAuthorized as isCronAuthorizedShared, sameOrigin as sameOriginShared } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reminder thresholds: 24h (default) and optional 72h final reminder
const THRESHOLDS = { '24h': 24 * 60 * 60 * 1000, '72h': 72 * 60 * 60 * 1000 } as const;

function parseThreshold(input?: string | null): keyof typeof THRESHOLDS {
  const t = (input || '').trim();
  return (t === '72h' ? '72h' : '24h');
}

// --- Auth helpers aligned with therapist reminders ---
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

// Check if a reminder for a given stage has already been sent (via events table)
async function alreadyReminded(leadId: string, stage: string): Promise<boolean> {
  try {
    const sinceIso = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, properties')
      .eq('type', 'email_sent')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error || !data) return false;
    for (const row of data as Array<{ properties?: Record<string, unknown> | null }>) {
      const props = (row.properties || {}) as Record<string, unknown>;
      const st = typeof props['stage'] === 'string' ? (props['stage'] as string) : '';
      const id = typeof props['lead_id'] === 'string' ? (props['lead_id'] as string) : '';
      if (st === stage && id === leadId) return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function processBatch(thresholdKey: keyof typeof THRESHOLDS, limit: number, req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  const thresholdMs = THRESHOLDS[thresholdKey];
  const stage = thresholdKey === '72h' ? 'patient_confirmation_reminder_72h' : 'patient_confirmation_reminder_24h';
  const now = Date.now();

  // Fetch pre_confirmation patients with confirm_sent_at older than threshold
  const { data, error } = await supabaseServer
    .from('people')
    .select('id,email,status,metadata')
    .eq('type', 'patient')
    .eq('status', 'pre_confirmation')
    .limit(limit);

  if (error) {
    await logError('admin.api.leads.confirmation_reminders', error, { stage: 'fetch' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Failed to fetch' }, { status: 500 });
  }

  const rows = (data as Array<{ id: string; email?: string | null; status?: string | null; metadata?: Record<string, unknown> | null }> | null) || [];

  let processed = 0;
  let sent = 0;
  let skippedTooRecent = 0;
  let skippedNoEmail = 0;
  let skippedAlready = 0;

  for (const row of rows) {
    if (processed >= limit) break;
    processed++;
    const email = (row.email || '').toLowerCase();
    if (!email) {
      skippedNoEmail++;
      continue;
    }
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const sentAtIso = typeof meta['confirm_sent_at'] === 'string' ? (meta['confirm_sent_at'] as string) : undefined;
    if (!sentAtIso) {
      skippedTooRecent++;
      continue;
    }
    const sentAt = Date.parse(sentAtIso);
    if (Number.isNaN(sentAt) || now - sentAt < thresholdMs) {
      skippedTooRecent++;
      continue;
    }

    // Check whether this specific stage was already sent
    const wasSent = await alreadyReminded(row.id, stage);
    if (wasSent) {
      skippedAlready++;
      continue;
    }

    // Issue new token and update metadata.confirm_sent_at (so TTL matches link)
    const newToken = randomUUID();
    const newMeta = { ...meta, confirm_token: newToken, confirm_sent_at: new Date().toISOString() };
    const { error: upErr } = await supabaseServer.from('people').update({ metadata: newMeta }).eq('id', row.id);
    if (upErr) {
      await logError('admin.api.leads.confirmation_reminders', upErr, { stage: 'update_metadata', lead_id: row.id }, ip, ua);
      continue;
    }

    // Send email
    try {
      const fs = typeof (meta as Record<string, unknown>)['form_session_id'] === 'string' ? String((meta as Record<string, unknown>)['form_session_id']) : '';
      const base = `${BASE_URL}/api/public/leads/confirm?token=${encodeURIComponent(newToken)}&id=${encodeURIComponent(row.id)}`;
      const confirmUrl = fs ? `${base}&fs=${encodeURIComponent(fs)}` : base;
      const content = renderEmailConfirmation({ confirmUrl, isReminder: true });
      void track({ type: 'email_attempted', level: 'info', source: 'admin.api.leads.confirmation_reminders', ip, ua, props: { stage, lead_id: row.id, subject: content.subject } });
      const emailSent = await sendEmail({
        to: email,
        subject: content.subject,
        html: content.html,
        context: {
          stage,
          lead_id: row.id,
          template: 'email_confirmation',
          email_token: newToken,
        },
      });
      if (emailSent) {
        sent++;
      } else {
        await logError('admin.api.leads.confirmation_reminders', new Error('Email send returned false'), { stage: 'send_email_failed', lead_id: row.id, email }, ip, ua);
      }
    } catch (e) {
      await logError('admin.api.leads.confirmation_reminders', e, { stage: 'send_email', lead_id: row.id }, ip, ua);
    }
  }

  void track({
    type: 'cron_completed',
    level: 'info',
    source: 'admin.api.leads.confirmation_reminders',
    ip,
    ua,
    props: { threshold: thresholdKey, processed, sent, skipped_too_recent: skippedTooRecent, skipped_no_email: skippedNoEmail, skipped_already: skippedAlready },
  });

  return NextResponse.json({ data: { threshold: thresholdKey, processed, sent, skipped_too_recent: skippedTooRecent, skipped_no_email: skippedNoEmail, skipped_already: skippedAlready }, error: null });
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
    const threshold = parseThreshold(url.searchParams.get('threshold'));
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 100), 1000));

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.leads.confirmation_reminders', ip, ua, props: { method: 'GET', threshold, limit } });

    return await processBatch(threshold, limit, req);
  } catch (e) {
    await logError('admin.api.leads.confirmation_reminders', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.leads.confirmation_reminders', ip, ua, props: { method: 'GET' } });
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
    const threshold = parseThreshold(typeof body.threshold === 'string' ? body.threshold : undefined);
    const limit = Math.max(1, Math.min(Number(body.limit || 100), 1000));

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.leads.confirmation_reminders', ip, ua, props: { method: 'POST', threshold, limit } });

    return await processBatch(threshold, limit, req);
  } catch (e) {
    await logError('admin.api.leads.confirmation_reminders', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.leads.confirmation_reminders', ip, ua, props: { method: 'POST' } });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
