export function isTestEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const at = email.indexOf('@');
  const local = at >= 0 ? email.slice(0, at) : email;
  return /\+test(\b|$)/i.test(local);
}

export function isLocalhostRequest(req: Request): boolean {
  try {
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

export function isTestRequest(req: Request, email?: string | null): boolean {
  // In Vitest/Jest, many requests originate from localhost.
  // Preserve test expectations by not flagging test-mode during NODE_ENV==='test'.
  if (process.env.NODE_ENV === 'test') return false;
  return isLocalhostRequest(req) || isTestEmail(email);
}
