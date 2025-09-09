import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistReminder } from '@/lib/email/templates/therapistReminder';
import { BASE_URL } from '@/lib/constants';

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

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    // Auth: allow either admin cookie OR Cron secret (header or query param)
    const cronSecretHeader = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization') || '';
    const isAuthBearer = Boolean(cronSecret && authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret);
    let isCron = Boolean(cronSecret && cronSecretHeader && cronSecretHeader === cronSecret) || isAuthBearer;
    if (!isCron && cronSecret) {
      try {
        const url = new URL(req.url);
        const token = url.searchParams.get('token');
        if (token && token === cronSecret) {
          isCron = true;
        }
      } catch {}
    }

    const isAdmin = await assertAdmin(req);
    if (!isAdmin && !isCron) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    // Read params from query string
    const url = new URL(req.url);
    const limitQS = url.searchParams.get('limit');
    const stageLabel = url.searchParams.get('stage') || undefined;
    const limit = Math.max(1, Math.min(Number(limitQS || 100), 1000));

    // Fetch therapists pending verification (reuse logic from POST)
    const { data: rows, error } = await supabaseServer
      .from('therapists')
      .select('id, status, first_name, last_name, email, metadata')
      .eq('status', 'pending_verification')
      .limit(limit);

    if (error) {
      await logError('admin.api.therapists.reminders.batch', error, { stage: 'fetch' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch' }, { status: 500 });
    }

    let processed = 0;
    let sent = 0;
    let skippedNoMissing = 0;
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

      const missingDocuments = !hasLicense;
      const missingPhoto = !hasPhotoPending;
      const missingApproach = !hasApproach;

      if (!missingDocuments && !missingPhoto && !missingApproach) {
        skippedNoMissing++;
        continue;
      }

      const to = t.email || undefined;
      if (!to) continue;

      const name = [(t.first_name || ''), (t.last_name || '')].join(' ').trim();
      const uploadUrl = `${BASE_URL}/therapists/upload-documents/${t.id}`;

      const reminder = renderTherapistReminder({
        name,
        uploadUrl,
        missingDocuments,
        missingPhoto,
        missingApproach,
        stageLabel,
      });

      try {
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.therapists.reminders.batch', props: { stage: 'therapist_profile_reminder', therapist_id: t.id, subject: reminder.subject } });
        await sendEmail({ to, subject: reminder.subject, html: reminder.html, context: { stage: 'therapist_profile_reminder', therapist_id: t.id } });
        sent++;
        if (examples.length < 3) {
          const miss: string[] = [];
          if (missingDocuments) miss.push('documents');
          if (missingPhoto) miss.push('photo');
          if (missingApproach) miss.push('approach');
          examples.push({ id: t.id as string, missing: miss });
        }
      } catch (e) {
        await logError('admin.api.therapists.reminders.batch', e, { stage: 'send_email', therapist_id: t.id }, ip, ua);
      }
    }

    return NextResponse.json({ data: { processed, sent, skipped_no_missing: skippedNoMissing, examples }, error: null });
  } catch (e) {
    await logError('admin.api.therapists.reminders.batch', e, { stage: 'exception' }, ip, ua);
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

  try {
    // Auth: allow either admin cookie OR Cron secret (Authorization header, custom header, or query param)
    const cronSecretHeader = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization') || '';
    const isAuthBearer = Boolean(cronSecret && authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret);
    let isCron = (Boolean(cronSecret && cronSecretHeader && cronSecretHeader === cronSecret) || isAuthBearer);
    if (!isCron && cronSecret) {
      try {
        const url = new URL(req.url);
        const token = url.searchParams.get('token');
        if (token && token === cronSecret) {
          isCron = true;
        }
      } catch {}
    }

    const isAdmin = await assertAdmin(req);
    if (!isAdmin && !isCron) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(body.limit || 100), 1000));
    const stageLabel = typeof body.stage === 'string' ? body.stage : undefined;

    // Fetch therapists pending verification
    const { data: rows, error } = await supabaseServer
      .from('therapists')
      .select('id, status, first_name, last_name, email, metadata')
      .eq('status', 'pending_verification')
      .limit(limit);

    if (error) {
      await logError('admin.api.therapists.reminders.batch', error, { stage: 'fetch' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch' }, { status: 500 });
    }

    let processed = 0;
    let sent = 0;
    let skippedNoMissing = 0;
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

      const missingDocuments = !hasLicense;
      const missingPhoto = !hasPhotoPending;
      const missingApproach = !hasApproach;

      if (!missingDocuments && !missingPhoto && !missingApproach) {
        skippedNoMissing++;
        continue;
      }

      const to = t.email || undefined;
      if (!to) continue;

      const name = [(t.first_name || ''), (t.last_name || '')].join(' ').trim();
      const uploadUrl = `${BASE_URL}/therapists/upload-documents/${t.id}`;

      const reminder = renderTherapistReminder({
        name,
        uploadUrl,
        missingDocuments,
        missingPhoto,
        missingApproach,
        stageLabel,
      });

      try {
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.therapists.reminders.batch', props: { stage: 'therapist_profile_reminder', therapist_id: t.id, subject: reminder.subject } });
        await sendEmail({ to, subject: reminder.subject, html: reminder.html, context: { stage: 'therapist_profile_reminder', therapist_id: t.id } });
        sent++;
        if (examples.length < 3) {
          const miss: string[] = [];
          if (missingDocuments) miss.push('documents');
          if (missingPhoto) miss.push('photo');
          if (missingApproach) miss.push('approach');
          examples.push({ id: t.id as string, missing: miss });
        }
      } catch (e) {
        await logError('admin.api.therapists.reminders.batch', e, { stage: 'send_email', therapist_id: t.id }, ip, ua);
      }
    }

    return NextResponse.json({ data: { processed, sent, skipped_no_missing: skippedNoMissing, examples }, error: null });
  } catch (e) {
    await logError('admin.api.therapists.reminders.batch', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
