import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { sendEmail } from '@/lib/email/client';
import { renderPatientCustomUpdate, renderPatientMatchFound } from '@/lib/email/templates/patientUpdates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60);
}

export async function POST(req: Request) {
  const { pathname, searchParams } = (() => {
    try {
      const u = new URL(req.url);
      return { pathname: u.pathname, searchParams: u.searchParams };
    } catch {
      return { pathname: '', searchParams: new URLSearchParams() } as const;
    }
  })();
  const parts = pathname.split('/').filter(Boolean);
  // Expecting /api/match/{uuid}/respond
  const matchIdx = parts.indexOf('match');
  const uuid = matchIdx >= 0 && parts.length > matchIdx + 1 ? decodeURIComponent(parts[matchIdx + 1]) : '';
  if (!uuid) return NextResponse.json({ data: null, error: 'Missing uuid' }, { status: 400 });
  const reveal = searchParams.get('reveal') === '1';

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim().toLowerCase();
    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ data: null, error: 'Invalid action' }, { status: 400 });
    }

    const { data: match, error: matchErr } = await supabaseServer
      .from('matches')
      .select('id, status, created_at, patient_id, therapist_id')
      .eq('secure_uuid', uuid)
      .single();

    if (matchErr || !match) {
      await logError('api.match.respond', matchErr || 'not_found', { stage: 'load_match', uuid });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    type MatchRow = { id: string; status?: string | null; created_at?: string | null; patient_id: string; therapist_id: string };
    const m = match as unknown as MatchRow;
    const age = hoursSince(m.created_at ?? undefined);
    if (age == null || age > 72) {
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'link_expired_view',
        source: 'api.match.respond',
        props: { match_id: m.id, uuid },
      });
      return NextResponse.json({ data: null, error: 'Link expired' }, { status: 410 });
    }

    const current = String(m.status || '').toLowerCase();
    const nextStatus = action === 'accept' ? 'accepted' : 'declined';

    async function maybeGetContact() {
      try {
        const { data: patientContact } = await supabaseServer
          .from('people')
          .select('name, email, phone')
          .eq('id', m.patient_id)
          .single();
        if (patientContact) {
          const c = patientContact as unknown as { name?: string | null; email?: string | null; phone?: string | null };
          return { name: c.name ?? null, email: c.email ?? null, phone: c.phone ?? null } as const;
        }
      } catch (e) {
        // best-effort; ignore errors
        void logError('api.match.respond', e, { stage: 'load_contact', match_id: m.id });
      }
      return null;
    }

    if (current === 'accepted' || current === 'declined') {
      // Idempotent: return current state
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'therapist_responded',
        source: 'api.match.respond',
        props: { match_id: m.id, action: current },
      });
      if (reveal && current === 'accepted') {
        const contact = await maybeGetContact();
        return NextResponse.json({ data: { status: current, ...(contact ? { contact } : {}) }, error: null });
      }
      return NextResponse.json({ data: { status: current }, error: null });
    }

    // Try to update including responded_at if column exists (safe if migration adds it later)
    let updateError: unknown = null;
    try {
      const { error: updErr } = await supabaseServer
        .from('matches')
        .update({ status: nextStatus, responded_at: new Date().toISOString() })
        .eq('id', m.id);
      updateError = updErr;
    } catch (e) {
      updateError = e;
    }

    const missingRespondedAt = (() => {
      if (!updateError || typeof updateError !== 'object') return false;
      const maybe = (updateError as Record<string, unknown>).message;
      return typeof maybe === 'string' && maybe.includes('column "responded_at"');
    })();
    if (missingRespondedAt) {
      // Retry without the optional column
      const { error: updErr2 } = await supabaseServer
        .from('matches')
        .update({ status: nextStatus })
        .eq('id', m.id);
      if (updErr2) updateError = updErr2; else updateError = null;
    }

    if (updateError) {
      await logError('api.match.respond', updateError, { stage: 'update', match_id: m.id, action });
      return NextResponse.json({ data: null, error: 'Failed to update' }, { status: 500 });
    }

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'therapist_responded',
      source: 'api.match.respond',
      props: { match_id: m.id, action: nextStatus },
    });

    // Fire-and-forget: notify patient about the update (best-effort)
    try {
      type PatientRow = { id: string; name?: string | null; email?: string | null };
      const [{ data: patientRow }, { data: therapistRow }] = await Promise.all([
        supabaseServer.from('people').select('id, name, email').eq('id', m.patient_id).single(),
        supabaseServer.from('therapists').select('id, first_name, last_name').eq('id', m.therapist_id).single(),
      ]);
      if (patientRow) {
        const patient = patientRow as unknown as PatientRow;
        const patientEmail = (patient?.email || '').trim();
        const patientName = (patient?.name || '') || null;
        if (patientEmail) {
          if (nextStatus === 'accepted') {
            const therapistName = therapistRow
              ? ([therapistRow.first_name || '', therapistRow.last_name || ''].join(' ').trim() || null)
              : null;
            const content = renderPatientMatchFound({ patientName, therapistName, specializations: [] });
            void sendEmail({
              to: patientEmail,
              subject: content.subject,
              html: content.html,
              text: content.text,
              context: { kind: 'patient_update_auto', template: 'match_found', match_id: m.id, patient_id: m.patient_id, therapist_id: m.therapist_id },
            });
          } else if (nextStatus === 'declined') {
            const message =
              'kurzes Update: Der vorgeschlagene Therapeut kann Ihren Fall leider nicht übernehmen. Wir suchen weiterhin nach einer passenden Option und melden uns schnellstmöglich.';
            const content = renderPatientCustomUpdate({ patientName, message });
            void sendEmail({
              to: patientEmail,
              subject: content.subject,
              html: content.html,
              text: content.text,
              context: { kind: 'patient_update_auto', template: 'declined', match_id: m.id, patient_id: m.patient_id, therapist_id: m.therapist_id },
            });
          }
        }
      }
    } catch (e) {
      // Never block the response flow; log for observability.
      void logError('api.match.respond', e, { stage: 'notify_patient', match_id: m.id, action: nextStatus });
    }

    if (reveal && nextStatus === 'accepted') {
      const contact = await maybeGetContact();
      return NextResponse.json({ data: { status: nextStatus, ...(contact ? { contact } : {}) }, error: null });
    }
    return NextResponse.json({ data: { status: nextStatus }, error: null });
  } catch (e) {
    await logError('api.match.respond', e, { stage: 'exception', uuid });
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}

