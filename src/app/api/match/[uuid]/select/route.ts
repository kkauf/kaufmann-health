import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { sendEmail } from '@/lib/email/client';
import { renderPatientMatchFound } from '@/lib/email/templates/patientUpdates';
import { renderTherapistSelectionNotification } from '@/lib/email/templates/therapistSelectionNotification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: Request) {
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
  if (!uuid) return NextResponse.json({ data: null, error: 'Missing uuid' }, { status: 400 });

  try {
    const body = await req.json().catch(() => ({}));
    const therapistFromQuery = searchParams.get('therapist');
    const therapist_id = String((therapistFromQuery || body?.therapist_id || '')).trim();
    if (!therapist_id) {
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
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }
    const patient_id = (refMatch as { patient_id: string }).patient_id;

    // Find the target match row for this patient + therapist
    const { data: targetMatch, error: tmErr } = await supabaseServer
      .from('matches')
      .select('id, therapist_id')
      .eq('patient_id', patient_id)
      .eq('therapist_id', therapist_id)
      .limit(1)
      .maybeSingle();

    if (tmErr || !targetMatch) {
      await logError('api.match.select', tmErr || 'not_found', { stage: 'load_target_match', uuid, patient_id, therapist_id });
      return NextResponse.json({ data: null, error: 'Match not available' }, { status: 404 });
    }

    const match_id = (targetMatch as { id: string }).id;

    // Update status to patient_selected (idempotent-ish)
    const { error: updErr } = await supabaseServer
      .from('matches')
      .update({ status: 'patient_selected' })
      .eq('id', match_id);

    if (updErr) {
      await logError('api.match.select', updErr, { stage: 'update_status', match_id });
      return NextResponse.json({ data: null, error: 'Failed to update' }, { status: 500 });
    }

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'patient_selected',
      source: 'api.match.select',
      props: { match_id, patient_id, therapist_id },
    });

    // Fire-and-forget notifications
    try {
      // Load entities
      const [{ data: patientRow }, { data: therapistRow }] = await Promise.all([
        supabaseServer.from('people').select('id, name, email, phone').eq('id', patient_id).single(),
        supabaseServer.from('therapists').select('id, first_name, last_name, email').eq('id', therapist_id).single(),
      ]);

      const patient = (patientRow || null) as { name?: string | null; email?: string | null; phone?: string | null } | null;
      const therapist = (therapistRow || null) as { first_name?: string | null; last_name?: string | null; email?: string | null } | null;

      const patientEmail = (patient?.email || '').trim();
      const patientName = (patient?.name || '') || null;
      const patientPhone = (patient?.phone || '') || null;
      const therapistEmail = (therapist?.email || '').trim();
      const therapistName = [therapist?.first_name || '', therapist?.last_name || ''].join(' ').trim() || null;

      // Notify therapist (if possible)
      if (therapistEmail) {
        const notif = renderTherapistSelectionNotification({
          therapistName,
          patientName,
          patientEmail: patientEmail || null,
          patientPhone,
        });
        void sendEmail({
          to: therapistEmail,
          subject: notif.subject,
          html: notif.html,
          text: notif.text,
          context: { kind: 'therapist_selected_notification', match_id, patient_id, therapist_id },
        });
      }

      // Confirm to patient
      if (patientEmail) {
        const confirm = renderPatientMatchFound({ patientName, therapistName, specializations: [] });
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

    return NextResponse.json({ data: { ok: true }, error: null }, { status: 200 });
  } catch (e) {
    await logError('api.match.select', e, { stage: 'exception', uuid });
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
