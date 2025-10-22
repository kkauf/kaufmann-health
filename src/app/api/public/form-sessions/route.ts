import { supabaseServer } from '@/lib/supabase-server';
import { ServerAnalytics, parseCampaignFromRequest } from '@/lib/server-analytics';
import { safeJson } from '@/lib/http';
import { getFixedWindowLimiter, extractIpFromHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const ip = extractIpFromHeaders(req.headers);
    const limiter = getFixedWindowLimiter('form-sessions-create', 20, 60_000);
    const { allowed, retryAfterSec } = limiter.check(ip);
    if (!allowed) {
      return safeJson(
        { data: null, error: 'Rate limited' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return safeJson({ data: null, error: 'Invalid JSON' }, { status: 400 });
    }

    type CreatePayload = { email?: string; data: Record<string, unknown> };
    const payload = body as Partial<CreatePayload>;
    const email = typeof payload.email === 'string' ? payload.email.trim() : undefined;
    const data = payload.data as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data as unknown[])) {
      return safeJson({ data: null, error: 'Invalid data' }, { status: 400 });
    }

    // Ensure attribution snapshot exists (idempotent)
    try {
      const obj = data as Record<string, unknown>;
      if (!obj['_attr']) {
        const base = parseCampaignFromRequest(req);
        const campaign_variant = base.campaign_variant;
        const campaign_source = base.campaign_source;
        obj['_attr'] = { campaign_source, campaign_variant } as Record<string, unknown>;
      }
    } catch {}

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: inserted, error } = await supabaseServer
      .from('form_sessions')
      .insert({ data: data as Record<string, unknown>, email: email || null, expires_at: expiresAt })
      .select('id')
      .single<{ id: string }>();

    if (error || !inserted?.id) {
      return safeJson({ data: null, error: 'Failed to create form session' }, { status: 500 });
    }

    try {
      await ServerAnalytics.trackEventFromRequest(req, {
        type: 'form_session_created',
        source: 'api.form_sessions',
        props: { id: inserted.id },
      });
    } catch {}

    return safeJson({ data: { id: inserted.id }, error: null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return safeJson({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
