import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistSelectionNotification } from '@/lib/email/templates/therapistSelectionNotification';
import { BASE_URL } from '@/lib/constants';

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

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  const startedAt = Date.now();

  try {
    // Auth: allow either admin cookie OR Cron secret
    const cronSecretHeader = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization') || '';
    const isAuthBearer = Boolean(cronSecret && authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret);
    let isCron = Boolean(cronSecret && cronSecretHeader && cronSecretHeader === cronSecret) || isAuthBearer;
    if (!isCron && req.headers.get('x-vercel-cron')) isCron = true;

    const isAdmin = await assertAdmin(req);
    if (!isAdmin && !isCron) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const stage = (url.searchParams.get('stage') || '').toLowerCase(); // '20h'

    // 20h window (between 20 and 21 hours ago)
    const fromIso = hoursAgo(21);
    const toIso = hoursAgo(20);

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.matches.therapist_action_reminders', props: { stage }, ip, ua });

    // Find patient selections in the 20h window
    const { data: events, error: evErr } = await supabaseServer
      .from('events')
      .select('id, created_at, props')
      .eq('type', 'patient_selected')
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .limit(1000);

    if (evErr) {
      await logError('admin.api.matches.therapist_action_reminders', evErr, { stage: 'fetch_events' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch events' }, { status: 500 });
    }

    type EventRow = { id: string; created_at?: string | null; props?: Record<string, unknown> | null };
    const items = (events as EventRow[] | null) || [];

    // Collect match_ids
    const matchIds = new Set<string>();
    function getStringProp(obj: Record<string, unknown>, key: string): string | null {
      const v = obj[key];
      return typeof v === 'string' ? v : null;
    }
    for (const e of items) {
      const p = e.props && typeof e.props === 'object' ? e.props : null;
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
        supabaseServer.from('people').select('id, name, email, phone, metadata').eq('id', m.patient_id).single(),
        supabaseServer.from('therapists').select('id, first_name, last_name, email, city').eq('id', m.therapist_id).single(),
      ]);

      type PatientMeta = { city?: string; issue?: string; session_preference?: 'online' | 'in_person' };
      type PatientRow = { id: string; name?: string | null; email?: string | null; phone?: string | null; metadata?: PatientMeta | null };
      type TherapistRow = { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; city?: string | null };

      const pRow = (patientRow || null) as PatientRow | null;
      const tRow = (therapistRow || null) as TherapistRow | null;

      const patientEmail = (pRow?.email || '').trim();
      const patientName = pRow?.name || null;
      const patientPhone = pRow?.phone || null;
      const patientMeta: PatientMeta = (pRow?.metadata || {}) as PatientMeta;
      const therapistEmail = (tRow?.email || '').trim();
      const therapistFirst = (tRow?.first_name || '').trim();
      const therapistLast = (tRow?.last_name || '').trim();
      const therapistName = [therapistFirst, therapistLast].join(' ').trim() || null;

      if (!therapistEmail || !patientEmail) continue;

      // Build prefilled mailto link
      const subject = encodeURIComponent(`Terminvereinbarung für Ihre Therapie - ${therapistFirst} ${therapistLast}`.trim());
      const greetName = (patientName || '').split(' ')[0] || (patientName || '');
      const sessionFee = 80; // default if not in DB
      const location = patientMeta.session_preference === 'in_person' ? (tRow?.city || 'Praxis (Adresse im Erstkontakt)') : 'Online via Zoom';
      const bodyRaw = `Liebe/r ${greetName},\n\n` +
        `Sie hatten mich als Ihre/n Therapeut/in ausgewählt. Ich möchte Ihnen zeitnah Termine vorschlagen.\n\n` +
        `Für unser Erstgespräch schlage ich Ihnen folgende Termine vor:\n\n` +
        `Option 1: [Tag, Datum um Uhrzeit]\n` +
        `Option 2: [Tag, Datum um Uhrzeit]\n` +
        `Option 3: [Tag, Datum um Uhrzeit]\n\n` +
        `Bitte teilen Sie mir mit, welcher Termin für Sie passt, oder schlagen Sie gerne eine Alternative vor.\n\n` +
        `Das Erstgespräch dauert 50 Minuten und kostet ${sessionFee}€.\n` +
        `Ort: ${location}\n\n` +
        `Mit freundlichen Grüßen,\n` +
        `${therapistFirst} ${therapistLast}`;
      const body = encodeURIComponent(bodyRaw);
      const mailto = `mailto:${encodeURIComponent(patientEmail)}?subject=${subject}&body=${body}`;
      const ctaUrl = `${BASE_URL}/api/track/therapist-action?action=email_clicked&match_id=${encodeURIComponent(match_id)}&redirect=${encodeURIComponent(mailto)}`;

      const notif = renderTherapistSelectionNotification({
        therapistName,
        patientName,
        patientEmail,
        patientPhone,
        patientCity: patientMeta.city || null,
        patientIssue: patientMeta.issue || null,
        patientSessionPreference: patientMeta.session_preference ?? null,
        ctaUrl,
        subjectOverride: '⚠️ Erinnerung: Klient wartet auf Ihre Antwort',
      });

      try {
        void track({ type: 'email_attempted', level: 'info', source: 'admin.api.matches.therapist_action_reminders', props: { match_id } });
        await sendEmail({
          to: therapistEmail,
          subject: notif.subject,
          html: notif.html,
          text: notif.text,
          context: { kind: 'therapist_action_reminder', match_id },
        });
        sent++;
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
