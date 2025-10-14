import { parseAttributionFromRequest, ServerAnalytics } from '@/lib/server-analytics';
import { safeJson } from '@/lib/http';
import { isLocalhostRequest } from '@/lib/test-mode';
import { getFixedWindowLimiter, extractIpFromHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const eventsLimiter = getFixedWindowLimiter('public-events', 60, 60_000);

/**
 * @endpoint POST /api/events
 */
export async function POST(req: Request) {
  try {
    const ip = extractIpFromHeaders(req.headers);
    const { allowed, retryAfterSec } = eventsLimiter.check(ip);
    if (!allowed) {
      return safeJson(
        { data: null, error: 'Rate limited' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }

    const {
      type,
      id,
      title,
      session_id,
      referrer: referrerBody,
      utm_source,
      utm_medium,
      utm_campaign,
      properties,
    } = (await req.json()) as {
      type?: string;
      id?: string;
      title?: string;
      session_id?: string;
      referrer?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      properties?: Record<string, unknown>;
    };

    if (!type || typeof type !== 'string') {
      return safeJson({ data: null, error: 'Missing type' }, { status: 400 });
    }

    // Optional metadata
    const attr = parseAttributionFromRequest(req);
    const referrer = (referrerBody || attr.referrer) ?? undefined;
    const utmSourceFinal = utm_source || attr.utm_source;
    const utmMediumFinal = utm_medium || attr.utm_medium;
    const utmCampaignFinal = utm_campaign || attr.utm_campaign;

    const mergedProps: Record<string, unknown> = {
      id,
      title,
      path: '/api/events',
      session_id,
      referrer,
      utm_source: utmSourceFinal,
      utm_medium: utmMediumFinal,
      utm_campaign: utmCampaignFinal,
      ...(isLocalhostRequest(req) ? { is_test: true } : {}),
      ...(properties && typeof properties === 'object' ? properties : {}),
    };

    // Persist to server analytics (e.g., Supabase events table)
    try {
      await ServerAnalytics.trackEventFromRequest(req, {
        type,
        source: 'api.events',
        props: mergedProps,
      });
    } catch {}

    return safeJson({ data: { received: true }, error: null });
  } catch {
    return safeJson({ data: null, error: 'Invalid JSON' }, { status: 400 });
  }
}

