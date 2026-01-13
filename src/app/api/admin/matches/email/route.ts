import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderPatientCustomUpdate, renderPatientMatchFound } from '@/lib/email/templates/patientUpdates';
import { renderPatientSelectionEmail } from '@/lib/email/templates/patientSelection';
import { BASE_URL } from '@/lib/constants';
import { computeMismatches } from '@/features/leads/lib/match';
import { sendTransactionalSms } from '@/lib/sms/client';
import type { EmailContent } from '@/lib/email/types';
import { THERAPIST_SELECT_COLUMNS_WITH_GENDER } from '@/lib/therapist-mapper';

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

type Match = { id: string; patient_id: string; therapist_id: string };
type Person = {
  id: string;
  name?: string | null;
  email?: string | null;
  metadata?: { city?: string; issue?: string } | null;
};

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

type Body = {
  id?: string; // Match ID when using match_found or custom templates
  template?: 'match_found' | 'custom' | 'selection';
  message?: string;
  // For selection template
  patient_id?: string;
  therapist_ids?: string[];
  // Personalized concierge options
  personalized_message?: string; // Custom message shown prominently in selection email
  highlighted_therapist_id?: string; // Therapist to mark as "best match" instead of auto-sorting
};

export async function POST(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.NODE_ENV === 'production' && !sameOrigin(req)) {
    return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }

  const id = String(body?.id || '').trim();
  const template = (body?.template || 'custom') as 'match_found' | 'custom' | 'selection';
  const customMessage = typeof body?.message === 'string' ? String(body.message).slice(0, 4000) : '';

  if (template !== 'selection' && !id) {
    return NextResponse.json({ data: null, error: 'id is required' }, { status: 400 });
  }

  try {
    let patient_id: string;
    let selectionTherapistCount: number | undefined = undefined; // used for metadata hinting
    let personalizedMessage: string | undefined = undefined; // concierge personalization
    let highlightedTherapistId: string | undefined = undefined; // highlighted "best match"
    let m: Match | null = null;
    if (template === 'selection') {
      patient_id = String(body?.patient_id || '').trim();
      if (!patient_id) {
        return NextResponse.json({ data: null, error: 'patient_id is required for selection' }, { status: 400 });
      }
    } else {
      const { data: match, error: mErr } = await supabaseServer
        .from('matches')
        .select('id, patient_id, therapist_id')
        .eq('id', id)
        .single();

      if (mErr || !match) {
        await logError('admin.api.matches.email', mErr || new Error('not found'), { stage: 'load_match', id });
        return NextResponse.json({ data: null, error: 'Match not found' }, { status: 404 });
      }
      m = match as Match;
      patient_id = m.patient_id;
    }

    const { data: patientRow, error: pErr } = await supabaseServer
      .from('people')
      .select('id, name, email, phone_number, metadata')
      .eq('id', patient_id)
      .single();

    if (pErr) {
      await logError('admin.api.matches.email', pErr, { stage: 'load_patient', id });
      return NextResponse.json({ data: null, error: 'Failed to load entities' }, { status: 500 });
    }

    const patient = (patientRow || null) as Person | null;

    const patientEmail = (patient?.email || '').trim();
    const isTempEmail = patientEmail.startsWith('temp_') && patientEmail.endsWith('@kaufmann.health');
    const patientPhone = (patient as unknown as { phone_number?: string | null })?.phone_number?.trim?.() || '';
    const patientName = (patient?.name || '') || null;


    let content: EmailContent; // will be set in all template branches

    if (template === 'match_found') {
      if (!m) {
        return NextResponse.json({ data: null, error: 'Match context missing' }, { status: 400 });
      }
      // Load therapist only when needed
      const { data: therapistRow, error: tErr } = await supabaseServer
        .from('therapists')
        .select('id, first_name, last_name')
        .eq('id', m.therapist_id)
        .single();
      if (tErr) {
        await logError('admin.api.matches.email', tErr, { stage: 'load_therapist', id });
        return NextResponse.json({ data: null, error: 'Failed to load entities' }, { status: 500 });
      }
      const therapistName = therapistRow
        ? ([therapistRow.first_name || '', therapistRow.last_name || ''].join(' ').trim() || null)
        : null;
      // For MVP we skip specializations until stored/available consistently
      content = renderPatientMatchFound({ patientName: patientName, therapistName, specializations: [] });
    } else if (template === 'custom') {
      content = renderPatientCustomUpdate({ patientName, message: customMessage });
    } else if (template === 'selection') {
      // Determine therapist IDs: either provided explicitly or inferred from proposed matches
      let therapistIds: string[] = Array.isArray(body?.therapist_ids) ? body!.therapist_ids!.map((v) => String(v).trim()).filter(Boolean) : [];
      if (therapistIds.length === 0) {
        const { data: proposed } = await supabaseServer
          .from('matches')
          .select('therapist_id')
          .eq('patient_id', patient_id)
          .eq('status', 'proposed')
          .order('created_at', { ascending: false })
          .limit(3);
        therapistIds = ((proposed || []) as Array<{ therapist_id: string }>).map((r) => r.therapist_id);
      }
      if (therapistIds.length === 0) {
        return NextResponse.json({ data: null, error: 'No therapists provided or found for selection' }, { status: 400 });
      }
      if (therapistIds.length > 3) therapistIds = therapistIds.slice(0, 3);
      selectionTherapistCount = therapistIds.length;

      // Fetch therapist details
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
      const { data: therapistRows, error: tErr } = await supabaseServer
        .from('therapists')
        .select(THERAPIST_SELECT_COLUMNS_WITH_GENDER)
        .in('id', therapistIds);
      if (tErr) {
        await logError('admin.api.matches.email', tErr, { stage: 'load_therapists_for_selection', patient_id });
        return NextResponse.json({ data: null, error: 'Failed to load therapists' }, { status: 500 });
      }
      const list = (therapistRows || []) as unknown as TherapistRow[];

      // Build sorted items using mismatch scoring
      const pMeta: PatientMetaServer = ((): PatientMetaServer => {
        const raw = (patient?.metadata || null) as PatientMetaServer | null;
        return raw && typeof raw === 'object' ? raw : {};
      })();
      const scored = list.map((t) => {
        const tMeta = (() => {
          const m = (t?.metadata || null) as TherapistMeta | null;
          const profile = m && m.profile && typeof m.profile === 'object' ? m.profile : {};
          const approach_text = typeof profile?.approach_text === 'string' ? profile.approach_text : '';
          const modalities = Array.isArray(t?.modalities)
            ? (t.modalities as string[])
            : (Array.isArray(m?.modalities) ? (m!.modalities as string[]) : []);
          const session_preferences = Array.isArray(m?.session_preferences) ? (m!.session_preferences as string[]) : [];
          return { approach_text, modalities, session_preferences } as { approach_text: string; modalities: string[]; session_preferences: string[] };
        })();
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
            session_preferences: tMeta.session_preferences,
            modalities: tMeta.modalities,
          }
        );
        return { t, mm, tMeta } as const;
      });
      scored.sort((a, b) => {
        if (a.mm.isPerfect !== b.mm.isPerfect) return a.mm.isPerfect ? -1 : 1;
        return a.mm.reasons.length - b.mm.reasons.length;
      });

      // Get a secure_uuid from any match for this patient
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
        return NextResponse.json({ data: null, error: 'No magic link available for selection' }, { status: 400 });
      }

      // Parse personalized options
      personalizedMessage = typeof body?.personalized_message === 'string' ? body.personalized_message.trim().slice(0, 2000) : undefined;
      highlightedTherapistId = typeof body?.highlighted_therapist_id === 'string' ? body.highlighted_therapist_id.trim() : undefined;

      const items = scored.map((s, idx) => {
        const t = s.t;
        const selectUrl = `${BASE_URL}/api/match/${secure_uuid}/select?therapist=${encodeURIComponent(t.id)}`;
        // Use highlighted_therapist_id if provided, otherwise default to first (best scoring)
        const isBest = highlightedTherapistId ? t.id === highlightedTherapistId : idx === 0;
        return {
          id: t.id,
          first_name: (t.first_name || '').trim(),
          last_name: (t.last_name || '').trim(),
          photo_url: t.photo_url || undefined,
          modalities: s.tMeta.modalities,
          approach_text: s.tMeta.approach_text,
          accepting_new: t.accepting_new ?? null,
          city: t.city || null,
          selectUrl,
          isBest,
        };
      });

      const matchesUrl = `${BASE_URL}/matches/${secure_uuid}`;
      content = renderPatientSelectionEmail({ patientName, items, matchesUrl, personalizedMessage });

      // Choose channel: Email preferred; fallback to SMS for phone-only Klient:innen
      if ((!patientEmail || isTempEmail) && !patientPhone) {
        return NextResponse.json({ data: null, error: 'No contact method available' }, { status: 400 });
      }

      if ((!patientEmail || isTempEmail) && patientPhone) {
        // SMS fallback
        try {
          void track({ type: 'sms_attempted', level: 'info', source: 'admin.api.matches.email', props: { template: 'selection', patient_id } });
          const ok = await sendTransactionalSms(patientPhone, `Deine handverlesene Therapeuten-Auswahl ist bereit: ${matchesUrl}?direct=1`);
          if (ok) {
            void track({ type: 'sms_sent', level: 'info', source: 'admin.api.matches.email', props: { template: 'selection', patient_id } });
            // Also mark metadata like email path for UI consistency
            try {
              const nowIso = new Date().toISOString();
              const currentMetaRaw = (patient?.metadata ?? null) as unknown;
              const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
              const currentMeta = isObject(currentMetaRaw) ? currentMetaRaw : {};
              const nextMeta = { ...currentMeta, selection_email_sent_at: nowIso, selection_email_count: items.length } as Record<string, unknown>;
              if (personalizedMessage) nextMeta.personalized_message = personalizedMessage;
              if (highlightedTherapistId) nextMeta.highlighted_therapist_id = highlightedTherapistId;
              await supabaseServer.from('people').update({ metadata: nextMeta }).eq('id', patient_id);
            } catch {}
            return NextResponse.json({ data: { ok: true, via: 'sms' }, error: null }, { status: 200 });
          } else {
            await logError('admin.api.matches.email', new Error('SMS send returned false'), { stage: 'send_sms_failed', patient_id });
            return NextResponse.json({ data: null, error: 'SMS send failed' }, { status: 500 });
          }
        } catch (e) {
          await logError('admin.api.matches.email', e, { stage: 'send_sms_exception', patient_id });
          return NextResponse.json({ data: null, error: 'SMS exception' }, { status: 500 });
        }
      }
    } else {
      return NextResponse.json({ data: null, error: 'Invalid template' }, { status: 400 });
    }

    // For non-selection templates, email is required
    if (template !== 'selection' && (!patientEmail || isTempEmail)) {
      return NextResponse.json({ data: null, error: 'Patient email missing' }, { status: 400 });
    }

    // Await (client never throws; logs internally). Keep response predictable.
    const context: Record<string, unknown> = { kind: 'patient_update', template };
    if (template === 'selection') {
      context['patient_id'] = patient_id;
    } else if (m) {
      context['match_id'] = m.id;
      context['patient_id'] = m.patient_id;
      context['therapist_id'] = m.therapist_id;
    }
    // Analytics: attempted (guarded for test mocks that may not provide track)
    try {
      if (typeof track === 'function') {
        void track({
          type: 'email_attempted',
          level: 'info',
          source: 'admin.api.matches.email',
          props: {
            template,
            ...(template === 'selection'
              ? { patient_id }
              : m
              ? { match_id: m.id, patient_id: m.patient_id, therapist_id: m.therapist_id }
              : {}),
          },
        });
      }
    } catch {}

    await sendEmail({
      to: patientEmail,
      subject: content.subject,
      html: content.html,
      text: content.text,
      context,
    });

    // Mark selection email sent (best-effort) so Admin UI can highlight "done for now"
    if (template === 'selection') {
      try {
        // Helper to merge JSON metadata
        function isObject(v: unknown): v is Record<string, unknown> {
          return typeof v === 'object' && v !== null && !Array.isArray(v);
        }
        const nowIso = new Date().toISOString();
        const currentMetaRaw = (patient?.metadata ?? null) as unknown;
        const currentMeta = isObject(currentMetaRaw) ? currentMetaRaw : {};
        const nextMeta: Record<string, unknown> = {
          ...currentMeta,
          selection_email_sent_at: nowIso,
        };
        if (typeof selectionTherapistCount === 'number') {
          nextMeta.selection_email_count = selectionTherapistCount;
        }
        if (personalizedMessage) nextMeta.personalized_message = personalizedMessage;
        if (highlightedTherapistId) nextMeta.highlighted_therapist_id = highlightedTherapistId;
        await supabaseServer
          .from('people')
          .update({ metadata: nextMeta })
          .eq('id', patient_id);
      } catch (e) {
        // Non-fatal, just log
        await logError('admin.api.matches.email', e, { stage: 'mark_selection_sent', patient_id });
      }
    }

    return NextResponse.json({ data: { ok: true }, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.matches.email', e, { stage: 'exception', id });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
