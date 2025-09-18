import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { sendEmail } from '@/lib/email/client';
import { renderPatientMatchFound } from '@/lib/email/templates/patientUpdates';
import { renderTherapistNotification } from '@/lib/email/templates/therapistNotification';
import { BASE_URL } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: Request) {
  const isGet = req.method === 'GET';
  const { pathname, searchParams } = (() => {
    try {
      const u = new URL(req.url);
      return { pathname: u.pathname, searchParams: u.searchParams };
    } catch {
      return { pathname: '', searchParams: new URLSearchParams() } as const;
    }
  })();
  const parts = pathname.split('/').filter(Boolean);
  // Expecting /api/match/{uuid}/select
  const matchIdx = parts.indexOf('match');
  const uuid = matchIdx >= 0 && parts.length > matchIdx + 1 ? decodeURIComponent(parts[matchIdx + 1]) : '';
  if (!uuid) {
    // For GET requests from email, redirect to a friendly page instead of showing raw JSON
    if (isGet) return NextResponse.redirect(`${BASE_URL}/auswahl-bestaetigt?error=missing`);
    return NextResponse.json({ data: null, error: 'Missing uuid' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const therapistFromQuery = searchParams.get('therapist');
    const therapist_id = String((therapistFromQuery || body?.therapist_id || '')).trim();
    if (!therapist_id) {
      if (isGet) return NextResponse.redirect(`${BASE_URL}/auswahl-bestaetigt?error=missing_therapist`);
      return NextResponse.json({ data: null, error: 'therapist is required' }, { status: 400 });
    }

    // Load reference match by secure_uuid to obtain patient_id
    const { data: refMatch, error: refErr } = await supabaseServer
      .from('matches')
      .select('id, patient_id')
      .eq('secure_uuid', uuid)
      .single();
    if (refErr || !refMatch) {
      await logError('api.match.select', refErr || 'not_found', { stage: 'load_ref_match', uuid });
      if (isGet) return NextResponse.redirect(`${BASE_URL}/auswahl-bestaetigt?error=not_found`);
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }
    const patient_id = (refMatch as { patient_id: string }).patient_id;

    // Find the target match row for this patient + therapist
    const { data: targetMatch, error: tmErr } = await supabaseServer
      .from('matches')
      .select('id, therapist_id, status')
      .eq('patient_id', patient_id)
      .eq('therapist_id', therapist_id)
      .limit(1)
      .maybeSingle();

    if (tmErr || !targetMatch) {
      await logError('api.match.select', tmErr || 'not_found', { stage: 'load_target_match', uuid, patient_id, therapist_id });
      if (isGet) return NextResponse.redirect(`${BASE_URL}/auswahl-bestaetigt?error=unavailable`);
      return NextResponse.json({ data: null, error: 'Match not available' }, { status: 404 });
    }

    const match_id = (targetMatch as { id: string }).id;
    const existingStatus = String((targetMatch as { status?: string | null }).status || '').toLowerCase();

    // Determine whether we should update and notify. We only transition from 'proposed' to 'patient_selected'.
    const shouldTransition = existingStatus === 'proposed';
    const alreadySelected = existingStatus === 'patient_selected' || existingStatus === 'accepted';

    if (shouldTransition) {
      const { error: updErr } = await supabaseServer
        .from('matches')
        .update({ status: 'patient_selected' })
        .eq('id', match_id);
      if (updErr) {
        await logError('api.match.select', updErr, { stage: 'update_status', match_id });
        if (isGet) return NextResponse.redirect(`${BASE_URL}/auswahl-bestaetigt?error=update_failed`);
        return NextResponse.json({ data: null, error: 'Failed to update' }, { status: 500 });
      }
    }

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'patient_selected',
      source: 'api.match.select',
      props: { match_id, patient_id, therapist_id },
    });

    // Fire-and-forget notifications (only on first transition to patient_selected)
    try {
      if (!shouldTransition) {
        // Skip notifying if the match is already selected/accepted to avoid duplicate emails.
        // Still proceed to redirect/return success for UX.
        if (isGet) {
          return NextResponse.redirect(`${BASE_URL}/auswahl-bestaetigt?ok=1`);
        }
        return NextResponse.json({ data: { ok: true }, error: null }, { status: 200 });
      }
      // Load entities
      const [{ data: patientRow }, { data: therapistRow }] = await Promise.all([
        supabaseServer.from('people').select('id, name, email, phone, metadata').eq('id', patient_id).single(),
        supabaseServer.from('therapists').select('id, first_name, last_name, email, city').eq('id', therapist_id).single(),
      ]);

      type PatientMeta = { city?: string; issue?: string; session_preference?: 'online' | 'in_person' };
      type PatientRow = { id: string; name?: string | null; email?: string | null; phone?: string | null; metadata?: PatientMeta | null };
      type TherapistRow = { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; city?: string | null };

      const pRow = (patientRow || null) as PatientRow | null;
      const tRow = (therapistRow || null) as TherapistRow | null;

      const patientEmail = (pRow?.email || '').trim();
      const patientMeta: PatientMeta = (pRow?.metadata || {}) as PatientMeta;
      const therapistEmail = (tRow?.email || '').trim();
      const therapistName = [tRow?.first_name || '', tRow?.last_name || ''].join(' ').trim() || null;

      // Build magic link to acceptance page using match secure_uuid
      let magicUrl: string | null = null;
      try {
        const { data: matchRow } = await supabaseServer
          .from('matches')
          .select('secure_uuid')
          .eq('id', match_id)
          .single();
        const su = (matchRow as { secure_uuid?: string | null } | null)?.secure_uuid || null;
        if (su) magicUrl = `${BASE_URL}/match/${su}`;
      } catch {}

      // Notify therapist (privacy-first): no PII in email, link to acceptance page
      if (therapistEmail && magicUrl) {
        const notif = renderTherapistNotification({
          type: 'selection',
          therapistName,
          patientCity: patientMeta.city || null,
          patientIssue: patientMeta.issue || null,
          patientSessionPreference: patientMeta.session_preference ?? null,
          magicUrl,
        });
        await sendEmail({
          to: therapistEmail,
          subject: notif.subject,
          html: notif.html,
          text: notif.text,
          context: { kind: 'therapist_selected_notification', match_id, patient_id, therapist_id },
        });
      }

      // Confirm to patient
      if (patientEmail) {
        const confirm = renderPatientMatchFound({ patientName: pRow?.name || null, therapistName, specializations: [] });
        void sendEmail({
          to: patientEmail,
          subject: confirm.subject,
          html: confirm.html,
          text: confirm.text,
          context: { kind: 'patient_selection_confirm', match_id, patient_id, therapist_id },
        });
      }
    } catch (e) {
      void logError('api.match.select', e, { stage: 'notify' });
    }

    // For email clicks (GET), redirect to a friendly confirmation page to avoid exposing raw JSON
    if (isGet) {
      return NextResponse.redirect(`${BASE_URL}/auswahl-bestaetigt?ok=1`);
    }
    return NextResponse.json({ data: { ok: true }, error: null }, { status: 200 });
  } catch (e) {
    await logError('api.match.select', e, { stage: 'exception', uuid });
    if (isGet) return NextResponse.redirect(`${BASE_URL}/auswahl-bestaetigt?error=invalid`);
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
