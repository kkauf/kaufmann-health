import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError, track } from '@/lib/logger';
import { createInstantMatchesForPatient } from '@/features/leads/lib/match';

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

type RebuildBody = {
  patient_id: string;
  delete_existing?: boolean; // Default: true - delete existing empty/no-match records
  send_notification?: boolean; // Default: false - send apology email after rebuild
};

/**
 * POST /api/admin/matches/rebuild
 * 
 * Rebuilds matches for a patient using the production matching algorithm.
 * Useful for recovering from matching bugs or re-matching after therapist changes.
 * 
 * Body:
 *   - patient_id: string (required)
 *   - delete_existing: boolean (default true) - delete empty match records first
 *   - send_notification: boolean (default false) - send apology notification after rebuild
 * 
 * Returns:
 *   - matchesUrl: string - URL to the matches page
 *   - matchQuality: 'exact' | 'partial' | 'none'
 *   - therapistCount: number - number of matches created
 */
export async function POST(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  let body: RebuildBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }

  const patientId = String(body?.patient_id || '').trim();
  if (!patientId) {
    return NextResponse.json({ data: null, error: 'patient_id is required' }, { status: 400 });
  }

  const deleteExisting = body.delete_existing !== false;
  const sendNotification = body.send_notification === true;

  try {
    // Verify patient exists
    const { data: patient, error: pErr } = await supabaseServer
      .from('people')
      .select('id, name, metadata')
      .eq('id', patientId)
      .single();

    if (pErr || !patient) {
      return NextResponse.json({ data: null, error: 'Patient not found' }, { status: 404 });
    }

    // Delete existing empty/no-match records if requested
    if (deleteExisting) {
      const { error: deleteErr, count } = await supabaseServer
        .from('matches')
        .delete()
        .eq('patient_id', patientId)
        .is('therapist_id', null);

      if (deleteErr) {
        await logError('admin.api.matches.rebuild', deleteErr, { stage: 'delete_empty', patientId });
      } else {
        void track({
          type: 'matches_rebuild_deleted_empty',
          level: 'info',
          source: 'admin.api.matches.rebuild',
          props: { patient_id: patientId, count: count ?? 0 },
        });
      }
    }

    // Call the production matching algorithm
    const meta = (patient.metadata || {}) as Record<string, unknown>;
    const result = await createInstantMatchesForPatient(patientId, undefined, meta);

    if (!result) {
      await logError('admin.api.matches.rebuild', new Error('Matching returned null'), { patientId });
      return NextResponse.json({ data: null, error: 'Matching failed' }, { status: 500 });
    }

    // Get count of created matches
    const { count: therapistCount } = await supabaseServer
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', patientId)
      .not('therapist_id', 'is', null);

    void track({
      type: 'matches_rebuilt',
      level: 'info',
      source: 'admin.api.matches.rebuild',
      props: {
        patient_id: patientId,
        match_quality: result.matchQuality,
        therapist_count: therapistCount ?? 0,
      },
    });

    // Optionally send apology notification
    if (sendNotification && result.matchesUrl) {
      // Trigger apology email via internal call (fire-and-forget)
      try {
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'http://localhost:3000';
        
        void fetch(`${baseUrl}/api/admin/matches/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': req.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            template: 'apology',
            patient_id: patientId,
          }),
        });
      } catch {
        // Non-fatal - matches were still rebuilt
      }
    }

    return NextResponse.json({
      data: {
        matchesUrl: result.matchesUrl,
        matchQuality: result.matchQuality,
        therapistCount: therapistCount ?? 0,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.api.matches.rebuild', e, { patientId });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
