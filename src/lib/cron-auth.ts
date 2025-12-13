export type CronAuthOptions = {
  /**
   * Allow `?token=` fallback. This should be off in production to avoid leaking secrets via logs/referrers.
   */
  allowQueryToken?: boolean;

  /**
   * In local/dev, allow the presence of `x-vercel-cron` to count as authorized.
   * Never rely on this in production.
   */
  allowVercelCronHeaderInNonProd?: boolean;
};

export function isCronAuthorized(req: Request, opts: CronAuthOptions = {}): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const allowQueryToken =
    typeof opts.allowQueryToken === 'boolean' ? opts.allowQueryToken : process.env.NODE_ENV !== 'production';

  if (opts.allowVercelCronHeaderInNonProd && process.env.NODE_ENV !== 'production') {
    const vercelCron = req.headers.get('x-vercel-cron');
    if (vercelCron) return true;
  }

  const header = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
  if (header && header === cronSecret) return true;

  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret) return true;

  if (allowQueryToken && process.env.NODE_ENV !== 'production') {
    try {
      const url = new URL(req.url);
      const token = url.searchParams.get('token');
      if (token && token === cronSecret) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

export function sameOrigin(req: Request, { allowNoOrigin = false }: { allowNoOrigin?: boolean } = {}): boolean {
  const host = req.headers.get('host') || '';
  if (!host) return false;

  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';

  if (allowNoOrigin && !origin && !referer) return true;

  const http = `http://${host}`;
  const https = `https://${host}`;
  if (origin === http || origin === https) return true;
  if (referer.startsWith(http + '/')) return true;
  if (referer.startsWith(https + '/')) return true;
  return false;
}
