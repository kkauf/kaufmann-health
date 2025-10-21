import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { maybeFirePatientConversion } from '@/lib/conversion';

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

async function isAdmin(req: Request): Promise<boolean> {
  try {
    const { verifySessionToken, ADMIN_SESSION_COOKIE } = await import('@/lib/auth/adminSession');
    const token = parseCookie(req.headers.get('cookie')).get(ADMIN_SESSION_COOKIE);
    if (!token) return false;
    return await verifySessionToken(token);
  } catch {
    return false;
  }
}

function isCronAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const header = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
  const authHeader = req.headers.get('authorization') || '';
  const isAuthBearer = Boolean(authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret);
  if (header && header === cronSecret) return true;
  if (isAuthBearer) return true;
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (token && token === cronSecret) return true;
  } catch {}
  return false;
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get('host') || '';
  if (!host) return false;
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const http = `http://${host}`;
  const https = `https://${host}`;
  if (origin === http || origin === https) return true;
  if (referer.startsWith(http + '/')) return true;
  if (referer.startsWith(https + '/')) return true;
  return false;
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  try {
    const admin = await isAdmin(req);
    const cron = isCronAuthorized(req);
    if (!admin && !cron) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (admin && !cron && !sameOrigin(req)) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 200), 1000));

    // Fetch candidates: actionable patients missing conversion flag, with at least one identifier
    type Person = { id: string; email?: string | null; phone_number?: string | null; status?: string | null; metadata?: Record<string, unknown> | null };

    const { data, error } = await supabaseServer
      .from('people')
      .select('id,email,phone_number,status,metadata')
      .eq('type', 'patient')
      .in('status', ['new', 'email_confirmed'])
      .is('metadata->>google_ads_conversion_fired_at', null)
      .limit(limit);

    if (error) {
      await logError('admin.api.leads.conversions.backfill', error, { stage: 'fetch' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to fetch' }, { status: 500 });
    }

    const rows = (data as Person[] | null) || [];

    let processed = 0;
    let fired = 0;
    let skippedNoId = 0;

    for (const p of rows) {
      if (processed >= limit) break;
      processed++;
      const email = (p.email || '').trim();
      const phone = (p.phone_number || '').trim();
      if (!email && !phone) {
        skippedNoId++;
        continue;
      }
      try {
        const result = await maybeFirePatientConversion({
          patient_id: p.id,
          email: email || undefined,
          phone_number: phone || undefined,
          verification_method: email ? 'email' : 'sms',
          ip,
          ua,
        });
        if (result.fired) fired++;
      } catch (e) {
        await logError('admin.api.leads.conversions.backfill', e, { stage: 'fire_conversion', lead_id: p.id }, ip, ua);
      }
    }

    void track({ type: 'cron_completed', level: 'info', source: 'admin.api.leads.conversions.backfill', ip, ua, props: { processed, fired, skipped_no_identifier: skippedNoId } });

    return NextResponse.json({ data: { processed, fired, skipped_no_identifier: skippedNoId }, error: null });
  } catch (e) {
    await logError('admin.api.leads.conversions.backfill', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.leads.conversions.backfill', ip, ua });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;
  try {
    const admin = await isAdmin(req);
    const cron = isCronAuthorized(req);
    if (!admin && !cron) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (admin && !cron && !sameOrigin(req)) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const limit = Math.max(1, Math.min(Number(body['limit'] || 200), 1000));

    // Delegate to GET with a constructed URL to reuse logic
    const u = new URL(req.url);
    u.searchParams.set('limit', String(limit));
    return await GET(new Request(u.toString(), { headers: req.headers }));
  } catch (e) {
    await logError('admin.api.leads.conversions.backfill', e, { stage: 'exception' }, ip, ua);
    void track({ type: 'cron_failed', level: 'error', source: 'admin.api.leads.conversions.backfill', ip, ua });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
