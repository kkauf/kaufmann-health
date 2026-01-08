import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistReminder } from '@/lib/email/templates/therapistReminder';
import { BASE_URL } from '@/lib/constants';
import { createTherapistOptOutToken } from '@/lib/signed-links';
import { isCronAuthorized as isCronAuthorizedShared, sameOrigin as sameOriginShared } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TherapistRowLite = {
  id: string;
  status?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  metadata?: unknown;
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

function sameOrigin(req: Request): boolean {
  return sameOriginShared(req);
}

// --- Helpers for cooldown/cap ---

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_REMINDERS = 3; // after this, stop

function deriveStageLabel(priorSends: number): string | undefined {
  // 0 -> first reminder, 1 -> second, 2 -> final
  const stages = ['Erinnerung', 'Zweite Erinnerung', 'Abschließende Erinnerung'] as const;
  return stages[Math.min(priorSends, stages.length - 1)];
}

type EmailEventRow = { id: string; created_at?: string | null; properties?: Record<string, unknown> | null; props?: Record<string, unknown> | null };

async function getReminderHistory(therapistId: string): Promise<{ count: number; lastSentAt: Date | null }> {
  try {
    const sinceIso = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, created_at, properties')
      .eq('type', 'email_sent')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) return { count: 0, lastSentAt: null };
    const arr = (data as EmailEventRow[] | null) || [];
    const filtered = arr.filter((e) => {
      const p = (e.properties && typeof e.properties === 'object'
        ? e.properties
        : e.props && typeof e.props === 'object'
        ? e.props
        : null) as Record<string, unknown> | null;
      if (!p) return false;
      const stage = typeof p['stage'] === 'string' ? (p['stage'] as string) : '';
      const tid = typeof p['therapist_id'] === 'string' ? (p['therapist_id'] as string) : '';
      return stage === 'therapist_profile_reminder' && tid === therapistId;
    });
    const count = filtered.length;
    const last = filtered[0]?.created_at ? new Date(filtered[0].created_at as string) : null;
    return { count, lastSentAt: last };
  } catch {
    return { count: 0, lastSentAt: null };
  }
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  const startedAt = Date.now();

  try {
    // Auth: allow either admin cookie OR Cron secret (headers; query token only in non-prod)
    const isCron = isCronAuthorizedShared(req);

    const isAdmin = await assertAdmin(req);
    if (!isAdmin && !isCron) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }
    if (isAdmin && !isCron && !sameOrigin(req)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    // Read params from query string
    const url = new URL(req.url);
    const limitQS = url.searchParams.get('limit');
    const stageLabel = url.searchParams.get('stage') || undefined;
    const limit = Math.max(1, Math.min(Number(limitQS || 100), 1000));

    // Monitoring: log cron start
    const isVercelCron = Boolean(req.headers.get('x-vercel-cron'));
    void track({
      type: 'cron_executed',
      level: 'info',
      source: 'admin.api.therapists.reminders.batch',
      props: {
        stage: stageLabel,
        limit,
        triggered_by: isCron ? (isVercelCron ? 'vercel_cron' : 'secret') : 'manual',
        method: 'GET',
      },
      ip,
      ua,
    });

    // Fetch therapists pending verification (reuse logic from POST)
    const initial = await supabaseServer
      .from('therapists')
      .select('id, status, first_name, last_name, email, gender, city, accepting_new, photo_url, metadata')
      .eq('status', 'pending_verification')
      .limit(limit);

    if (initial.error) {
      const msg = (initial.error as { message?: string } | null)?.message || '';
      if (msg.includes('does not exist') && msg.includes('metadata')) {
        const retry = await supabaseServer
          .from('therapists')
          .select('id, status, first_name, last_name, email')
          .eq('status', 'pending_verification')
          .limit(limit);
        if (retry.error) {
          await logError('admin.api.therapists.reminders.batch', retry.error, { stage: 'fetch' }, ip, ua);
          return NextResponse.json({ data: null, error: 'Failed to fetch' }, { status: 500 });
        }
        const processed = ((retry.data as unknown[]) || []).length;
        void track({
          type: 'therapist_reminder_skipped_metadata_missing',
          level: 'warn',
          source: 'admin.api.therapists.reminders.batch',
          props: { count: processed, stage: 'fetch' },
          ip,
          ua,
        });
        return NextResponse.json({ data: { processed, sent: 0, skipped_no_missing: processed, examples: [] }, error: null }, { status: 200 });
      } else {
        await logError('admin.api.therapists.reminders.batch', initial.error, { stage: 'fetch' }, ip, ua);
        return NextResponse.json({ data: null, error: 'Failed to fetch' }, { status: 500 });
      }
    }

    const rows = (initial.data as TherapistRowLite[] | null) || [];

    let processed = 0;
    let sent = 0;
    let skippedNoMissing = 0;
    let skippedCooldown = 0;
    let skippedCapped = 0;
    let skippedOptOut = 0;
    const examples: Array<{ id: string; missing: string[] }> = [];

    const rowsTyped: TherapistRowLite[] = (rows as TherapistRowLite[] | null) || [];
    for (const t of rowsTyped) {
      processed++;
      const metadata = isObject(t.metadata) ? (t.metadata as Record<string, unknown>) : {};

      const docsUnknown = (metadata as { documents?: unknown }).documents;
      const docs = isObject(docsUnknown) ? (docsUnknown as Record<string, unknown>) : {};
      const hasLicense = typeof docs.license === 'string' && (docs.license as string).length > 0;

      const profileUnknown = (metadata as { profile?: unknown }).profile;
      const profile = isObject(profileUnknown) ? (profileUnknown as Record<string, unknown>) : {};
      const hasPhotoPending = typeof profile.photo_pending_path === 'string' && (profile.photo_pending_path as string).length > 0;
      const hasApproach = typeof profile.approach_text === 'string' && (profile.approach_text as string).trim().length > 0;
      const approvedPhoto = (t as { photo_url?: string | null }).photo_url || null;
      const hasPhotoApproved = typeof approvedPhoto === 'string' && approvedPhoto.length > 0;

      const missingDocuments = !hasLicense;
      const missingPhoto = !(hasPhotoApproved || hasPhotoPending);
      const missingApproach = !hasApproach;

      if (!missingDocuments && !missingPhoto && !missingApproach) {
        skippedNoMissing++;
        continue;
      }

      const to = t.email || undefined;
      if (!to) continue;

      const name = [(t.first_name || ''), (t.last_name || '')].join(' ').trim();
      const uploadUrl = `${BASE_URL}/therapists/upload-documents/${t.id}`;
      const profileUrl = `${BASE_URL}/therapists/complete-profile/${t.id}`;

      const genderVal = (t as { gender?: string | null }).gender || null;
      const cityVal = (t as { city?: string | null }).city || null;
      const acceptingVal = (t as { accepting_new?: boolean | null }).accepting_new;
      const genderOk = genderVal === 'male' || genderVal === 'female' || genderVal === 'diverse';
      const cityOk = typeof cityVal === 'string' && cityVal.trim().length > 0;
      const acceptingOk = typeof acceptingVal === 'boolean';
      const missingBasic = !(genderOk && cityOk && acceptingOk);

      // Opt-out check
      const notificationsUnknown = (metadata as { notifications?: unknown }).notifications;
      const notifications = isObject(notificationsUnknown) ? (notificationsUnknown as Record<string, unknown>) : {};
      const optedOut = Boolean((notifications as { reminders_opt_out?: unknown }).reminders_opt_out === true);
      if (optedOut) {
        skippedOptOut++;
        continue;
      }

      // Cooldown + cap based on email_sent events with context { stage: 'therapist_profile_reminder', therapist_id }
      const history = await getReminderHistory(String(t.id));
      if (history.count >= MAX_REMINDERS) {
        skippedCapped++;
        continue;
      }
      if (history.lastSentAt && Date.now() - history.lastSentAt.getTime() < COOLDOWN_MS) {
        skippedCooldown++;
        continue;
      }

      const token = await createTherapistOptOutToken(String(t.id));
      const optOutUrl = `${BASE_URL}/api/therapists/opt-out?token=${encodeURIComponent(token)}`;
      const reminder = renderTherapistReminder({
        name,
        profileUrl,
        uploadUrl,
        missingDocuments,
        missingPhoto,
        missingApproach,
        missingBasic,
        stageLabel: deriveStageLabel(history.count),
        optOutUrl,
      });

      try {
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.therapists.reminders.batch', props: { stage: 'therapist_profile_reminder', therapist_id: t.id, subject: reminder.subject } });
        const emailResult = await sendEmail({
          to,
          subject: reminder.subject,
          html: reminder.html,
          headers: {
            'List-Unsubscribe': `<${optOutUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          replyTo: 'kontakt@kaufmann-health.de',
          context: { stage: 'therapist_profile_reminder', therapist_id: t.id },
        });
        if (emailResult.sent) {
          sent++;
          if (examples.length < 3) {
            const miss: string[] = [];
            if (missingDocuments) miss.push('documents');
            if (missingPhoto) miss.push('photo');
            if (missingApproach) miss.push('approach');
            examples.push({ id: t.id as string, missing: miss });
          }
        } else if (emailResult.reason === 'failed') {
          // Only log as error for actual failures, not suppression or missing config
          await logError('admin.api.therapists.reminders.batch', new Error('Email send returned false'), { stage: 'send_email_failed', therapist_id: t.id, email: to }, ip, ua);
        }
      } catch (e) {
        await logError('admin.api.therapists.reminders.batch', e, { stage: 'send_email', therapist_id: t.id }, ip, ua);
      }
    }

    // Monitoring: success completion
    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'admin.api.therapists.reminders.batch',
      props: {
        processed,
        sent,
        skipped_no_missing: skippedNoMissing,
        skipped_cooldown: skippedCooldown,
        skipped_capped: skippedCapped,
        skipped_opt_out: skippedOptOut,
        duration_ms: Date.now() - startedAt,
        stage: stageLabel,
        method: 'GET',
      },
      ip,
      ua,
    });

    return NextResponse.json({ data: { processed, sent, skipped_no_missing: skippedNoMissing, skipped_cooldown: skippedCooldown, skipped_capped: skippedCapped, skipped_opt_out: skippedOptOut, examples }, error: null });
  } catch (e) {
    await logError('admin.api.therapists.reminders.batch', e, { stage: 'exception' }, ip, ua);
    // Monitoring: failure
    void track({
      type: 'cron_failed',
      level: 'error',
      source: 'admin.api.therapists.reminders.batch',
      props: { duration_ms: Date.now() - startedAt, method: 'GET' },
      ip,
      ua,
    });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  const startedAt = Date.now();

  try {
    // Auth: allow either admin cookie OR Cron secret (headers; query token only in non-prod)
    const isCron = isCronAuthorizedShared(req);
    const isAdmin = await assertAdmin(req);
    if (!isAdmin && !isCron) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }
    if (isAdmin && !isCron && !sameOrigin(req)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body.limit || 100), 1000));
    const stageLabel = typeof body.stage === 'string' ? body.stage : undefined;

    // Monitoring: log cron start
    const isVercelCron = Boolean(req.headers.get('x-vercel-cron'));
    void track({
      type: 'cron_executed',
      level: 'info',
      source: 'admin.api.therapists.reminders.batch',
      props: {
        stage: stageLabel,
        limit,
        triggered_by: isCron ? (isVercelCron ? 'vercel_cron' : 'secret') : 'manual',
        method: 'POST',
      },
      ip,
      ua,
    });

    // Fetch therapists pending verification
    const initial = await supabaseServer
      .from('therapists')
      .select('id, status, first_name, last_name, email, gender, city, accepting_new, photo_url, metadata')
      .eq('status', 'pending_verification')
      .limit(limit);

    // Fallback if metadata column is missing in production
    const msg = (initial.error as { message?: string } | null)?.message || '';
    if (initial.error && msg.includes('does not exist') && msg.includes('metadata')) {
      const retry = await supabaseServer
        .from('therapists')
        .select('id, status, first_name, last_name, email')
        .eq('status', 'pending_verification')
        .limit(limit);
      if (retry.error) {
        await logError('admin.api.therapists.reminders.batch', retry.error, { stage: 'fetch' }, ip, ua);
        return NextResponse.json({ data: null, error: 'Failed to fetch' }, { status: 500 });
      }
      const processed = ((retry.data as unknown[]) || []).length;
      void track({
        type: 'therapist_reminder_skipped_metadata_missing',
        level: 'warn',
        source: 'admin.api.therapists.reminders.batch',
        props: { count: processed, stage: 'fetch' },
        ip,
        ua,
      });
      return NextResponse.json({ data: { processed, sent: 0, skipped_no_missing: processed, examples: [] }, error: null }, { status: 200 });
    }

    if (initial.error) {
      await logError('admin.api.therapists.reminders.batch', initial.error, { stage: 'fetch' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch' }, { status: 500 });
    }

    const rows = (initial.data as TherapistRowLite[] | null) || [];

    let processed = 0;
    let sent = 0;
    let skippedNoMissing = 0;
    let skippedCooldown = 0;
    let skippedCapped = 0;
    let skippedOptOut = 0;
    const examples: Array<{ id: string; missing: string[] }> = [];

    const rowsTyped: TherapistRowLite[] = (rows as TherapistRowLite[] | null) || [];
    for (const t of rowsTyped) {
      processed++;
      const metadata = isObject(t.metadata) ? (t.metadata as Record<string, unknown>) : {};

      const docsUnknown = (metadata as { documents?: unknown }).documents;
      const docs = isObject(docsUnknown) ? (docsUnknown as Record<string, unknown>) : {};
      const hasLicense = typeof docs.license === 'string' && (docs.license as string).length > 0;

      const profileUnknown = (metadata as { profile?: unknown }).profile;
      const profile = isObject(profileUnknown) ? (profileUnknown as Record<string, unknown>) : {};
      const hasPhotoPending = typeof profile.photo_pending_path === 'string' && (profile.photo_pending_path as string).length > 0;
      const hasApproach = typeof profile.approach_text === 'string' && (profile.approach_text as string).trim().length > 0;
      const approvedPhoto = (t as { photo_url?: string | null }).photo_url || null;
      const hasPhotoApproved = typeof approvedPhoto === 'string' && approvedPhoto.length > 0;
      const missingDocuments = !hasLicense;
      const missingPhoto = !(hasPhotoApproved || hasPhotoPending);
      const missingApproach = !hasApproach;

      if (!missingDocuments && !missingPhoto && !missingApproach) {
        skippedNoMissing++;
        continue;
      }

      const to = t.email || undefined;
      if (!to) continue;

      const name = [(t.first_name || ''), (t.last_name || '')].join(' ').trim();
      const uploadUrl = `${BASE_URL}/therapists/upload-documents/${t.id}`;
      const profileUrl = `${BASE_URL}/therapists/complete-profile/${t.id}`;

      const genderVal = (t as { gender?: string | null }).gender || null;
      const cityVal = (t as { city?: string | null }).city || null;
      const acceptingVal = (t as { accepting_new?: boolean | null }).accepting_new;
      const genderOk = genderVal === 'male' || genderVal === 'female' || genderVal === 'diverse';
      const cityOk = typeof cityVal === 'string' && cityVal.trim().length > 0;
      const acceptingOk = typeof acceptingVal === 'boolean';
      const missingBasic = !(genderOk && cityOk && acceptingOk);

      // Opt-out check
      const notificationsUnknown = (metadata as { notifications?: unknown }).notifications;
      const notifications = isObject(notificationsUnknown) ? (notificationsUnknown as Record<string, unknown>) : {};
      const optedOut = Boolean((notifications as { reminders_opt_out?: unknown }).reminders_opt_out === true);
      if (optedOut) {
        skippedOptOut++;
        continue;
      }

      // Cooldown + cap based on email_sent events with context { stage: 'therapist_profile_reminder', therapist_id }
      const history = await getReminderHistory(String(t.id));
      if (history.count >= MAX_REMINDERS) {
        skippedCapped++;
        continue;
      }
      if (history.lastSentAt && Date.now() - history.lastSentAt.getTime() < COOLDOWN_MS) {
        skippedCooldown++;
        continue;
      }

      const token = await createTherapistOptOutToken(String(t.id));
      const optOutUrl = `${BASE_URL}/api/therapists/opt-out?token=${encodeURIComponent(token)}`;
      const reminder = renderTherapistReminder({
        name,
        profileUrl,
        uploadUrl,
        missingDocuments,
        missingPhoto,
        missingApproach,
        missingBasic,
        stageLabel: deriveStageLabel(history.count),
        optOutUrl,
      });

      try {
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.therapists.reminders.batch', props: { stage: 'therapist_profile_reminder', therapist_id: t.id, subject: reminder.subject } });
        const emailResult = await sendEmail({
          to,
          subject: reminder.subject,
          html: reminder.html,
          headers: {
            'List-Unsubscribe': `<${optOutUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          replyTo: 'kontakt@kaufmann-health.de',
          context: { stage: 'therapist_profile_reminder', therapist_id: t.id },
        });
        if (emailResult.sent) {
          sent++;
          if (examples.length < 3) {
            const miss: string[] = [];
            if (missingDocuments) miss.push('documents');
            if (missingPhoto) miss.push('photo');
            if (missingApproach) miss.push('approach');
            examples.push({ id: t.id as string, missing: miss });
          }
        } else if (emailResult.reason === 'failed') {
          // Only log as error for actual failures, not suppression or missing config
          await logError('admin.api.therapists.reminders.batch', new Error('Email send returned false'), { stage: 'send_email_failed', therapist_id: t.id, email: to }, ip, ua);
        }
      } catch (e) {
        await logError('admin.api.therapists.reminders.batch', e, { stage: 'send_email', therapist_id: t.id }, ip, ua);
      }
    }

    // Monitoring: success completion (POST)
    void track({
      type: 'cron_completed',
      level: 'info',
      source: 'admin.api.therapists.reminders.batch',
      props: {
        processed,
        sent,
        skipped_no_missing: skippedNoMissing,
        skipped_cooldown: skippedCooldown,
        skipped_capped: skippedCapped,
        skipped_opt_out: skippedOptOut,
        duration_ms: Date.now() - startedAt,
        stage: stageLabel,
        method: 'POST',
      },
      ip,
      ua,
    });

    return NextResponse.json({ data: { processed, sent, skipped_no_missing: skippedNoMissing, skipped_cooldown: skippedCooldown, skipped_capped: skippedCapped, skipped_opt_out: skippedOptOut, examples }, error: null });
  } catch (e) {
    await logError('admin.api.therapists.reminders.batch', e, { stage: 'exception' }, ip, ua);
    // Monitoring: failure (POST)
    void track({
      type: 'cron_failed',
      level: 'error',
      source: 'admin.api.therapists.reminders.batch',
      props: { duration_ms: Date.now() - startedAt, method: 'POST' },
      ip,
      ua,
    });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
