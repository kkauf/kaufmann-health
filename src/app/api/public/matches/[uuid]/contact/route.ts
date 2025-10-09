import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { renderTherapistNotification } from '@/lib/email/templates/therapistNotification';
import { sendEmail } from '@/lib/email/client';
import { maybeFirePatientConversion } from '@/lib/conversion';
import { BASE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

async function checkRateLimitByMatches(patientId: string): Promise<{ allowed: boolean; count: number }> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await supabaseServer
      .from('matches')
      .select('id')
      .eq('patient_id', patientId)
      .contains('metadata', { patient_initiated: true })
      .gte('created_at', oneDayAgo);
    if (error) return { allowed: true, count: 0 };
    const count = Array.isArray(data) ? data.length : 0;
    return { allowed: count < 3, count };
  } catch {
    return { allowed: true, count: 0 };
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
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
  // Expecting /api/public/matches/{uuid}/contact
  const matchesIdx = parts.indexOf('matches');
  const uuid = matchesIdx >= 0 && parts.length > matchesIdx + 1 ? decodeURIComponent(parts[matchesIdx + 1]) : '';
  if (!uuid) return NextResponse.json({ data: null, error: 'Missing uuid' }, { status: 400 });

  try {
    const body = await req.json().catch(() => ({}));
    const therapist_id = String(body?.therapist_id || '').trim();
    const contact_type = String(body?.contact_type || '').trim();
    const patient_reason = String(body?.patient_reason || '').trim();
    const patient_message = typeof body?.patient_message === 'string' ? String(body.patient_message) : '';
    const session_format = body?.session_format === 'online' || body?.session_format === 'in_person' ? body.session_format : null;

    if (!therapist_id || !patient_reason || !contact_type) {
      return NextResponse.json({ data: null, error: 'Fehlende Pflichtfelder' }, { status: 400 });
    }
    if (contact_type !== 'booking' && contact_type !== 'consultation') {
      return NextResponse.json({ data: null, error: 'Ungültiger Kontakttyp' }, { status: 400 });
    }
    // Validate session format for booking type
    if (contact_type === 'booking' && !session_format) {
      return NextResponse.json({ data: null, error: 'Bitte wähle, ob der Termin online oder vor Ort stattfinden soll' }, { status: 400 });
    }

    // Resolve reference match to get patient context and TTL (30 days)
    const { data: ref, error: refErr } = await supabaseServer
      .from('matches')
      .select('id, created_at, patient_id')
      .eq('secure_uuid', uuid)
      .single();
    if (refErr || !ref) {
      await logError('api.public.matches.contact', refErr || 'not_found', { stage: 'load_ref', uuid });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }
    type RefRow = { id: string; created_at?: string | null; patient_id: string };
    const r = ref as unknown as RefRow;
    const age = hoursSince(r.created_at ?? undefined);
    if (age == null || age > 24 * 30) {
      return NextResponse.json({ data: null, error: 'Link expired' }, { status: 410 });
    }

    const patientId = r.patient_id;

    // Rate limit by events (3 sends per day)
    const rl = await checkRateLimitByMatches(patientId);
    if (!rl.allowed) {
      void track({ type: 'contact_rate_limit_hit', source: 'api.public.matches.contact', props: { patient_id: patientId, count: rl.count } });
      return NextResponse.json({ error: 'Du hast bereits 3 Therapeuten kontaktiert. Bitte warte auf ihre Rückmeldung, bevor du weitere Therapeuten kontaktierst.', code: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
    }

    // Validate therapist exists and is verified
    const { data: therapist, error: tErr } = await supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, email')
      .eq('id', therapist_id)
      .eq('status', 'verified')
      .single();
    if (tErr || !therapist) {
      return NextResponse.json({ data: null, error: 'Therapeut nicht gefunden' }, { status: 404 });
    }

    // Find or create target match for this patient+therapist (avoid duplicates)
    type MatchRow = { id: string; secure_uuid: string | null; status?: string | null; metadata?: Record<string, unknown> | null };
    const { data: existingMatch } = await supabaseServer
      .from('matches')
      .select('id, secure_uuid, status, metadata')
      .eq('patient_id', patientId)
      .eq('therapist_id', therapist_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let matchId: string;
    let magicUuid: string | null = null;

    if (existingMatch) {
      // Merge metadata
      const meta: Record<string, unknown> = (existingMatch.metadata as Record<string, unknown>) || {};
      const merged: Record<string, unknown> = { ...meta, patient_initiated: true, contact_type, patient_reason, patient_message };
      try {
        await supabaseServer
          .from('matches')
          .update({ metadata: merged })
          .eq('id', (existingMatch as MatchRow).id);
      } catch (e) {
        // Non-fatal
        await logError('api.public.matches.contact', e, { stage: 'update_metadata', match_id: (existingMatch as MatchRow).id });
      }
      matchId = (existingMatch as MatchRow).id;
      magicUuid = (existingMatch as MatchRow).secure_uuid || null;
    } else {
      // Create a new match row
      const { data: newMatch, error: mErr } = await supabaseServer
        .from('matches')
        .insert({
          patient_id: patientId,
          therapist_id,
          status: 'proposed',
          metadata: { patient_initiated: true, contact_type, patient_reason, patient_message, session_format },
        })
        .select('id, secure_uuid')
        .single();
      if (mErr || !newMatch) {
        await logError('api.public.matches.contact', mErr, { stage: 'create_match', patient_id: patientId, therapist_id });
        return NextResponse.json({ data: null, error: 'Unerwarteter Fehler' }, { status: 500 });
      }
      matchId = newMatch.id as string;
      magicUuid = (newMatch.secure_uuid as string) || null;
    }

    // Send notification email to therapist (privacy-first, EARTH-205: include message and contact type)
    try {
      type TherapistRow = { email: string; first_name: string | null };
      const t = therapist as unknown as TherapistRow;
      const email = t.email;
      if (email && magicUuid) {
        const content = renderTherapistNotification({
          type: 'outreach',
          therapistName: t.first_name || null,
          patientCity: null,
          patientIssue: patient_reason,
          patientSessionPreference: session_format,
          magicUrl: `${BASE_URL}/match/${magicUuid}`,
          expiresHours: 72,
          contactType: contact_type as 'booking' | 'consultation',
          patientMessage: patient_message,
        });
        void sendEmail({ to: email, subject: content.subject, html: content.html }).catch(err => {
          void logError('email.therapist_notification', err, { match_id: matchId, therapist_id }, ip, ua);
        });
      }
    } catch (e) {
      // Do not fail request on email issues
      await logError('api.public.matches.contact', e, { stage: 'send_email', match_id: matchId });
    }

    void track({ type: 'contact_message_sent', source: 'api.public.matches.contact', props: { match_id: matchId, patient_id: patientId, therapist_id } });

    // Fire Google Ads conversion when patient sends message (Scenario 4: direct contact from /therapeuten)
    // Only fires if contact was verified (email OR SMS) - EARTH-204
    try {
      // Fetch patient email/phone for conversion
      const { data: patient, error: pErr } = await supabaseServer
        .from('people')
        .select('email, phone_number')
        .eq('id', patientId)
        .single();
      if (!pErr && patient) {
        await maybeFirePatientConversion({
          patient_id: patientId,
          email: patient.email || undefined,
          phone_number: patient.phone_number || undefined,
          verification_method: patient.email ? 'email' : 'sms',
          ip,
          ua,
        });
      }
    } catch (e) {
      // Log but don't fail the contact flow
      await logError('api.public.matches.contact', e, { stage: 'fire_conversion', match_id: matchId });
    }

    return NextResponse.json({ data: { ok: true, match_id: matchId }, error: null });
  } catch (e) {
    await logError('api.public.matches.contact', e, { stage: 'exception', uuid });
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
