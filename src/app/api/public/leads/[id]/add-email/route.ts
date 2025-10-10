import { supabaseServer } from '@/lib/supabase-server';
import { safeJson } from '@/lib/http';
import { logError } from '@/lib/logger';
import { sanitize } from '@/features/leads/lib/validation';
import { getClientSession } from '@/lib/auth/clientSession';

export const runtime = 'nodejs';

function getIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const leadsIdx = parts.indexOf('leads');
    if (leadsIdx >= 0 && parts.length > leadsIdx + 1) {
      return decodeURIComponent(parts[leadsIdx + 1]);
    }
    return null;
  } catch {
    return null;
  }
}

export async function PATCH(req: Request) {
  const id = getIdFromUrl(req.url);
  if (!id) return safeJson({ data: null, error: 'Missing id' }, { status: 400 });

  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; form_session_id?: string };
    const email = sanitize(body.email)?.toLowerCase();
    const formSessionId = typeof body.form_session_id === 'string' ? body.form_session_id : undefined;

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return safeJson({ data: null, error: 'Invalid email' }, { status: 400 });
    }

    // Authorization: require kh_client session matching id OR matching form_session_id on person
    let authorized = false;
    try {
      const session = await getClientSession(req);
      if (session && session.patient_id === id) authorized = true;
    } catch {}

    type PersonRow = { id: string; type?: string | null; status?: string | null; metadata?: Record<string, unknown> | null };
    let person: PersonRow | null = null;
    try {
      const { data: p } = await supabaseServer
        .from('people')
        .select('id,type,status,metadata')
        .eq('id', id)
        .single<PersonRow>();
      person = (p as PersonRow) ?? null;
    } catch {}

    if (!person || (person.type || '').toLowerCase() !== 'patient') {
      return safeJson({ data: null, error: 'Not found' }, { status: 404 });
    }

    if (!authorized && formSessionId) {
      const fsid = typeof (person.metadata || {})['form_session_id'] === 'string' ? String((person.metadata as Record<string, unknown>)['form_session_id']) : '';
      if (fsid && fsid === formSessionId) authorized = true;
    }

    if (!authorized) {
      // Privacy: do not reveal authorization failures (treat as success)
      return safeJson({ data: { ok: true }, error: null });
    }

    // Update email; do not require email confirmation for phone-verified/new leads
    // Add timestamp for ops visibility
    const metadata = { ...(person.metadata || {}), email_added_at: new Date().toISOString() } as Record<string, unknown>;

    const { error: upErr } = await supabaseServer
      .from('people')
      .update({ email, metadata })
      .eq('id', id);

    // Unique violation
    if ((upErr as { code?: string } | null | undefined)?.code === '23505') {
      return safeJson({ data: null, error: 'email_in_use' }, { status: 409 });
    }

    if (upErr) {
      await logError('api.leads.add_email', upErr, { id });
      return safeJson({ data: null, error: 'Failed to update' }, { status: 500 });
    }

    return safeJson({ data: { ok: true }, error: null });
  } catch (e) {
    await logError('api.leads.add_email', e, { stage: 'unhandled' });
    return safeJson({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
