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
  campaign_variant?: string;
  landing_page?: string;
} {
  const ref = req.headers.get('referer') || '';
  let pathname: string | undefined;
  let variantParam: string | undefined;
  try {
    const u = new URL(ref);
    pathname = u.pathname || undefined;
    // Prefer explicit 'variant' parameter; fallback to 'v' if present
    variantParam = u.searchParams.get('variant') || u.searchParams.get('v') || undefined;
  } catch {
    pathname = undefined;
  }

  // Determine source from pathname
  const src = pathname?.includes('/start')
    ? '/start'
    : pathname?.includes('/ankommen-in-dir')
    ? '/ankommen-in-dir'
    : pathname?.includes('/wieder-lebendig')
    ? '/wieder-lebendig'
    : pathname?.includes('/fragebogen')
    ? '/fragebogen'
    : '/therapie-finden';

  // Variant: normalized lower-case string from ?variant= (or ?v= fallback). No forced mapping.
  const variant = variantParam ? variantParam.toLowerCase() : undefined;

  return {
    campaign_source: src,
    campaign_variant: variant,
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
  // Skip noisy cron monitoring events in production (only log failures)
  if (process.env.NODE_ENV === 'production') {
    if (['cron_executed', 'cron_completed'].includes(input.type)) {
      if (!input.props?.error) return;
    }
  }

  const ip = getClientIP(req.headers);
  const ua = req.headers.get('user-agent') || undefined;
  const attr = parseAttributionFromRequest(req);

  // Environment and preview/bot detection
  const hostHeader = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  const deploymentUrlHeader = (req.headers.get('x-vercel-deployment-url') || '').toLowerCase();
  const isPreviewHost = hostHeader.endsWith('.vercel.app') || deploymentUrlHeader.endsWith('.vercel.app');
  const vercelEnv = (process.env.VERCEL_ENV || '').toLowerCase();
  const envTag = vercelEnv || ((hostHeader.includes('localhost') || hostHeader.startsWith('127.')) ? 'development' : (isPreviewHost ? 'preview' : 'production'));
  const isVercelScreenshot = /vercel-screenshot/i.test(String(ua || ''));
  const markAsTest = envTag !== 'production' || isVercelScreenshot || isPreviewHost;

  const props: Record<string, unknown> = {
    ...(input.id ? { id: input.id } : {}),
    ...(input.title ? { title: input.title } : {}),
    ...(input.session_id ? { session_id: input.session_id } : {}),
    ...(attr.referrer ? { referrer: attr.referrer } : {}),
    ...(attr.utm_source ? { utm_source: attr.utm_source } : {}),
    ...(attr.utm_medium ? { utm_medium: attr.utm_medium } : {}),
    ...(attr.utm_campaign ? { utm_campaign: attr.utm_campaign } : {}),
    env: envTag,
    host: hostHeader || undefined,
    ...(markAsTest ? { is_test: true } : {}),
    ...(input.props || {}),
  };
  await track({ type: input.type, level: 'info', source: input.source, ip, ua, props });
}

export const ServerAnalytics = { parseAttributionFromRequest, parseCampaignFromRequest, trackEventFromRequest };
