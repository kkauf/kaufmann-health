import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistOutreach } from '@/lib/email/templates/therapistOutreach';
import { BASE_URL } from '@/lib/constants';
import { ServerAnalytics } from '@/lib/server-analytics';

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

const ALLOWED_STATUSES = new Set([
  'proposed',
  'therapist_contacted',
  'therapist_responded',
  'session_booked',
  'completed',
  'failed',
]);

type MatchRow = {
  id: string;
  patient_id: string;
  therapist_id: string;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type PersonRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  metadata?: { city?: string; issue?: string } | null;
};

export async function GET(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch matches, newest first. Select only columns guaranteed to exist.
    const { data: matches, error: mErr } = await supabaseServer
      .from('matches')
      .select('id, patient_id, therapist_id, status, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (mErr) {
      await logError('admin.api.matches', mErr, { stage: 'list_matches' });
      return NextResponse.json({ data: null, error: 'Failed to load matches' }, { status: 500 });
    }

    const rows = (matches || []) as MatchRow[];
    if (rows.length === 0) {
      return NextResponse.json({ data: [], error: null }, { status: 200 });
    }

    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(String(r.patient_id));
      ids.add(String(r.therapist_id));
    }

    const { data: people, error: pErr } = await supabaseServer
      .from('people')
      .select('id, name, email, metadata')
      .in('id', Array.from(ids));

    if (pErr) {
      await logError('admin.api.matches', pErr, { stage: 'load_people' });
      return NextResponse.json({ data: null, error: 'Failed to load people' }, { status: 500 });
    }

    const persons = (people || []) as PersonRow[];
    const byId = new Map<string, PersonRow>();
    for (const p of persons) byId.set(p.id, p);

    const data = rows.map((r: MatchRow) => {
      const patient = byId.get(r.patient_id) || null;
      const therapist = byId.get(r.therapist_id) || null;
      const city = typeof patient?.metadata?.city === 'string' ? patient.metadata.city : undefined;
      const issue = typeof patient?.metadata?.issue === 'string' ? patient.metadata.issue : undefined;
      return {
        id: r.id,
        status: r.status || 'proposed',
        notes: r.notes || '',
        created_at: r.created_at,
        patient: patient
          ? { id: patient.id, name: patient.name || '', email: patient.email || '', city, issue }
          : { id: r.patient_id, name: '', email: '', city, issue },
        therapist: therapist
          ? { id: therapist.id, name: therapist.name || '', email: therapist.email || '' }
          : { id: r.therapist_id, name: '', email: '' },
      } as const;
    });

    return NextResponse.json({ data, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.matches', e, { stage: 'exception_list' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = String(body?.id || '').trim();
    const status: string | undefined = body?.status ? String(body.status) : undefined;
    const notes: string | undefined = typeof body?.notes === 'string' ? String(body.notes).slice(0, 2000) : undefined;

    if (!id) {
      return NextResponse.json({ data: null, error: 'id is required' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (typeof status === 'string') {
      if (!ALLOWED_STATUSES.has(status)) {
        return NextResponse.json({ data: null, error: 'Invalid status' }, { status: 400 });
      }
      update.status = status;
      // Attempt to write helpful timestamps when specific statuses are set.
      const nowIso = new Date().toISOString();
      if (status === 'therapist_contacted') update['therapist_contacted_at'] = nowIso;
      if (status === 'therapist_responded') update['therapist_responded_at'] = nowIso;
      if (status === 'session_booked' || status === 'completed') update['patient_confirmed_at'] = nowIso;
    }
    if (typeof notes === 'string') update.notes = notes;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ data: null, error: 'No changes' }, { status: 400 });
    }

    const doUpdate = async (payload: Record<string, unknown>) =>
      supabaseServer.from('matches').update(payload).eq('id', id);

    // Try update with progressive fallback removing columns that don't exist
    const payload: Record<string, unknown> = { ...update };
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const attemptPayload = { ...payload };
      const { error } = await doUpdate(attemptPayload);
      if (!error) {
        return NextResponse.json({ data: { id, status, notes }, error: null }, { status: 200 });
      }
      lastError = error;
      const msg = error?.message || '';
      if (msg.includes('does not exist') || msg.includes('Could not find') || (msg.includes('column') && msg.includes('matches'))) {
        // Remove any fields referenced in the error msg
        const keysBefore = Object.keys(payload);
        for (const key of keysBefore) {
          if (msg.includes(key)) delete payload[key];
        }
        // If we couldn't detect exact key, drop known optional timestamp columns
        if (Object.keys(payload).length === keysBefore.length) {
          for (const k of ['therapist_contacted_at', 'therapist_responded_at', 'patient_confirmed_at']) {
            if (k in payload) delete payload[k];
          }
        }
        if (Object.keys(payload).length === 0) {
          await logError('admin.api.matches', error, { stage: 'update_missing_columns', id });
          return NextResponse.json(
            { data: null, error: 'No updatable columns found (DB columns missing). Please apply latest migrations.' },
            { status: 400 }
          );
        }
        continue; // retry with reduced payload
      }
      break; // non-missing-column error
    }

    await logError('admin.api.matches', lastError, { stage: 'update', id });
    return NextResponse.json({ data: null, error: 'Failed to update' }, { status: 500 });
  } catch (e) {
    await logError('admin.api.matches', e, { stage: 'exception_update' });
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const patient_id = String(body?.patient_id || '').trim();
    const therapist_id = String(body?.therapist_id || '').trim();
    const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 2000) : undefined;

    if (!patient_id || !therapist_id) {
      return NextResponse.json({ data: null, error: 'patient_id and therapist_id are required' }, { status: 400 });
    }

    // Validate entities exist with expected types
    const [{ data: patient, error: patientErr }, { data: therapist, error: therapistErr }] = await Promise.all([
      supabaseServer.from('people').select('id, type, metadata').eq('id', patient_id).single(),
      supabaseServer.from('people').select('id, type, email, name').eq('id', therapist_id).single(),
    ]);
    if (patientErr || therapistErr) {
      await logError('admin.api.matches', patientErr || therapistErr, { stage: 'load_entities', patient_id, therapist_id });
      return NextResponse.json({ data: null, error: 'Failed to verify entities' }, { status: 500 });
    }
    if (!patient || patient.type !== 'patient') {
      return NextResponse.json({ data: null, error: 'Invalid patient_id' }, { status: 400 });
    }
    if (!therapist || therapist.type !== 'therapist') {
      return NextResponse.json({ data: null, error: 'Invalid therapist_id' }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('matches')
      .insert({ patient_id, therapist_id, status: 'proposed', notes })
      .select('id')
      .single();

    if (error) {
      await logError('admin.api.matches', error, { stage: 'insert', patient_id, therapist_id });
      return NextResponse.json({ data: null, error: 'Failed to create match' }, { status: 500 });
    }

    // Fire-and-forget therapist outreach email with magic link
    try {
      type MatchRow = { id: string };
      type MatchDetail = { secure_uuid?: string | null; created_at?: string | null };
      type PatientRow = { metadata?: { city?: string; issue?: string } | null };
      type TherapistRow = { email?: string | null; name?: string | null };

      const matchId = (data as MatchRow).id;
      // Fetch secure_uuid separately to remain compatible before the migration lands
      let secure_uuid: string | undefined;
      try {
        const { data: matchRow, error: matchErr } = await supabaseServer
          .from('matches')
          .select('secure_uuid, created_at')
          .eq('id', matchId)
          .single();
        const mr = matchRow as unknown as MatchDetail | null;
        if (!matchErr && mr && typeof mr.secure_uuid === 'string') {
          secure_uuid = mr.secure_uuid;
        }
      } catch {
        // ignore
      }
      const magicUrl = secure_uuid ? `${BASE_URL}/match/${secure_uuid}` : undefined;
      const t = therapist as unknown as TherapistRow | null;
      const p = patient as unknown as PatientRow | null;
      const therapistEmail = typeof t?.email === 'string' ? t.email.trim() : '';
      const therapistName = typeof t?.name === 'string' ? t.name : undefined;
      const city = typeof p?.metadata?.city === 'string' ? p.metadata.city : undefined;
      const issue = typeof p?.metadata?.issue === 'string' ? p.metadata.issue : undefined;

      if (magicUrl && therapistEmail) {
        const content = renderTherapistOutreach({
          therapistName,
          city,
          issueCategory: issue,
          magicUrl,
          expiresHours: 72,
        });
        // Do not await; email client handles retries and logs internally
        void sendEmail({
          to: therapistEmail,
          subject: content.subject,
          html: content.html,
          context: { kind: 'therapist_outreach', match_id: matchId, patient_id, therapist_id },
        });

        // Analytics: enqueue event tied to the admin request (PII-free)
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'match_outreach_enqueued',
          source: 'admin.api.matches',
          props: { match_id: matchId, patient_id, therapist_id },
        });
      } else {
        // Missing secure_uuid or therapist email: skip for now (pre-migration) and log
        void ServerAnalytics.trackEventFromRequest(req, {
          type: 'match_outreach_skipped_no_secure_uuid',
          source: 'admin.api.matches',
          props: { match_id: matchId, patient_id, therapist_id },
        });
      }
    } catch (e) {
      // Never block creation flow
      void logError('admin.api.matches', e, { stage: 'email_outreach_enqueue', patient_id, therapist_id });
    }

    return NextResponse.json({ data: { id: data?.id }, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.matches', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
