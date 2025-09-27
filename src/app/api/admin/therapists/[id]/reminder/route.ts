import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistReminder } from '@/lib/email/templates/therapistReminder';
import { BASE_URL } from '@/lib/constants';
import { createTherapistOptOutToken } from '@/lib/signed-links';

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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// --- Cooldown & cap helpers ---
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_REMINDERS = 3; // after this, stop

function deriveStageLabel(priorSends: number): string | undefined {
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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    const { data: t, error } = await supabaseServer
      .from('therapists')
      .select('id, status, first_name, last_name, email, gender, city, accepting_new, photo_url, metadata')
      .eq('id', id)
      .single();

    if (error || !t) {
      await logError('admin.api.therapists.reminder', error, { stage: 'fetch', therapist_id: id });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    const status = (t as { status?: string }).status || 'pending_verification';
    if (status !== 'pending_verification') {
      return NextResponse.json({ data: null, error: 'Not applicable' }, { status: 400 });
    }

    const metaUnknown = (t as { metadata?: unknown }).metadata;
    const metadata = isObject(metaUnknown) ? (metaUnknown as Record<string, unknown>) : {};

    const docsUnknown = (metadata as { documents?: unknown }).documents;
    const docs = isObject(docsUnknown) ? (docsUnknown as Record<string, unknown>) : {};
    const hasLicense = typeof docs.license === 'string' && (docs.license as string).length > 0;

    const profileUnknown = (metadata as { profile?: unknown }).profile;
    const profile = isObject(profileUnknown) ? (profileUnknown as Record<string, unknown>) : {};
    const hasPhotoPending = typeof profile.photo_pending_path === 'string' && (profile.photo_pending_path as string).length > 0;
    const hasApproach = typeof profile.approach_text === 'string' && (profile.approach_text as string).trim().length > 0;
    const approvedPhoto = (t as { photo_url?: string | null }).photo_url || null;
    const hasPhotoApproved = typeof approvedPhoto === 'string' && approvedPhoto.length > 0;

    const missingDocuments = !hasLicense; // specialization optional by business rule
    const missingPhoto = !(hasPhotoApproved || hasPhotoPending); // either approved or pending satisfies
    const missingApproach = !hasApproach;

    // If nothing missing, skip
    if (!missingDocuments && !missingPhoto && !missingApproach) {
      return NextResponse.json({ data: { skipped: true, reason: 'no_missing' }, error: null });
    }

    // Respect opt-out flag
    const notificationsUnknown = (metadata as { notifications?: unknown }).notifications;
    const notifications = isObject(notificationsUnknown) ? (notificationsUnknown as Record<string, unknown>) : {};
    const optedOut = Boolean((notifications as { reminders_opt_out?: unknown }).reminders_opt_out === true);
    if (optedOut) {
      return NextResponse.json({ data: { skipped: true, reason: 'opt_out' }, error: null });
    }

    // Cooldown + cap
    const history = await getReminderHistory(id);
    if (history.count >= MAX_REMINDERS) {
      return NextResponse.json({ data: { skipped: true, reason: 'capped' }, error: null });
    }
    if (history.lastSentAt && Date.now() - history.lastSentAt.getTime() < COOLDOWN_MS) {
      return NextResponse.json({ data: { skipped: true, reason: 'cooldown' }, error: null });
    }

    const to = (t as { email?: string | null }).email || undefined;
    const name = [
      (t as { first_name?: string | null }).first_name || '',
      (t as { last_name?: string | null }).last_name || '',
    ].join(' ').trim();

    if (!to) return NextResponse.json({ data: null, error: 'Missing email' }, { status: 400 });

    const uploadUrl = `${BASE_URL}/therapists/upload-documents/${id}`;
    const profileUrl = `${BASE_URL}/therapists/complete-profile/${id}`;

    const genderVal = (t as { gender?: string | null }).gender || null;
    const cityVal = (t as { city?: string | null }).city || null;
    const acceptingVal = (t as { accepting_new?: boolean | null }).accepting_new;
    const genderOk = genderVal === 'male' || genderVal === 'female' || genderVal === 'diverse';
    const cityOk = typeof cityVal === 'string' && cityVal.trim().length > 0;
    const acceptingOk = typeof acceptingVal === 'boolean';
    const missingBasic = !(genderOk && cityOk && acceptingOk);

    const token = await createTherapistOptOutToken(id);
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

    void track({ type: 'email_attempted', level: 'info', source: 'admin.api.therapists.reminder', props: { stage: 'therapist_profile_reminder', therapist_id: id, subject: reminder.subject } });
    await sendEmail({
      to,
      subject: reminder.subject,
      html: reminder.html,
      headers: {
        'List-Unsubscribe': `<${optOutUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      context: { stage: 'therapist_profile_reminder', therapist_id: id },
    });

    return NextResponse.json({ data: { ok: true }, error: null });
  } catch (e) {
    await logError('admin.api.therapists.reminder', e, { stage: 'exception', therapist_id: id }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
