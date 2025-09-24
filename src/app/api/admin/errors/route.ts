import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { logError } from '@/lib/logger';

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
    const sinceHoursRaw = url.searchParams.get('since_hours') || '24';
    const source = (url.searchParams.get('source') || '').trim();
    const type = (url.searchParams.get('type') || '').trim();
    const limitRaw = url.searchParams.get('limit') || '200';
    const levelsCsv = (url.searchParams.get('levels') || '').trim();
    const levelSingle = (url.searchParams.get('level') || '').trim();

    let sinceHours = Number.parseInt(sinceHoursRaw, 10);
    if (!Number.isFinite(sinceHours) || sinceHours <= 0) sinceHours = 24;
    if (sinceHours > 720) sinceHours = 720; // cap at 30 days

    let limit = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 200;
    if (limit > 500) limit = 500;

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
      .select('id, level, type, properties, created_at')
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
