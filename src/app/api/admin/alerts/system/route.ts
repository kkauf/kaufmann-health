import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { isCronAuthorized as isCronAuthorizedShared, sameOrigin as sameOriginShared } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reuse the same cron/auth pattern used across admin cron routes
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

async function _isCronOrAdmin(req: Request): Promise<boolean> {
  try {
    if (isCronAuthorizedShared(req)) return true;

    // Fallback: allow admin cookie access as manual trigger (no import to avoid coupling)
    const { verifySessionToken, ADMIN_SESSION_COOKIE } = await import('@/lib/auth/adminSession');
    const token = parseCookie(req.headers.get('cookie')).get(ADMIN_SESSION_COOKIE);
    if (!token) return false;
    return await verifySessionToken(token);
  } catch {
    return false;
  }
}

function isCronAuthorized(req: Request): boolean {
  return isCronAuthorizedShared(req);
}

function sameOrigin(req: Request): boolean {
  return sameOriginShared(req);
}

function minutesAgoISO(mins: number) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}

// Basic event row type
type EventRow = {
  id: string;
  type: string;
  level: 'info' | 'warn' | 'error';
  properties?: Record<string, unknown> | null;
  created_at?: string | null;
};

function getProp(obj: unknown, path: string): unknown {
  try {
    if (!obj || typeof obj !== 'object') return undefined;
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') {
        const rec = acc as Record<string, unknown>;
        return Object.prototype.hasOwnProperty.call(rec, key) ? rec[key] : undefined;
      }
      return undefined;
    }, obj as unknown);
  } catch {
    return undefined;
  }
}

function summarize(rows: EventRow[]) {
  const bySource = new Map<string, number>();
  const byType = new Map<string, number>();
  const latest: Array<{ when: string; type: string; source: string; message: string }> = [];

  for (const r of rows) {
    const src = (getProp(r.properties, 'source') as string) || 'unknown';
    bySource.set(src, (bySource.get(src) || 0) + 1);
    byType.set(r.type, (byType.get(r.type) || 0) + 1);
  }

  const latestSorted = [...rows].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  for (const r of latestSorted.slice(-5).reverse()) {
    const when = r.created_at ? new Date(r.created_at).toISOString() : '';
    const src = (getProp(r.properties, 'source') as string) || 'unknown';
    const msg = (getProp(r.properties, 'error.message') as string) || (getProp(r.properties, 'message') as string) || '';
    latest.push({ when, type: r.type, source: src, message: typeof msg === 'string' ? msg : '' });
  }

  const topSources = Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topTypes = Array.from(byType.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return { topSources, topTypes, latest } as const;
}

function roundToWindowStart(durationMin: number) {
  const ms = durationMin * 60 * 1000;
  return Math.floor(Date.now() / ms) * ms;
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    const okCron = isCronAuthorized(req);
    let isAdmin = false;
    try {
      const { verifySessionToken, ADMIN_SESSION_COOKIE } = await import('@/lib/auth/adminSession');
      const token = parseCookie(req.headers.get('cookie')).get(ADMIN_SESSION_COOKIE);
      isAdmin = token ? await verifySessionToken(token) : false;
    } catch {}
    if (!okCron && !isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (isAdmin && !okCron && !sameOrigin(req)) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const minutesRaw = url.searchParams.get('minutes') || '15';
    let minutes = Number.parseInt(minutesRaw, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) minutes = 15;
    if (minutes > 60) minutes = 60; // cap

    const sinceIso = minutesAgoISO(minutes);

    // Fetch error-level and explicit cron failures in the window
    // Exclude automated attack patterns (api.404) which are mostly reconnaissance probes
    let query = supabaseServer
      .from('events')
      .select('id, type, level, properties, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(1000);

    // level=error OR type=cron_failed, BUT exclude automated attack noise
    // Supabase .or uses a CSV of filters
    query = query.or('level.eq.error,type.eq.cron_failed');

    const { data, error } = await query;
    if (error) {
      await logError('admin.api.alerts.system', error, { stage: 'fetch_events', minutes }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch events' }, { status: 500 });
    }

    // Exclude automated 404 probes (api.404) in-memory to keep PostgREST filter simple
    const rows = ((data as EventRow[] | null) || []).filter((r) => (getProp(r.properties, 'source') as string) !== 'api.404');

    // Nothing to alert on
    if (rows.length === 0) {
      return NextResponse.json({ data: { sent: false, reason: 'no_events' }, error: null }, { status: 200 });
    }

    // De-dupe per window using an internal event marker
    const windowStart = roundToWindowStart(minutes);
    const digestKey = `system_errors_${minutes}m_${windowStart}`;
    try {
      const { data: prior } = await supabaseServer
        .from('events')
        .select('id')
        .eq('type', 'internal_alert_sent')
        .contains('properties', { kind: 'system_errors_digest', digest_key: digestKey })
        .limit(1);
      if (Array.isArray(prior) && prior.length > 0) {
        return NextResponse.json({ data: { sent: false, reason: 'already_sent' }, error: null }, { status: 200 });
      }
    } catch {}

    const { topSources, topTypes, latest } = summarize(rows);

    const to = (process.env.LEADS_NOTIFY_EMAIL || '').trim();
    if (!to) {
      await logError('admin.api.alerts.system', new Error('Missing LEADS_NOTIFY_EMAIL'), { stage: 'send', minutes }, ip, ua);
      return NextResponse.json({ data: { sent: false, reason: 'missing_recipient' }, error: null }, { status: 200 });
    }

    const totalErrors = rows.length;

    const subject = `[KH] System alerts: ${totalErrors} issue${totalErrors === 1 ? '' : 's'} in last ${minutes}m`;

    const lines: string[] = [];
    lines.push(`Window: last ${minutes} minutes`);
    lines.push(`Total: ${totalErrors}`);
    lines.push('');
    lines.push('Top sources:');
    for (const [s, c] of topSources) lines.push(`- ${s}: ${c}`);
    lines.push('');
    lines.push('Top types:');
    for (const [t, c] of topTypes) lines.push(`- ${t}: ${c}`);
    lines.push('');
    lines.push('Latest:');
    for (const e of latest) lines.push(`- ${e.when} | ${e.type} | ${e.source} | ${e.message}`);
    lines.push('');
    lines.push('Next steps:');
    lines.push('- Check /admin/errors for full details (filter by source/type).');
    lines.push('- If nothing obvious, open Vercel → Functions → Logs for the affected route.');

    try {
      await sendEmail({ to, subject, text: lines.join('\n'), context: { kind: 'system_errors_digest', digest_key: digestKey, minutes, total: totalErrors } });
      void track({ type: 'internal_alert_sent', level: 'warn', source: 'admin.api.alerts.system', props: { kind: 'system_errors_digest', digest_key: digestKey, minutes, total: totalErrors }, ip, ua });
      return NextResponse.json({ data: { sent: true, total: totalErrors }, error: null }, { status: 200 });
    } catch (e) {
      await logError('admin.api.alerts.system', e, { stage: 'send_email', minutes, total: totalErrors }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to send email' }, { status: 500 });
    }
  } catch (e) {
    await logError('admin.api.alerts.system', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
