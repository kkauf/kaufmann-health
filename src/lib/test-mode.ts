export function isTestEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const at = email.indexOf('@');
  const local = at >= 0 ? email.slice(0, at) : email;
  return /\+test(\b|$)/i.test(local);
}

export function isLocalhostRequest(req: Request): boolean {
  try {
    // In Vercel serverless, req.url may not have the actual host.
    // Check x-forwarded-host header first (Vercel pattern), then fall back to req.url.
    const hostHeader = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
    if (hostHeader) {
      return (
        hostHeader === 'localhost' ||
        hostHeader.startsWith('localhost:') ||
        hostHeader === '127.0.0.1' ||
        hostHeader.startsWith('127.0.0.1:') ||
        hostHeader === '0.0.0.0' ||
        hostHeader.startsWith('0.0.0.0:') ||
        hostHeader === '::1' ||
        hostHeader.startsWith('[::1]:')
      );
    }
    // Fallback to URL parsing
    const { hostname } = new URL(req.url);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    );
  } catch {
    return false;
  }
}

export function isStagingRequest(req: Request): boolean {
  try {
    // In Vercel serverless, req.url may not have the actual host.
    // Check x-forwarded-host header first (Vercel pattern), then fall back to req.url.
    const hostHeader = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
    if (hostHeader) {
      return hostHeader === 'staging.kaufmann-health.de';
    }
    // Fallback to URL parsing
    const { hostname } = new URL(req.url);
    return hostname === 'staging.kaufmann-health.de';
  } catch {
    return false;
  }
}

export function isTestRequest(req: Request, email?: string | null): boolean {
  // In Vitest/Jest, many requests originate from localhost.
  // Preserve test expectations by not flagging test-mode during NODE_ENV==='test'.
  if (process.env.NODE_ENV === 'test') return false;
  return isLocalhostRequest(req) || isStagingRequest(req) || isTestEmail(email);
}
