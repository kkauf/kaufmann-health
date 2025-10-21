import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderPatientSelectionEmail } from '@/lib/email/templates/patientSelection';
import { BASE_URL } from '@/lib/constants';
import { computeMismatches } from '@/features/leads/lib/match';
import { sendTransactionalSms } from '@/lib/sms/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PatientMetaServer = {
  city?: string;
  session_preference?: 'online' | 'in_person';
  session_preferences?: ('online' | 'in_person')[];
  issue?: string;
  specializations?: string[];
  gender_preference?: 'male' | 'female' | 'no_preference';
};

type TherapistMeta = {
  profile?: { approach_text?: string | null } | null;
  modalities?: string[] | null;
  session_preferences?: string[] | null;
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
  const http = `http://${host}`;
  const https = `https://${host}`;
  if (origin === http || origin === https) return true;
  if (referer.startsWith(http + '/')) return true;
  if (referer.startsWith(https + '/')) return true;
  return false;
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

// Email events table rows (properties is the canonical column; props kept for test mocks)
type EmailEventRow = {
  id: string;
  created_at?: string | null;
  properties?: Record<string, unknown> | null;
  props?: Record<string, unknown> | null;
};

async function alreadySentForStage(patient_id: string, stage: string): Promise<boolean> {
  try {
    if (stage !== 'day5' && stage !== 'day14') return false;
    // Look back far enough to catch any earlier send for this stage
    const sinceIso = hoursAgo(24 * 30);
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, created_at, properties')
      .in('type', ['email_sent', 'sms_sent'])
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) return false;
    const arr = (data as EmailEventRow[] | null) || [];
    for (const e of arr) {
      const p = (e.properties && typeof e.properties === 'object'
        ? e.properties
        : e.props && typeof e.props === 'object'
        ? e.props
        : null) as Record<string, unknown> | null;
      if (!p) continue;
      const kind = typeof p['kind'] === 'string' ? (p['kind'] as string) : '';
      const s = typeof p['stage'] === 'string' ? (p['stage'] as string) : '';
      const pid = typeof p['patient_id'] === 'string' ? (p['patient_id'] as string) : '';
      if (kind === 'patient_selection_reminder' && s === stage && pid === patient_id) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Ensure we never send two reminders (of any stage) within 24h
async function alreadySentRecently(patient_id: string, hours = 24): Promise<boolean> {
  try {
    const sinceIso = hoursAgo(hours);
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, created_at, properties')
      .in('type', ['email_sent', 'sms_sent'])
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) return false;
    const arr = (data as EmailEventRow[] | null) || [];
    for (const e of arr) {
      const p = (e.properties && typeof e.properties === 'object'
        ? e.properties
        : e.props && typeof e.props === 'object'
        ? e.props
        : null) as Record<string, unknown> | null;
      if (!p) continue;
      const kind = typeof p['kind'] === 'string' ? (p['kind'] as string) : '';
      const pid = typeof p['patient_id'] === 'string' ? (p['patient_id'] as string) : '';
      if (kind === 'patient_selection_reminder' && pid === patient_id) return true;
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
    const isCron = isCronAuthorized(req);
    const isAdmin = await assertAdmin(req);
    if (!isAdmin && !isCron) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (isAdmin && !isCron && !sameOrigin(req)) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const stage = (url.searchParams.get('stage') || '').toLowerCase(); // 'day5' | 'day14'

    // Define windows
    const nowIso = new Date().toISOString();
    let fromIso: string | undefined;
    let toIso: string | undefined;
    if (stage === 'day5') {
      // Between 5 and 6 days since proposal
      fromIso = hoursAgo(24 * 6);
      toIso = hoursAgo(24 * 5);
    } else if (stage === 'day14') {
      // Between 14 and 15 days since proposal
      fromIso = hoursAgo(24 * 15);
      toIso = hoursAgo(24 * 14);
    }

    void track({ type: 'cron_executed', level: 'info', source: 'admin.api.matches.selection_reminders', props: { stage }, ip, ua });

    // Load candidate matches in 'proposed' window
    let q = supabaseServer
      .from('matches')
      .select('id, patient_id, therapist_id, status, created_at')
      .eq('status', 'proposed')
      .order('created_at', { ascending: false });
    if (toIso) {
      q = q.lt('created_at', nowIso).lt('created_at', toIso);
    }
    if (fromIso) {
      q = q.gte('created_at', fromIso);
    }
    const { data: rows, error } = await q.limit(1000);
    if (error) {
      await logError('admin.api.matches.selection_reminders', error, { stage: 'fetch_matches', stage_label: stage }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch' }, { status: 500 });
    }
    const matches = (rows as Array<{ id: string; patient_id: string; therapist_id: string; created_at?: string | null }> | null) || [];

    // Group by patient
    const byPatient = new Map<string, Set<string>>();
    for (const m of matches) {
      if (!byPatient.has(m.patient_id)) byPatient.set(m.patient_id, new Set());
      byPatient.get(m.patient_id)!.add(m.therapist_id);
    }

    let processed = 0;
    let sent = 0;
    const marked = 0;
    let skippedAlreadySelected = 0;
    let skippedAlreadyContacted = 0;
    let skippedMissingEmail = 0;
    let skippedNoSecureUuid = 0;
    let skippedDuplicateStage = 0;
    let skippedRecentReminder = 0;

    for (const [patient_id, therapistIdsSet] of byPatient) {
      processed++;
      const therapistIds = Array.from(therapistIdsSet).slice(0, 3);

      // Skip if patient already selected a therapist
      try {
        const { data: existing } = await supabaseServer
          .from('matches')
          .select('status')
          .eq('patient_id', patient_id);
        const arr = (existing as Array<{ status?: string | null }> | null) || [];
        const hasSelection = arr.some((r) => (r.status || '').toLowerCase() === 'patient_selected');
        if (hasSelection) {
          skippedAlreadySelected++;
          continue;
        }
      } catch {}
      const { data: patientRow } = await supabaseServer
        .from('people')
        .select('id, name, email, phone_number, metadata')
        .eq('id', patient_id)
        .single();
      const patient = (patientRow || null) as { id: string; name?: string | null; email?: string | null; phone_number?: string | null; metadata?: PatientMetaServer | null } | null;
      const to = (patient?.email || '').trim();
      const isTempEmail = to.startsWith('temp_') && to.endsWith('@kaufmann.health');
      const phoneNumber = (patient?.phone_number || '').trim();
      const hasEmail = Boolean(to) && !isTempEmail;
      const hasPhone = Boolean(phoneNumber);

      // Therapist details
      const { data: therapistRows } = await supabaseServer
        .from('therapists')
        .select('id, first_name, last_name, city, photo_url, gender, modalities, metadata, accepting_new')
        .in('id', therapistIds);
      type TherapistRow = {
        id: string;
        first_name?: string | null;
        last_name?: string | null;
        city?: string | null;
        photo_url?: string | null;
        gender?: string | null;
        modalities?: string[] | null;
        metadata?: TherapistMeta | null;
        accepting_new?: boolean | null;
      };
      const list = (therapistRows || []) as TherapistRow[];

      // Secure UUID
      let secure_uuid: string | undefined;
      try {
        const { data: oneMatch } = await supabaseServer
          .from('matches')
          .select('secure_uuid')
          .eq('patient_id', patient_id)
          .not('secure_uuid', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const rec = (oneMatch as { secure_uuid?: string } | null);
        if (rec && typeof rec.secure_uuid === 'string') secure_uuid = rec.secure_uuid;
      } catch {}
      if (!secure_uuid) {
        skippedNoSecureUuid++;
        continue;
      }

      // Throttle: ensure we only send once per stage per patient within the window
      const dup = await alreadySentForStage(patient_id, stage);
      if (dup) {
        skippedDuplicateStage++;
        continue;
      }
      // Global throttle: never send two reminders to the same patient within 24h
      const recent = await alreadySentRecently(patient_id, 24);
      if (recent) {
        skippedRecentReminder++;
        continue;
      }

      const pMeta: PatientMetaServer = ((): PatientMetaServer => {
        const raw = (patient?.metadata || null) as PatientMetaServer | null;
        return raw && typeof raw === 'object' ? raw : {};
      })();
      const scored = list.map((t) => {
        const m = (t?.metadata || null) as TherapistMeta | null;
        const profile = m && m.profile && typeof m.profile === 'object' ? m.profile : {};
        const approach_text = typeof profile?.approach_text === 'string' ? profile.approach_text : '';
        const modalities = Array.isArray(t?.modalities)
          ? (t.modalities as string[])
          : (Array.isArray(m?.modalities) ? (m!.modalities as string[]) : []);
        const session_preferences = Array.isArray(m?.session_preferences) ? (m!.session_preferences as string[]) : [];
        const mm = computeMismatches(
          {
            city: pMeta.city,
            session_preference: pMeta.session_preference,
            session_preferences: pMeta.session_preferences,
            issue: pMeta.issue,
            specializations: pMeta.specializations,
            gender_preference: pMeta.gender_preference,
          },
          {
            id: t.id,
            gender: t.gender || null,
            city: t.city || null,
            session_preferences,
            modalities,
          }
        );
        return { t, mm, approach_text, modalities } as const;
      });
      scored.sort((a, b) => {
        if (a.mm.isPerfect !== b.mm.isPerfect) return a.mm.isPerfect ? -1 : 1;
        return a.mm.reasons.length - b.mm.reasons.length;
      });

      const items = scored.map((s, idx) => {
        const selectUrl = `${BASE_URL}/api/match/${secure_uuid}/select?therapist=${encodeURIComponent(s.t.id)}`;
        return {
          id: s.t.id,
          first_name: (s.t.first_name || '').trim(),
          last_name: (s.t.last_name || '').trim(),
          photo_url: s.t.photo_url || undefined,
          modalities: s.modalities,
          approach_text: s.approach_text,
          accepting_new: s.t.accepting_new ?? null,
          city: s.t.city || null,
          selectUrl,
          isBest: idx === 0,
        };
      });

      const subject = stage === 'day5'
        ? 'Brauchst du Unterstützung bei der Auswahl?'
        : stage === 'day14'
        ? 'Wie können wir dich weiter unterstützen?'
        : 'Ihre persönliche Therapie-Auswahl';

      const bannerOverrideHtml = (
        '<div style="background: #EEF2FF; padding: 12px; border-radius: 8px; margin-bottom: 20px;">' +
        'Wir sind für dich da. Wenn du dir noch unsicher bist, antworte einfach auf diese E‑Mail – wir helfen dir gern bei der Auswahl.' +
        '</div>'
      );

      const matchesUrl = `${BASE_URL}/matches/${secure_uuid}`;
      const content = renderPatientSelectionEmail({ patientName: patient?.name || null, items, subjectOverride: subject, bannerOverrideHtml, matchesUrl });

      try {
        if (hasEmail) {
          void track({ type: 'email_attempted', level: 'info', source: 'admin.api.matches.selection_reminders', props: { stage, patient_id } });
          const emailSent = await sendEmail({ to, subject: content.subject, html: content.html, text: content.text, context: { kind: 'patient_selection_reminder', stage, patient_id } });
          if (emailSent) {
            sent++;
          } else {
            await logError('admin.api.matches.selection_reminders', new Error('Email send returned false'), { stage: 'send_email_failed', patient_id, email: to }, ip, ua);
          }
        } else if (hasPhone && matchesUrl) {
          const smsBody = `Deine Therapeuten-Empfehlungen sind weiterhin für dich da. Wenn du Unterstützung brauchst, melde dich gern. Auswahl ansehen: ${matchesUrl}`;
          void track({ type: 'sms_attempted', level: 'info', source: 'admin.api.matches.selection_reminders', props: { kind: 'patient_selection_reminder', stage, patient_id } });
          const ok = await sendTransactionalSms(phoneNumber, smsBody);
          if (ok) {
            void track({ type: 'sms_sent', level: 'info', source: 'admin.api.matches.selection_reminders', props: { kind: 'patient_selection_reminder', stage, patient_id } });
            sent++;
          } else {
            await logError('admin.api.matches.selection_reminders', new Error('SMS send returned false'), { stage: 'send_sms_failed', patient_id }, ip, ua);
          }
        } else {
          skippedMissingEmail++;
        }
      } catch (e) {
        await logError('admin.api.matches.selection_reminders', e, { stage: 'send_contact', patient_id }, ip, ua);
      }
    }

    void track({ type: 'cron_completed', level: 'info', source: 'admin.api.matches.selection_reminders', props: { stage, processed, sent, marked, skipped_already_selected: skippedAlreadySelected, skipped_already_contacted: skippedAlreadyContacted, skipped_missing_email: skippedMissingEmail, skipped_no_secure_uuid: skippedNoSecureUuid, skipped_duplicate_stage: skippedDuplicateStage, skipped_recent_reminder: skippedRecentReminder, duration_ms: Date.now() - startedAt }, ip, ua });

    return NextResponse.json({ data: { processed, sent, marked, skipped_already_selected: skippedAlreadySelected, skipped_already_contacted: skippedAlreadyContacted, skipped_missing_email: skippedMissingEmail, skipped_no_secure_uuid: skippedNoSecureUuid, skipped_duplicate_stage: skippedDuplicateStage, skipped_recent_reminder: skippedRecentReminder }, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.matches.selection_reminders', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.matches.selection_reminders' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
