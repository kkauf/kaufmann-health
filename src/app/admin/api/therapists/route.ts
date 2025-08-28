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

export async function GET(req: Request) {
  const isAdmin = await assertAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const city = url.searchParams.get('city')?.trim() || undefined;
    const sessionPref = url.searchParams.get('session_preference') as 'online' | 'in_person' | null;
    // NOTE (future improvement): allow multiple specialization filters, e.g.
    //   /admin/api/therapists?specialization=narm&specialization=hakomi
    // and decide whether to match ANY vs ALL. For now we support a single
    // specialization value which is sufficient since the Admin UI shows all
    // specializations per therapist and filter UX is single-select.
    const specialization = url.searchParams.get('specialization')?.trim().toLowerCase() || undefined;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);

    let query = supabaseServer
      .from('people')
      .select('id, name, email, phone, type, status, metadata, created_at')
      .eq('type', 'therapist')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (city) {
      // Case-insensitive partial match on city stored in JSON metadata
      // Using ->> to extract text and ILIKE with wildcards for substring search.
      query = query.ilike('metadata->>city', `%${city}%`);
    }
    if (sessionPref === 'online' || sessionPref === 'in_person') {
      query = query.contains('metadata', { session_preference: sessionPref });
    }
    if (specialization) {
      // JSON containment: specializations array contains given value
      // TODO (future): support multiple values (OR / ANY) if provided.
      query = query.contains('metadata', { specializations: [specialization] });
    }

    const { data, error } = await query;
    if (error) {
      await logError('admin.api.therapists', error, { stage: 'fetch' });
      return NextResponse.json({ data: null, error: 'Failed to fetch therapists' }, { status: 500 });
    }
    return NextResponse.json({ data, error: null });
  } catch (e) {
    await logError('admin.api.therapists', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
