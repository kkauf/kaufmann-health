import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderTherapistNotification } from '@/lib/email/templates/therapistNotification';
import { BASE_URL } from '@/lib/constants';
import { ServerAnalytics } from '@/lib/server-analytics';
import { computeMismatches } from '@/lib/leads/match';

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
  'accepted',
  'declined',
  'therapist_contacted',
  'therapist_responded',
  'session_booked',
  'completed',
  'failed',
  // New status used by patient selection flow (EARTH-125)
  'patient_selected',
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
  phone?: string | null;
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

    const patientIds = Array.from(new Set(rows.map((r) => String(r.patient_id))));
    const therapistIds = Array.from(new Set(rows.map((r) => String(r.therapist_id))));

    const [{ data: people, error: pErr }, { data: therapists, error: tErr }] = await Promise.all([
      supabaseServer.from('people').select('id, name, email, phone, metadata').in('id', patientIds),
      supabaseServer.from('therapists').select('id, first_name, last_name, email, phone').in('id', therapistIds),
    ]);

    if (pErr || tErr) {
      await logError('admin.api.matches', pErr || tErr, { stage: 'load_entities' });
      return NextResponse.json({ data: null, error: 'Failed to load related entities' }, { status: 500 });
    }

    const persons = (people || []) as PersonRow[];
    const therapistRows = (therapists || []) as Array<{ id: string; first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null }>;
    const patientsById = new Map<string, PersonRow>();
    for (const p of persons) patientsById.set(p.id, p);
    const therapistsById = new Map<string, { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null }>();
    for (const t of therapistRows) therapistsById.set(t.id, t);

    const data = rows.map((r: MatchRow) => {
      const patient = patientsById.get(r.patient_id) || null;
      const therapist = therapistsById.get(r.therapist_id) || null;
      const city = typeof patient?.metadata?.city === 'string' ? patient.metadata.city : undefined;
      const issue = typeof patient?.metadata?.issue === 'string' ? patient.metadata.issue : undefined;
      return {
        id: r.id,
        status: r.status || 'proposed',
        notes: r.notes || '',
        created_at: r.created_at,
        patient: patient
          ? { id: patient.id, name: patient.name || '', email: patient.email || '', phone: patient.phone || '', city, issue }
          : { id: r.patient_id, name: '', email: '', phone: '', city, issue },
        therapist: therapist
          ? {
              id: therapist.id,
              name: [therapist.first_name || '', therapist.last_name || ''].join(' ').trim(),
              email: therapist.email || '',
              phone: therapist.phone || '',
            }
          : { id: r.therapist_id, name: '', email: '', phone: '' },
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
      if (status === 'accepted' || status === 'declined') update['therapist_responded_at'] = nowIso;
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
    const therapist_id_single = typeof body?.therapist_id === 'string' ? String(body.therapist_id).trim() : '';
    const therapist_ids_array: string[] = Array.isArray(body?.therapist_ids) ? (body.therapist_ids as unknown[]).map((v) => String(v).trim()).filter(Boolean) : [];
    const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 2000) : undefined;
    const suppress_outreach: boolean = Boolean((body as Record<string, unknown> | null | undefined)?.['suppress_outreach']);

    if (!patient_id) {
      return NextResponse.json({ data: null, error: 'patient_id is required' }, { status: 400 });
    }
    const therapist_ids: string[] = therapist_ids_array.length > 0 ? therapist_ids_array : (therapist_id_single ? [therapist_id_single] : []);
    if (therapist_ids.length === 0) {
      return NextResponse.json({ data: null, error: 'therapist_id or therapist_ids is required' }, { status: 400 });
    }
    if (therapist_ids.length > 3) {
      return NextResponse.json({ data: null, error: 'Maximum of 3 therapists allowed' }, { status: 400 });
    }

    // Validate entities exist with expected types
    const [{ data: patient, error: patientErr }] = await Promise.all([
      supabaseServer.from('people').select('id, type, metadata').eq('id', patient_id).single(),
    ]);
    if (patientErr) {
      await logError('admin.api.matches', patientErr, { stage: 'load_patient', patient_id });
      return NextResponse.json({ data: null, error: 'Failed to verify patient' }, { status: 500 });
    }
    if (!patient || patient.type !== 'patient') {
      return NextResponse.json({ data: null, error: 'Invalid patient_id' }, { status: 400 });
    }

    // Load all therapists (keep columns minimal). Use eq when only one id to match existing test stubs.
    type TherapistBasic = { id: string; first_name?: string | null; last_name?: string | null; email?: string | null };
    let therapistsList: TherapistBasic[] | null = null;
    let tErr: unknown = null;
    try {
      if (therapist_ids.length === 1) {
        const { data, error } = await supabaseServer
          .from('therapists')
          .select('id, first_name, last_name, email')
          .eq('id', therapist_ids[0])
          .single();
        tErr = error;
        therapistsList = data ? [data as TherapistBasic] : [];
      } else {
        const { data, error } = await supabaseServer
          .from('therapists')
          .select('id, first_name, last_name, email')
          .in('id', therapist_ids);
        tErr = error;
        therapistsList = (data as TherapistBasic[]) || [];
      }
    } catch (e) {
      tErr = e;
    }
    if (tErr) {
      await logError('admin.api.matches', tErr, { stage: 'load_therapists', therapist_ids });
      return NextResponse.json({ data: null, error: 'Failed to verify therapists' }, { status: 500 });
    }
    const therapistsById = new Map<string, TherapistBasic>();
    for (const t of therapistsList || []) therapistsById.set(String(t.id), t);
    for (const id of therapist_ids) {
      if (!therapistsById.has(id)) {
        return NextResponse.json({ data: null, error: `Invalid therapist_id: ${id}` }, { status: 400 });
      }
    }

    // Fetch additional details for mismatch logging (best-effort)
    type TherapistDetails = { id: string; gender?: string | null; modalities?: unknown; session_preferences?: unknown };
    const detailsById = new Map<string, TherapistDetails>();
    try {
      if (therapist_ids.length === 1) {
        const { data } = await supabaseServer
          .from('therapists')
          .select('id, gender, modalities, session_preferences')
          .eq('id', therapist_ids[0])
          .single();
        if (data) {
          const d = data as TherapistDetails;
          detailsById.set(String(d.id), d);
        }
      } else {
        const { data } = await supabaseServer
          .from('therapists')
          .select('id, gender, modalities, session_preferences')
          .in('id', therapist_ids);
        const arr = (data as TherapistDetails[]) || [];
        for (const d of arr) detailsById.set(String(d.id), d);
      }
    } catch {
      // ignore
    }

    // Insert matches and enqueue outreach per therapist
    const created: string[] = [];
    for (const tid of therapist_ids) {
      const { data, error } = await supabaseServer
        .from('matches')
        .insert({ patient_id, therapist_id: tid, status: 'proposed', notes })
        .select('id')
        .single();

      if (error) {
        await logError('admin.api.matches', error, { stage: 'insert', patient_id, therapist_id: tid });
        continue; // proceed with others
      }

      const matchId = (data as { id: string }).id;
      created.push(matchId);

      // Outreach with magic link (best-effort) unless suppressed (used by selection flow)
      if (!suppress_outreach) {
        try {
          // secure_uuid lookup
          let secure_uuid: string | undefined;
          try {
            const { data: matchRow } = await supabaseServer
              .from('matches')
              .select('secure_uuid, created_at')
              .eq('id', matchId)
              .single();
            const mr = matchRow as { secure_uuid?: string | null } | null;
            if (mr && typeof mr.secure_uuid === 'string') secure_uuid = mr.secure_uuid;
          } catch {}
          const magicUrl = secure_uuid ? `${BASE_URL}/match/${secure_uuid}` : undefined;
          const t = therapistsById.get(tid) as { email?: string | null; first_name?: string | null; last_name?: string | null } | undefined;
          const p = patient as { metadata?: { city?: string; issue?: string } | null };
          const therapistEmail = (t?.email || '').trim();
          const therapistName = [t?.first_name || '', t?.last_name || ''].join(' ').trim() || undefined;
          const city = typeof p?.metadata?.city === 'string' ? p.metadata!.city : undefined;
          const issue = typeof p?.metadata?.issue === 'string' ? p.metadata!.issue : undefined;

          if (magicUrl && therapistEmail) {
            const content = renderTherapistNotification({ type: 'outreach', therapistName, patientCity: city, patientIssue: issue, magicUrl, expiresHours: 72 });
            void sendEmail({ to: therapistEmail, subject: content.subject, html: content.html, context: { kind: 'therapist_outreach', match_id: matchId, patient_id, therapist_id: tid } });
            void ServerAnalytics.trackEventFromRequest(req, { type: 'match_outreach_enqueued', source: 'admin.api.matches', props: { match_id: matchId, patient_id, therapist_id: tid } });
          } else {
            void ServerAnalytics.trackEventFromRequest(req, { type: 'match_outreach_skipped_no_secure_uuid', source: 'admin.api.matches', props: { match_id: matchId, patient_id, therapist_id: tid } });
          }
        } catch (e) {
          void logError('admin.api.matches', e, { stage: 'email_outreach_enqueue', patient_id, therapist_id: tid });
        }
      }

      // Business opportunity logging (best-effort)
      try {
        type PatientMetaServer = {
          city?: string;
          session_preference?: 'online' | 'in_person';
          session_preferences?: ('online' | 'in_person')[];
          issue?: string;
          specializations?: string[];
          gender_preference?: 'male' | 'female' | 'no_preference';
        };
        type PatientRow = { metadata?: PatientMetaServer | null };
        const pMeta: PatientMetaServer = ((patient as PatientRow)?.metadata) || {};
        const tRow: TherapistDetails = (detailsById.get(tid) || { id: tid });
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
            id: tid,
            gender: tRow.gender || null,
            city: undefined,
            session_preferences: Array.isArray(tRow.session_preferences) ? (tRow.session_preferences as string[]) : [],
            modalities: Array.isArray(tRow.modalities) ? (tRow.modalities as string[]) : [],
          }
        );
        const reasons = mm.reasons; // ['gender','location','modality'] subset
        if (reasons.length > 0) {
          type BusinessOpportunityInsert = { patient_id: string; mismatch_type: 'gender' | 'location' | 'modality'; city?: string | null };
          const rows: BusinessOpportunityInsert[] = reasons.map((r) => ({ patient_id, mismatch_type: r as 'gender' | 'location' | 'modality', city: typeof pMeta.city === 'string' ? pMeta.city : null }));
          // Insert; ignore failures
          await supabaseServer.from('business_opportunities').insert(rows).select('id').limit(1).maybeSingle();
          void ServerAnalytics.trackEventFromRequest(req, { type: 'business_opportunity_logged', source: 'admin.api.matches', props: { patient_id, reasons } });
        }
      } catch (e) {
        void logError('admin.api.matches', e, { stage: 'log_business_opportunity', patient_id, therapist_id: tid });
      }
    }

    if (created.length === 0) {
      return NextResponse.json({ data: null, error: 'No matches created' }, { status: 500 });
    }

    // Backward compatibility: if only one match created, return single id shape
    if (created.length === 1) {
      return NextResponse.json({ data: { id: created[0] }, error: null }, { status: 200 });
    }
    return NextResponse.json({ data: { ids: created }, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.matches', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
