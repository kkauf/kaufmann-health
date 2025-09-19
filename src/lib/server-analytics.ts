import { track } from '@/lib/logger';

export type ServerAttribution = {
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

function getClientIP(headers: Headers) {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xrip = headers.get('x-real-ip');
  if (xrip) return xrip.trim();
  return undefined;
}

export function parseAttributionFromRequest(req: Request): ServerAttribution {
  const referrer = req.headers.get('referer') || undefined;
  if (!referrer) return {};
  try {
    const url = new URL(referrer);
    const sp = url.searchParams;
    const utm_source = sp.get('utm_source') || undefined;
    const utm_medium = sp.get('utm_medium') || undefined;
    const utm_campaign = sp.get('utm_campaign') || undefined;
    return { referrer, utm_source, utm_medium, utm_campaign };
  } catch {
    return { referrer };
  }
}

export function parseCampaignFromRequest(req: Request): {
  campaign_source?: string;
  campaign_variant?: 'A' | 'B' | 'C';
  landing_page?: string;
} {
  const ref = req.headers.get('referer') || '';
  let pathname: string | undefined;
  let vFromRef: string | undefined;
  try {
    const u = new URL(ref);
    pathname = u.pathname || undefined;
    vFromRef = u.searchParams.get('v') || undefined;
  } catch {
    pathname = undefined;
  }

  // Fallback: look at API URL for variant when not present on referer
  let v: string | undefined = vFromRef;
  if (!v) {
    try {
      const apiUrl = new URL(req.url);
      v = apiUrl.searchParams.get('v') || undefined;
    } catch {}
  }
  const vt = (v || 'A').toUpperCase();
  const vv: 'A' | 'B' | 'C' = vt === 'B' ? 'B' : vt === 'C' ? 'C' : 'A';

  // Source mapping (EARTH-146)
  const src = pathname?.includes('/ankommen-in-dir')
    ? '/ankommen-in-dir'
    : pathname?.includes('/wieder-lebendig')
    ? '/wieder-lebendig'
    : '/therapie-finden';

  return {
    campaign_source: src,
    campaign_variant: vv,
    landing_page: pathname,
  };
}

export async function trackEventFromRequest(
  req: Request,
  input: {
    type: string;
    source?: string;
    props?: Record<string, unknown>;
    id?: string;
    title?: string;
    session_id?: string;
  },
): Promise<void> {
  const ip = getClientIP(req.headers);
  const ua = req.headers.get('user-agent') || undefined;
  const attr = parseAttributionFromRequest(req);
  const props: Record<string, unknown> = {
    ...(input.id ? { id: input.id } : {}),
    ...(input.title ? { title: input.title } : {}),
    ...(input.session_id ? { session_id: input.session_id } : {}),
    ...(attr.referrer ? { referrer: attr.referrer } : {}),
    ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
    ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
    ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
    ...(input.props || {}),
  };
  await track({ type: input.type, level: 'info', source: input.source, ip, ua, props });
}

export const ServerAnalytics = { parseAttributionFromRequest, parseCampaignFromRequest, trackEventFromRequest };
