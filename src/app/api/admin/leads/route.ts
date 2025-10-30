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

    // Helper to build the base query with selectable columns to support schema fallbacks
    const buildQuery = (selectCols: string) => {
      let q = supabaseServer
        .from('people')
        .select(selectCols)
        .eq('type', 'patient')
        .or('metadata->>is_test.is.null,metadata->>is_test.eq.false')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (statusParam && statusParam !== 'all') q = q.eq('status', statusParam);
      if (city) {
        // Case-insensitive partial match on city from JSON metadata
        q = q.ilike('metadata->>city', `%${city}%`);
      }
      return q;
    };

    // Try selecting with phone_number (new schema). If the column doesn't exist, fallback to legacy phone.
    let data: unknown[] | null = null;
    let fetchError: unknown = null;
    const first = await buildQuery('id, name, email, phone_number, type, status, metadata, created_at');
    if (first.error) {
      const msg = String(first.error?.message || '');
      if (/column\s+"?phone_number"?\s+does not exist/i.test(msg)) {
        const second = await buildQuery('id, name, email, phone, type, status, metadata, created_at');
        if (second.error) {
          fetchError = second.error;
        } else {
          data = (second.data || []) as unknown[];
        }
      } else {
        fetchError = first.error;
      }
    } else {
      data = (first.data || []) as unknown[];
    }

    if (fetchError) {
      await logError('admin.api.leads', fetchError, { stage: 'fetch' });
      return NextResponse.json({ data: null, error: 'Failed to fetch leads' }, { status: 500 });
    }

    // Map phone_number/phone -> phone for UI backward compatibility
    type Row = { phone_number?: string | null; phone?: string | null; metadata?: unknown } & Record<string, unknown>;
    let result = ((data || []) as Row[]).map((r) => ({ ...r, phone: (r.phone_number ?? r.phone ?? null) }));
    // Fallback filter: exclude E2E/test leads by metadata flag or recognizable patterns
    result = result.filter((r) => {
      try {
        const meta = (r?.metadata ?? {}) as Record<string, unknown>;
        const isTestVal: unknown = meta ? (meta as Record<string, unknown>)['is_test'] : undefined;
        if (isTestVal === true) return false;
        const email = String(((r as Record<string, unknown>)['email'] as string | undefined) || '').trim();
        const name = String(((r as Record<string, unknown>)['name'] as string | undefined) || '').trim();
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
