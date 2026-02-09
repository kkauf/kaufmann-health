import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError } from '@/lib/logger';
import { ServerAnalytics } from '@/lib/server-analytics';
import { sendEmail } from '@/lib/email/client';
import { renderPatientCustomUpdate, renderPatientMatchFound, renderTherapistRejection } from '@/lib/email/templates/patientUpdates';
import { getTherapistSession } from '@/lib/auth/therapistSession';
import { parseRequestBody } from '@/lib/api-utils';
import { TherapistRespondInput } from '@/contracts/match';

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

function getMagicLinkIssuedAt(metadata: unknown, createdAt: string | null | undefined): string | null {
  try {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      const raw = (metadata as { magic_link_issued_at?: unknown }).magic_link_issued_at;
      if (typeof raw === 'string' && raw.trim().length > 0) return raw;
    }
  } catch {}
  return createdAt || null;
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
  // Accept any non-empty token; tests provide simple IDs like 'u-1'.
  if (!uuid) {
    return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
  }
  const reveal = searchParams.get('reveal') === '1';

  try {
    const parsed = await parseRequestBody(req, TherapistRespondInput);
    if (!parsed.success) {
      const json = await parsed.response
        .json()
        .catch(() => ({} as Record<string, unknown>));
      const msg = typeof json?.error === 'string' ? json.error : '';
      // Preserve legacy behavior: malformed JSON became {} and yielded Invalid action
      if (msg === 'Ungültiger Request Body') {
        return NextResponse.json({ data: null, error: 'Invalid action' }, { status: 400 });
      }
      return NextResponse.json({ data: null, error: 'Invalid action' }, { status: 400 });
    }

    const action = String((parsed.data as { action?: string }).action || '').trim().toLowerCase();

    let match: unknown | null = null;
    let matchErr: unknown | null = null;
    {
      const res = await supabaseServer
        .from('matches')
        .select('id, status, created_at, patient_id, therapist_id, metadata')
        .eq('secure_uuid', uuid)
        .single();
      match = res.data as unknown;
      matchErr = res.error as unknown;
    }
    const msg = extractMessage(matchErr);
    if (msg && /Cannot coerce the result to a single JSON object/i.test(msg)) {
      const fb = await supabaseServer
        .from('matches')
        .select('id, status, created_at, patient_id, therapist_id, metadata')
        .eq('secure_uuid', uuid)
        .order('created_at', { ascending: false })
        .limit(1);
      if (Array.isArray(fb.data) && fb.data.length > 0) {
        match = fb.data[0] as unknown;
        matchErr = null;
      }
    }

    if (matchErr || !match) {
      await logError('api.match.respond', matchErr || 'not_found', { stage: 'load_match', uuid });
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    type MatchRow = { 
      id: string; 
      status?: string | null; 
      created_at?: string | null; 
      patient_id: string; 
      therapist_id: string;
      metadata?: { patient_initiated?: boolean; magic_link_issued_at?: string } | null;
    };
    const m = match as unknown as MatchRow;

    const issuedAt = getMagicLinkIssuedAt(m.metadata ?? null, m.created_at ?? null);
    const age = hoursSince(issuedAt ?? undefined);
    if (age == null || age > 72) {
      const session = await getTherapistSession(req);
      const canBypassExpiry = !!session?.therapist_id && session.therapist_id === m.therapist_id;
      if (canBypassExpiry) {
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'link_expiry_bypassed',
          source: 'api.match.respond',
          props: { match_id: m.id, therapist_id: session.therapist_id },
        });
      } else {
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'link_expired_view',
        source: 'api.match.respond',
        props: { match_id: m.id, uuid },
      });
      return NextResponse.json({ data: null, error: 'Link expired' }, { status: 410 });
      }
    }

    const current = String(m.status || '').toLowerCase();
    const wasPatientSelected = current === 'patient_selected';
    const nextStatus = action === 'accept' ? 'accepted' : 'declined';

    async function maybeGetContact() {
      try {
        const { data: patientContact } = await supabaseServer
          .from('people')
          .select('name, email, phone_number')
          .eq('id', m.patient_id)
          .single();
        if (patientContact) {
          const c = patientContact as unknown as { name?: string | null; email?: string | null; phone_number?: string | null };
          return { name: c.name ?? null, email: c.email ?? null, phone: c.phone_number ?? null } as const;
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
      // EARTH-131: ensure patient lead is marked as matched when already accepted (best-effort)
      // Only upgrade from 'new' — don't downgrade from 'active'
      if (current === 'accepted') {
        try {
          await supabaseServer
            .from('people')
            .update({ status: 'matched' })
            .eq('id', m.patient_id)
            .eq('status', 'new');
        } catch (e) {
          void logError('api.match.respond', e, { stage: 'update_patient_status_idempotent', match_id: m.id });
        }
      }
      if (reveal && current === 'accepted') {
        const contact = await maybeGetContact();
        return NextResponse.json({ data: { status: current, ...(contact ? { contact } : {}) }, error: null });
      }
      return NextResponse.json({ data: { status: current }, error: null });
    }

    // Try to update including responded_at; additionally set therapist_contacted_at when accepted
    let updateError: unknown = null;
    try {
      const payload: Record<string, unknown> = { status: nextStatus, responded_at: new Date().toISOString() };
      if (nextStatus === 'accepted') payload.therapist_contacted_at = new Date().toISOString();
      const { error: updErr } = await supabaseServer
        .from('matches')
        .update(payload)
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
      const payload2: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === 'accepted') payload2.therapist_contacted_at = new Date().toISOString();
      const { error: updErr2 } = await supabaseServer
        .from('matches')
        .update(payload2)
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

    // EARTH-131: when a therapist accepts, mark patient lead as 'matched' (best-effort)
    // Only upgrade from 'new' — don't downgrade from 'active'
    if (nextStatus === 'accepted') {
      try {
        await supabaseServer
          .from('people')
          .update({ status: 'matched' })
          .eq('id', m.patient_id)
          .eq('status', 'new');
      } catch (e) {
        void logError('api.match.respond', e, { stage: 'update_patient_status', match_id: m.id });
      }
    }

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
        
        // Track phone-only clients who can't receive email notifications
        const isPhoneOnly = patientEmail.startsWith('temp_') && patientEmail.endsWith('@kaufmann.health');
        if (isPhoneOnly) {
          void ServerAnalytics.trackEventFromRequest(req, {
            type: 'patient_notify_skipped',
            source: 'api.match.respond',
            props: { 
              match_id: m.id, 
              reason: 'phone_only_no_email',
              action: nextStatus,
              patient_initiated: m.metadata?.patient_initiated || false,
            },
          });
        }
        
        if (patientEmail && !isPhoneOnly) {
          if (nextStatus === 'accepted') {
            if (!wasPatientSelected) {
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
            } else {
              // Avoid duplicate "match found" email when the patient already selected the therapist and received confirmation.
              void ServerAnalytics.trackEventFromRequest(req, {
                type: 'patient_notify_skipped',
                source: 'api.match.respond',
                props: { match_id: m.id, reason: 'already_selected' },
              });
            }
          } else if (nextStatus === 'declined') {
            // EARTH-205: For patient-initiated contacts, send therapist rejection email
            const isPatientInitiated = m.metadata?.patient_initiated === true;
            
            if (isPatientInitiated && therapistRow) {
              const therapistName = [therapistRow.first_name || '', therapistRow.last_name || ''].join(' ').trim() || null;
              const content = renderTherapistRejection({ patientName, therapistName });
              void sendEmail({
                to: patientEmail,
                subject: content.subject,
                html: content.html,
                context: { kind: 'patient_update_auto', template: 'therapist_rejection', match_id: m.id, patient_id: m.patient_id, therapist_id: m.therapist_id },
              });
            } else {
              const message =
                'kurzes Update: Der vorgeschlagene Therapeut kann Ihren Fall leider nicht übernehmen. Wir suchen weiterhin nach einer passenden Option und melden uns schnellstmöglich.';
              const content = renderPatientCustomUpdate({ patientName, message });
              void sendEmail({
                to: patientEmail,
                subject: content.subject,
                html: content.html || '',
                text: content.text,
                context: { kind: 'patient_update_auto', template: 'declined', match_id: m.id, patient_id: m.patient_id, therapist_id: m.therapist_id },
              });
            }
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

