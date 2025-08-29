import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { renderPatientCustomUpdate, renderPatientMatchFound } from '@/lib/email/templates/patientUpdates';
import type { EmailContent } from '@/lib/email/types';

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

type Match = { id: string; patient_id: string; therapist_id: string };
type Person = {
  id: string;
  name?: string | null;
  email?: string | null;
  metadata?: { city?: string; issue?: string } | null;
};

type Body = {
  id?: string;
  template?: 'match_found' | 'custom';
  message?: string;
};

export async function POST(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }

  const id = String(body?.id || '').trim();
  const template = (body?.template || 'custom') as 'match_found' | 'custom';
  const customMessage = typeof body?.message === 'string' ? String(body.message).slice(0, 4000) : '';

  if (!id) {
    return NextResponse.json({ data: null, error: 'id is required' }, { status: 400 });
  }

  try {
    const { data: match, error: mErr } = await supabaseServer
      .from('matches')
      .select('id, patient_id, therapist_id')
      .eq('id', id)
      .single();

    if (mErr || !match) {
      await logError('admin.api.matches.email', mErr || new Error('not found'), { stage: 'load_match', id });
      return NextResponse.json({ data: null, error: 'Match not found' }, { status: 404 });
    }

    const m = match as Match;
    const ids = [m.patient_id, m.therapist_id];
    const { data: people, error: pErr } = await supabaseServer
      .from('people')
      .select('id, name, email, metadata')
      .in('id', ids);

    if (pErr) {
      await logError('admin.api.matches.email', pErr, { stage: 'load_people', id });
      return NextResponse.json({ data: null, error: 'Failed to load people' }, { status: 500 });
    }

    const persons = (people || []) as Person[];
    const byId = new Map<string, Person>();
    for (const p of persons) byId.set(String(p.id), p);

    const patient = byId.get(m.patient_id);
    const therapist = byId.get(m.therapist_id);

    const patientEmail = (patient?.email || '').trim();
    const patientName = (patient?.name || '') || null;

    if (!patientEmail) {
      return NextResponse.json({ data: null, error: 'Patient email missing' }, { status: 400 });
    }

    let content: EmailContent;

    if (template === 'match_found') {
      const therapistName = (therapist?.name || '') || null;
      // For MVP we skip specializations until stored/available consistently
      content = renderPatientMatchFound({ patientName: patientName, therapistName, specializations: [] });
    } else {
      content = renderPatientCustomUpdate({ patientName, message: customMessage });
    }

    // Await (client never throws; logs internally). Keep response predictable.
    await sendEmail({
      to: patientEmail,
      subject: content.subject,
      html: content.html,
      text: content.text,
      context: { kind: 'patient_update', template, match_id: m.id, patient_id: m.patient_id, therapist_id: m.therapist_id },
    });

    return NextResponse.json({ data: { ok: true }, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.matches.email', e, { stage: 'exception', id });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
