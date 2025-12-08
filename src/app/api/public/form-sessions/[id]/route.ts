import { supabaseServer } from '@/lib/supabase-server';
import { ServerAnalytics } from '@/lib/server-analytics';
import { safeJson } from '@/lib/http';
import { getFixedWindowLimiter, extractIpFromHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function getIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('form-sessions');
    if (idx >= 0 && parts.length > idx + 1) return decodeURIComponent(parts[idx + 1]);
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const id = getIdFromUrl(req.url);
  if (!id) return safeJson({ data: null, error: 'Missing id' }, { status: 400 });

  const { data, error } = await supabaseServer
    .from('form_sessions')
    .select('id,data,email,expires_at,updated_at')
    .eq('id', id)
    .single<{ id: string; data: Record<string, unknown>; email?: string | null; expires_at?: string | null; updated_at?: string }>();

  if (error || !data) {
    return safeJson({ data: null, error: 'Not found' }, { status: 404 });
  }
  if (data.expires_at && Date.parse(data.expires_at) < Date.now()) {
    return safeJson({ data: null, error: 'Expired' }, { status: 410 });
  }

  return safeJson({ data: { id: data.id, data: data.data, email: data.email, updated_at: data.updated_at }, error: null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request) {
  const id = getIdFromUrl(req.url);
  if (!id) return safeJson({ data: null, error: 'Missing id' }, { status: 400 });

  {
    const ip = extractIpFromHeaders(req.headers);
    const limiter = getFixedWindowLimiter('form-sessions-save', 60, 60_000);
    const { allowed, retryAfterSec } = limiter.check(ip);
    if (!allowed) {
      return safeJson(
        { data: null, error: 'Rate limited' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return safeJson({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }

  type UpdatePayload = { data: Record<string, unknown>; email?: string };
  const payload = body as Partial<UpdatePayload>;
  const nextData = payload.data as unknown;
  const email = typeof payload.email === 'string' ? payload.email.trim() : undefined;
  if (!nextData || typeof nextData !== 'object' || Array.isArray(nextData as unknown[])) {
    return safeJson({ data: null, error: 'Invalid data' }, { status: 400 });
  }

  // Check if session exists and is not expired before updating
  const { data: existing, error: fetchErr } = await supabaseServer
    .from('form_sessions')
    .select('id,expires_at')
    .eq('id', id)
    .single<{ id: string; expires_at?: string | null }>();

  if (fetchErr || !existing) {
    return safeJson({ data: null, error: 'Not found' }, { status: 404 });
  }
  if (existing.expires_at && Date.parse(existing.expires_at) < Date.now()) {
    return safeJson({ data: null, error: 'Expired' }, { status: 410 });
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabaseServer
    .from('form_sessions')
    .update({ data: nextData as Record<string, unknown>, updated_at: nowIso, ...(email ? { email } : {}) })
    .eq('id', id);

  if (error) {
    return safeJson({ data: null, error: 'Failed to update' }, { status: 500 });
  }

  try {
    await ServerAnalytics.trackEventFromRequest(req, {
      type: 'form_session_saved',
      source: 'api.form_sessions',
      props: { id },
    });
  } catch {}

  return safeJson({ data: { ok: true }, error: null });
}
