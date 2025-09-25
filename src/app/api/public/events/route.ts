import { parseAttributionFromRequest, ServerAnalytics } from '@/lib/server-analytics';
import { track } from '@/lib/logger';
import { safeJson } from '@/lib/http';
import { isLocalhostRequest } from '@/lib/test-mode';

export const runtime = 'nodejs';

/**
 * @endpoint POST /api/events
 */
export async function POST(req: Request) {
  try {
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
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ua = req.headers.get('user-agent') || undefined;
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

