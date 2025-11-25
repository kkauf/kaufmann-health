import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistNotification } from '@/lib/email/templates/therapistNotification';
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

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function isCronAuthorized(req: Request): boolean {
  const vercelCron = req.headers.get('x-vercel-cron');
  if (vercelCron && process.env.NODE_ENV !== 'production') return true;
  const cronSecretHeader = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const isAuthBearer = Boolean(cronSecret && authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret);
  let isCron = Boolean(cronSecret && cronSecretHeader && cronSecretHeader === cronSecret) || isAuthBearer;
  if (!isCron && cronSecret) {
    try {
      const u = new URL(req.url);
      const token = u.searchParams.get('token');
      if (token && token === cronSecret) isCron = true;
    } catch {}
  }
  return Boolean(isCron);
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get('host') || '';
  if (!host) return false;
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  if (!origin && !referer) return true; // allow server-to-server/test requests
  const http = `http://${host}`;
  const https = `https://${host}`;
  if (origin === http || origin === https) return true;
  if (referer.startsWith(http + '/')) return true;
  if (referer.startsWith(https + '/')) return true;
  return false;
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  const startedAt = Date.now();

  try {
    // Auth: allow either admin cookie OR Cron secret (headers or token param)
    const isCron = isCronAuthorized(req);
    const isAdmin = await assertAdmin(req);
    if (!isAdmin && !isCron) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (isAdmin && !isCron && !sameOrigin(req)) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const stage = (url.searchParams.get('stage') || '').toLowerCase(); // '20h'

    // 20h window (between 20 and 21 hours ago)
    const fromIso = hoursAgo(21);
    const toIso = hoursAgo(20);

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.matches.therapist_action_reminders', props: { stage }, ip, ua });

    // Find patient selections in the 20h window
    const { data: events, error: evErr } = await supabaseServer
      .from('events')
      .select('id, created_at, properties')
      .eq('type', 'patient_selected')
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .limit(1000);

    if (evErr) {
      await logError('admin.api.matches.therapist_action_reminders', evErr, { stage: 'fetch_events' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch events' }, { status: 500 });
    }

    // Note: Column name is 'properties' in DB. Keep 'props' optional for compatibility with test mocks.
    type EventRow = { id: string; created_at?: string | null; properties?: Record<string, unknown> | null; props?: Record<string, unknown> | null };
    const items = (events as EventRow[] | null) || [];

    // Collect match_ids
    const matchIds = new Set<string>();
    function getStringProp(obj: Record<string, unknown>, key: string): string | null {
      const v = obj[key];
      return typeof v === 'string' ? v : null;
    }
    for (const e of items) {
      const p = (e.properties && typeof e.properties === 'object'
        ? e.properties
        : e.props && typeof e.props === 'object'
        ? e.props
        : null);
      if (!p) continue;
      const mid = getStringProp(p, 'match_id');
      const m = (mid || '').trim();
      if (m) matchIds.add(m);
    }

    let processed = 0;
    let sent = 0;

    for (const match_id of matchIds) {
      processed++;
      // Load match to see if therapist already clicked
      const { data: match } = await supabaseServer
        .from('matches')
        .select('id, patient_id, therapist_id, status, therapist_contacted_at')
        .eq('id', match_id)
        .maybeSingle();
      const m = (match as { id: string; patient_id: string; therapist_id: string; status?: string | null; therapist_contacted_at?: string | null } | null);
      if (!m) continue;
      if ((m.status || '').toLowerCase() !== 'patient_selected') continue;
      if (m.therapist_contacted_at) continue; // already acted

      // Load entities
      const [{ data: patientRow }, { data: therapistRow }] = await Promise.all([
        supabaseServer.from('people').select('id, name, email, phone_number, metadata').eq('id', m.patient_id).single(),
        supabaseServer.from('therapists').select('id, first_name, last_name, email, city').eq('id', m.therapist_id).single(),
      ]);

      type PatientMeta = { city?: string; issue?: string; session_preference?: 'online' | 'in_person' };
      type PatientRow = { id: string; name?: string | null; email?: string | null; phone_number?: string | null; metadata?: PatientMeta | null };
      type TherapistRow = { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; city?: string | null };

      const pRow = (patientRow || null) as PatientRow | null;
      const tRow = (therapistRow || null) as TherapistRow | null;

      const patientMeta: PatientMeta = (pRow?.metadata || {}) as PatientMeta;
      const _patientEmail = (pRow?.email || '').trim();
      const _patientPhoneNumber = (pRow?.phone_number || '').trim();
      const therapistEmail = (tRow?.email || '').trim();
      const therapistFirst = (tRow?.first_name || '').trim();
      const therapistLast = (tRow?.last_name || '').trim();
      const therapistName = [therapistFirst, therapistLast].join(' ').trim() || null;

      if (!therapistEmail) continue;

      // Build magic link to acceptance page using secure_uuid
      let magicUrl: string | null = null;
      try {
        const { data: matchRow } = await supabaseServer
          .from('matches')
          .select('secure_uuid')
          .eq('id', match_id)
          .maybeSingle();
        const su = (matchRow as { secure_uuid?: string | null } | null)?.secure_uuid || null;
        if (su) magicUrl = `${BASE_URL}/match/${su}`;
      } catch {}

      if (!magicUrl) continue;

      const notif = renderTherapistNotification({
        type: 'reminder',
        therapistName,
        patientCity: patientMeta.city || null,
        patientIssue: patientMeta.issue || null,
        patientSessionPreference: patientMeta.session_preference ?? null,
        magicUrl,
        subjectOverride: 'Erinnerung: Klient wartet auf Ihre Antwort',
      });

      try {
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.matches.therapist_action_reminders', props: { match_id } });
        // Build List-Unsubscribe header using therapist opt-out token
        let headers: Record<string, string> | undefined;
        try {
          const token = await createTherapistOptOutToken(String(tRow?.id || ''));
          if (token) {
            const optOutUrl = `${BASE_URL}/api/therapists/opt-out?token=${encodeURIComponent(token)}`;
            headers = {
              'List-Unsubscribe': `<${optOutUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            };
          }
        } catch {}
        const emailSent = await sendEmail({
          to: therapistEmail,
          subject: notif.subject,
          html: notif.html,
          ...(headers ? { headers } : {}),
          replyTo: 'kontakt@kaufmann-health.de',
          context: { kind: 'therapist_action_reminder', match_id },
        });
        if (emailSent) {
          sent++;
        } else {
          await logError('admin.api.matches.therapist_action_reminders', new Error('Email send returned false'), { stage: 'send_email_failed', match_id, email: therapistEmail }, ip, ua);
        }
      } catch (e) {
        await logError('admin.api.matches.therapist_action_reminders', e, { stage: 'send_email', match_id }, ip, ua);
      }
    }

    void track({ type: 'cron_completed', level: 'info', source: 'admin.api.matches.therapist_action_reminders', props: { processed, sent, duration_ms: Date.now() - startedAt }, ip, ua });

    return NextResponse.json({ data: { processed, sent }, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.matches.therapist_action_reminders', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.matches.therapist_action_reminders' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
