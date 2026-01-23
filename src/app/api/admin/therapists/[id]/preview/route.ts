import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { mapTherapistRow, parseTherapistRow, THERAPIST_SELECT_COLUMNS } from '@/lib/therapist-mapper';

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

/**
 * GET /api/admin/therapists/[id]/preview
 *
 * Returns the full TherapistData for preview in admin panel.
 * This is the same data structure used by the public profile page,
 * allowing admin to see exactly what users will see.
 *
 * Unlike public endpoints, this doesn't require status='verified'
 * so admin can preview profiles before they're live.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // Check admin auth
  const isAdmin = await assertAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const { data, error } = await supabaseServer
    .from('therapists')
    .select(`${THERAPIST_SELECT_COLUMNS}, slug`)
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Therapist not found' },
      { status: 404 }
    );
  }

  const row = parseTherapistRow(data);
  const therapist = mapTherapistRow(row);

  // Include slug for profile link
  if (data.slug) {
    therapist.slug = data.slug;
  }

  return NextResponse.json({ data: therapist });
}
