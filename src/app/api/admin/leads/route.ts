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
    const statusParam = (url.searchParams.get('status') || 'new').trim();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);

    let query = supabaseServer
      .from('people')
      .select('id, name, email, phone_number, type, status, metadata, created_at')
      .eq('type', 'patient')
      .not('metadata', 'cs', { is_test: true })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statusParam && statusParam !== 'all') query = query.eq('status', statusParam);
    if (city) {
      // Case-insensitive partial match on city from JSON metadata
      query = query.ilike('metadata->>city', `%${city}%`);
    }
    // Session preference filter: support legacy single field and new array field.
    // We fetch first (bounded by limit) and filter in code to support OR logic across fields.

    const { data, error } = await query;
    if (error) {
      await logError('admin.api.leads', error, { stage: 'fetch' });
      return NextResponse.json({ data: null, error: 'Failed to fetch leads' }, { status: 500 });
    }
    // Map phone_number -> phone for UI backward compatibility
    type Row = { phone_number?: string | null; metadata?: unknown } & Record<string, unknown>;
    let result = ((data || []) as Row[]).map((r) => ({ ...r, phone: r.phone_number ?? null }));
    // Fallback filter: exclude E2E/test leads by metadata flag or recognizable patterns
    result = result.filter((r) => {
      try {
        const meta = (r?.metadata ?? {}) as Record<string, unknown>;
        if ((meta as any).is_test === true) return false;
        const email = String((r as any).email || '').trim();
        const name = String((r as any).name || '').trim();
        if (/^e2e-[a-z0-9]+@example\.com$/i.test(email)) return false;
        if (/^e2e\b/i.test(name)) return false;
      } catch {}
      return true;
    });
    if (sessionPref === 'online' || sessionPref === 'in_person') {
      result = result.filter((p) => {
        const meta = (p?.metadata ?? {}) as { session_preference?: 'online' | 'in_person'; session_preferences?: ('online' | 'in_person')[] };
        const arr = Array.isArray(meta.session_preferences) ? meta.session_preferences : [];
        return meta.session_preference === sessionPref || arr.includes(sessionPref);
      });
    }
    return NextResponse.json({ data: result, error: null });
  } catch (e) {
    await logError('admin.api.leads', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
