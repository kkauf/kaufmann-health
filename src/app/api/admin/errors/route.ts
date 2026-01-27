import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError } from '@/lib/logger';
import { parseQuery } from '@/lib/api-utils';
import { AdminErrorsQueryInput } from '@/contracts/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LogLevel = 'error' | 'warn' | 'info';

function isLogLevel(x: string): x is LogLevel {
  return x === 'error' || x === 'warn' || x === 'info';
}

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
    const parsed = parseQuery(AdminErrorsQueryInput, url.searchParams);
    if (!parsed.success) return parsed.response;

    const sinceHours = parsed.data.since_hours ?? 24;
    const source = (parsed.data.source || '').trim();
    const type = (parsed.data.type || '').trim();
    const limit = parsed.data.limit ?? 200;
    const levelsCsv = (parsed.data.levels || '').trim();
    const levelSingle = (parsed.data.level || '').trim();

    const sinceIso = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();

    let levels: LogLevel[] = [];
    if (levelsCsv) {
      levels = levelsCsv
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(isLogLevel);
    } else if (levelSingle) {
      const l = levelSingle.toLowerCase();
      if (isLogLevel(l)) levels = [l];
    }
    if (levels.length === 0) levels = ['error'];

    let query = supabaseServer
      .from('events')
      .select('id, level, type, properties, created_at, hashed_ip, user_agent')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (levels.length === 1) {
      query = query.eq('level', levels[0]);
    } else if (levels.length > 1) {
      query = query.in('level', levels);
    }

    if (source) {
      // Filter by JSON property properties.source
      query = query.contains('properties', { source });
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) {
      await logError('admin.api.errors', error, { stage: 'list_errors', sinceHours, source: source || undefined, type: type || undefined });
      return NextResponse.json({ data: null, error: 'Failed to load errors' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], error: null }, { status: 200 });
  } catch (e) {
    await logError('admin.api.errors', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
