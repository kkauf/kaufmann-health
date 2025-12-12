import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabase-server';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistNotification } from '@/lib/email/templates/therapistNotification';
import { BASE_URL } from '@/lib/constants';
import { parseRequestBody, success, fail } from '@/lib/api-utils';
import { TherapistResendMagicLinkInput } from '@/contracts/match';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

function extractMessage(err: unknown): string | null {
  if (typeof err === 'object' && err !== null) {
    const msg = (err as { message?: unknown }).message;
    return typeof msg === 'string' ? msg : null;
  }
  return null;
}

function isUuidLike(s: string): boolean {
  if (process.env.NODE_ENV === 'test') return typeof s === 'string' && s.length > 0;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
}

async function findMatchByUuid(uuid: string) {
  // First: current secure_uuid
  try {
    const { data: match, error } = await supabaseServer
      .from('matches')
      .select('id, secure_uuid, created_at, patient_id, therapist_id, status, metadata')
      .eq('secure_uuid', uuid)
      .single();

    if (!error && match) return match as any;

    const msg = extractMessage(error);
    if (msg && /Cannot coerce the result to a single JSON object/i.test(msg)) {
      const fb = await supabaseServer
        .from('matches')
        .select('id, secure_uuid, created_at, patient_id, therapist_id, status, metadata')
        .eq('secure_uuid', uuid)
        .order('created_at', { ascending: false })
        .limit(1);
      if (Array.isArray(fb.data) && fb.data.length > 0) return fb.data[0] as any;
    }
  } catch {}

  // Second: old UUIDs stored in metadata.previous_secure_uuids
  try {
    const fb2 = await supabaseServer
      .from('matches')
      .select('id, secure_uuid, created_at, patient_id, therapist_id, status, metadata')
      .filter('metadata', 'cs', JSON.stringify({ previous_secure_uuids: [uuid] }))
      .order('created_at', { ascending: false })
      .limit(1);
    if (Array.isArray(fb2.data) && fb2.data.length > 0) return fb2.data[0] as any;
  } catch {}

  return null;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ua = req.headers.get('user-agent') || '';

  const { pathname } = (() => {
    try {
      const u = new URL(req.url);
      return { pathname: u.pathname };
    } catch {
      return { pathname: '' } as const;
    }
  })();

  const parts = pathname.split('/').filter(Boolean);
  const matchIdx = parts.indexOf('match');
  const uuid = matchIdx >= 0 && parts.length > matchIdx + 1 ? decodeURIComponent(parts[matchIdx + 1]) : '';

  if (!uuid) return fail('Missing uuid', 400);
  if (!isUuidLike(uuid)) return fail('Not found', 404);

  const parsed = await parseRequestBody(req, TherapistResendMagicLinkInput);
  if (!parsed.success) return parsed.response;

  try {
    const match = await findMatchByUuid(uuid);
    if (!match) return fail('Not found', 404);

    type MatchRow = {
      id: string;
      secure_uuid: string | null;
      created_at?: string | null;
      patient_id: string;
      therapist_id: string;
      status?: string | null;
      metadata?: Record<string, unknown> | null;
    };
    const m = match as unknown as MatchRow;

    const createdAge = hoursSince(m.created_at);
    if (createdAge == null || createdAge > 24 * 30) {
      return fail('Link expired', 410);
    }

    const meta = (m.metadata || {}) as Record<string, unknown>;

    // Rate limit: avoid spamming (min 10 minutes between sends)
    const lastIssuedAt = typeof meta['magic_link_issued_at'] === 'string' ? String(meta['magic_link_issued_at']) : null;
    const lastAge = hoursSince(lastIssuedAt);
    if (lastAge != null && lastAge < 10 / 60) {
      return fail('Bitte warte kurz und versuche es erneut.', 429);
    }

    const currentUuid = (m.secure_uuid || '').trim();
    if (!currentUuid) {
      await logError('api.match.resend', 'missing_secure_uuid', { match_id: m.id });
      return fail('Not found', 404);
    }

    const newUuid = randomUUID();

    const prev = Array.isArray(meta['previous_secure_uuids'])
      ? (meta['previous_secure_uuids'] as unknown[]).map((v) => String(v))
      : [];
    const nextPrev = Array.from(new Set([ ...prev, currentUuid ].filter(Boolean)));

    const issuedAt = new Date().toISOString();
    const nextMeta: Record<string, unknown> = {
      ...meta,
      previous_secure_uuids: nextPrev,
      magic_link_issued_at: issuedAt,
      magic_link_issued_count: (typeof meta['magic_link_issued_count'] === 'number' ? Number(meta['magic_link_issued_count']) : 0) + 1,
    };

    const { error: updErr } = await supabaseServer
      .from('matches')
      .update({ secure_uuid: newUuid, metadata: nextMeta })
      .eq('id', m.id);

    if (updErr) {
      await logError('api.match.resend', updErr, { stage: 'update_match_uuid', match_id: m.id });
      return fail('Failed to update', 500);
    }

    // Load therapist
    const { data: therapistRow } = await supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, email')
      .eq('id', m.therapist_id)
      .single();

    type TherapistRow = { id: string; first_name?: string | null; last_name?: string | null; email?: string | null };
    const t = therapistRow as unknown as TherapistRow | null;

    const therapistEmail = (t?.email || '').trim();
    const therapistName = [t?.first_name || '', t?.last_name || ''].join(' ').trim() || null;

    const isPatientInitiated = (() => {
      try {
        const v = (meta as any)?.patient_initiated;
        return v === true || String(v).toLowerCase() === 'true';
      } catch {
        return false;
      }
    })();

    // Load patient metadata for selection-type emails (non-PII)
    let patientCity: string | null = null;
    let patientIssue: string | null = null;
    let patientSessionPreference: 'online' | 'in_person' | null = null;

    try {
      const { data: patientRow } = await supabaseServer
        .from('people')
        .select('metadata')
        .eq('id', m.patient_id)
        .single();

      const pm = ((patientRow as any)?.metadata || {}) as Record<string, unknown>;
      patientCity = typeof pm['city'] === 'string' ? String(pm['city']) : null;
      patientIssue = typeof pm['issue'] === 'string' ? String(pm['issue']) : null;
      const sp = pm['session_preference'];
      if (sp === 'online' || sp === 'in_person') patientSessionPreference = sp;
    } catch {}

    // Patient-initiated data
    const contactTypeRaw = typeof meta['contact_type'] === 'string' ? String(meta['contact_type']) : '';
    const contactType = contactTypeRaw === 'booking' || contactTypeRaw === 'consultation' ? (contactTypeRaw as 'booking' | 'consultation') : null;
    const patientReason = typeof meta['patient_reason'] === 'string' ? String(meta['patient_reason']) : null;
    const patientMessage = typeof meta['patient_message'] === 'string' ? String(meta['patient_message']) : null;
    const sessionFormatRaw = meta['session_format'];
    const sessionFormat = sessionFormatRaw === 'online' || sessionFormatRaw === 'in_person' ? (sessionFormatRaw as 'online' | 'in_person') : null;

    try {
      if (therapistEmail) {
        const emailContent = renderTherapistNotification({
          type: isPatientInitiated ? 'outreach' : 'selection',
          therapistName,
          patientCity: isPatientInitiated ? null : patientCity,
          patientIssue: isPatientInitiated ? (patientReason || null) : patientIssue,
          patientSessionPreference: isPatientInitiated ? sessionFormat : patientSessionPreference,
          magicUrl: `${BASE_URL}/match/${newUuid}`,
          expiresHours: 72,
          ...(isPatientInitiated
            ? {
                contactType,
                patientMessage,
              }
            : {}),
        });

        void sendEmail({
          to: therapistEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          context: {
            kind: 'therapist_match_magic_link_resend',
            match_id: m.id,
            therapist_id: m.therapist_id,
            email_token: newUuid,
            stage: 'resend',
          },
        }).catch((e) => {
          void logError('email.therapist_notification', e, { match_id: m.id, therapist_id: m.therapist_id }, ip, ua);
        });
      }
    } catch (e) {
      await logError('api.match.resend', e, { stage: 'send_email', match_id: m.id }, ip, ua);
    }

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'magic_link_resent',
      source: 'api.match.resend',
      props: { match_id: m.id, therapist_id: m.therapist_id },
    });

    return success({ ok: true });
  } catch (e) {
    await logError('api.match.resend', e, { stage: 'exception', uuid }, ip, ua);
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
