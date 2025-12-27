/**
 * Admin Alert: User-Facing Errors
 * 
 * Returns recent user-facing errors (auth failures, API errors, network issues)
 * from the events table for monitoring and debugging.
 * 
 * GET /api/admin/alerts/user-errors?hours=24
 * 
 * Response includes:
 * - Summary counts by error type
 * - Recent individual errors with context
 * - Affected pages
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/lib/auth/adminSession';
import { isCronAuthorized as isCronAuthorizedShared } from '@/lib/cron-auth';
import { AdminUserErrorsInput } from '@/contracts/admin';
import { parseQuery } from '@/lib/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  for (const part of header.split(';')) {
    const [k, v] = part.trim().split('=');
    if (k && typeof v === 'string') map.set(k, decodeURIComponent(v));
  }
  return map;
}

async function assertAdmin(req: Request): Promise<boolean> {
  try {
    const token = parseCookie(req.headers.get('cookie')).get(ADMIN_SESSION_COOKIE);
    return token ? await verifySessionToken(token) : false;
  } catch {
    return false;
  }
}

function isCronAuthorized(req: Request): boolean {
  return isCronAuthorizedShared(req);
}

type ErrorEvent = {
  id: string;
  created_at: string;
  properties: {
    error_type?: string;
    status?: number;
    url?: string;
    message?: string;
    page_path?: string;
    session_id?: string;
    user_agent?: string;
  } | null;
};

export async function GET(req: Request) {
  const isAdmin = await assertAdmin(req);
  const isCron = isCronAuthorized(req);
  
  if (!isAdmin && !isCron) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(req.url);

    const parsed = parseQuery(AdminUserErrorsInput, url.searchParams);
    if (!parsed.success) return parsed.response;

    const hours = parsed.data.hours ?? 24;
    const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseServer
      .from('events')
      .select('id, created_at, properties')
      .eq('type', 'user_facing_error')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ data: null, error: 'Database error' }, { status: 500 });
    }

    const events = (data || []) as ErrorEvent[];

    // Aggregate by error type
    const byType: Record<string, number> = {};
    const byUrl: Record<string, number> = {};
    const byPage: Record<string, number> = {};
    const authErrors: ErrorEvent[] = [];
    
    for (const e of events) {
      const props = e.properties || {};
      const errorType = props.error_type || 'unknown';
      const apiUrl = props.url || props.page_path || 'unknown';
      const pagePath = props.page_path || 'unknown';
      
      byType[errorType] = (byType[errorType] || 0) + 1;
      byUrl[apiUrl] = (byUrl[apiUrl] || 0) + 1;
      byPage[pagePath] = (byPage[pagePath] || 0) + 1;
      
      // Collect auth errors specifically
      if (errorType === 'auth_error') {
        authErrors.push(e);
      }
    }

    // Sort by count descending
    const sortedByUrl = Object.entries(byUrl)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    const sortedByPage = Object.entries(byPage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return NextResponse.json({
      data: {
        hours,
        total: events.length,
        byType,
        topUrls: sortedByUrl.map(([url, count]) => ({ url, count })),
        topPages: sortedByPage.map(([page, count]) => ({ page, count })),
        authErrors: authErrors.slice(0, 20).map(e => ({
          created_at: e.created_at,
          url: e.properties?.url || e.properties?.page_path,
          page: e.properties?.page_path,
          status: e.properties?.status,
          message: e.properties?.message,
        })),
        recentErrors: events.slice(0, 30).map(e => ({
          created_at: e.created_at,
          type: e.properties?.error_type,
          url: e.properties?.url || e.properties?.page_path,
          page: e.properties?.page_path,
          status: e.properties?.status,
          message: e.properties?.message?.slice(0, 100),
        })),
      },
      error: null,
    });
  } catch (e) {
    console.error('[admin.alerts.user-errors]', e);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
