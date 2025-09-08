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

function normalizeSpec(v: string): string {
  // Canonicalize to a simple slug for robust matching
  return v
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[–—−]/g, '-') // normalize dash variants to hyphen
    .replace(/[_\s]+/g, '-') // spaces/underscores -> hyphen
    .replace(/[^a-z0-9-]/g, ''); // drop punctuation/symbols (e.g., ®)
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
    const status = (url.searchParams.get('status')?.trim() || 'pending_verification') as 'pending_verification' | 'verified' | 'rejected' | undefined;
    const sessionPref = url.searchParams.get('session_preference') as 'online' | 'in_person' | null;
    // Accept multiple specialization params: ?specialization=narm&specialization=hakomi
    // Match ANY of the provided values (OR). Backwards compatible with single value.
    const specializationParams = url.searchParams
      .getAll('specialization')
      .map((v) => normalizeSpec(v))
      .filter(Boolean);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 200);

    let query = supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, email, phone, city, session_preferences, modalities, status, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }
    if (city && sessionPref !== 'online') {
      // Case-insensitive partial match on city column
      query = query.ilike('city', `%${city}%`);
    }
    // Session preference filter: fetch first (bounded by limit) and filter in code to support OR logic.
    // Note: We intentionally avoid DB prefilter on modalities to allow normalization (spaces vs hyphens, etc.).

    const { data, error } = await query;
    if (error) {
      await logError('admin.api.therapists', error, { stage: 'fetch' });
      return NextResponse.json({ data: null, error: 'Failed to fetch therapists' }, { status: 500 });
    }
    // Normalize to existing shape expected by Admin UI
    type Row = {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      phone?: string | null;
      city?: string | null;
      session_preferences?: unknown;
      modalities?: unknown;
      created_at?: string | null;
    };
    let rows = (data || []) as Row[];

    if (sessionPref === 'online' || sessionPref === 'in_person') {
      const target = sessionPref;
      rows = rows.filter((r) => {
        const prefs = Array.isArray(r.session_preferences)
          ? (r.session_preferences as unknown[]).map((v) => String(v))
          : [];
        return prefs.includes(target);
      });
    }
    if (specializationParams.length > 0) {
      rows = rows.filter((r) => {
        const specs = Array.isArray(r.modalities)
          ? (r.modalities as unknown[]).map((v) => normalizeSpec(String(v)))
          : [];
        return specializationParams.some((s) => specs.includes(s));
      });
    }

    const result = rows.map((r) => {
      const name = [r.first_name || '', r.last_name || ''].join(' ').trim() || null;
      const metadata = {
        city: r.city || undefined,
        session_preferences: Array.isArray(r.session_preferences)
          ? (r.session_preferences as unknown[]).map((v) => (v === 'in_person' || v === 'online' ? v : String(v)))
          : [],
        specializations: Array.isArray(r.modalities)
          ? (r.modalities as unknown[]).map((v) => String(v))
          : [],
      } as const;
      return {
        id: r.id,
        name,
        email: r.email || null,
        phone: r.phone || null,
        status: (r as any).status || 'pending_verification',
        metadata,
        created_at: r.created_at || null,
      };
    });

    return NextResponse.json({ data: result, error: null });
  } catch (e) {
    await logError('admin.api.therapists', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
