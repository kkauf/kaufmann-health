import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError } from '@/lib/logger';

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
      supabaseServer.from('people').select('id, type').eq('id', patient_id).single(),
      supabaseServer.from('people').select('id, type').eq('id', therapist_id).single(),
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

    return NextResponse.json({ data: { id: data?.id }, error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.matches', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}
