/*
  Utility to create and verify signed one-click links (HMAC-SHA256).
  Uses ADMIN_PASSWORD as signing key to avoid introducing new secrets.
  Token format: base64url(payload).base64url(HMAC(payload))
  Payload format (querystring-like): key=value&...
*/

function assertSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('Missing ADMIN_PASSWORD for signed links');
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const str = typeof Buffer !== 'undefined' ? Buffer.from(b64 + pad, 'base64').toString('binary') : atob(b64 + pad);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

function serializeParams(params: Record<string, string | number>): string {
  const keys = Object.keys(params).sort();
  return keys.map((k) => `${k}=${encodeURIComponent(String(params[k]))}`).join('&');
}

function parsePayload(payload: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of payload.split('&')) {
    const [k, v] = part.split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(v || '');
  }
  return out;
}

export async function createTherapistOptOutToken(therapistId: string, ttlSec = 60 * 60 * 24 * 180) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = serializeParams({ act: 'optout', tid: therapistId, exp });
  const sig = await hmac(payload, assertSecret());
  const token = `${toBase64Url(new TextEncoder().encode(payload))}.${sig}`;
  return token;
}

export async function verifyTherapistOptOutToken(token: string): Promise<{ ok: boolean; therapistId?: string; reason?: string }>
{
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return { ok: false, reason: 'format' };
    const payload = new TextDecoder().decode(fromBase64Url(payloadB64));
    const expected = await hmac(payload, assertSecret());
    if (expected !== sig) return { ok: false, reason: 'signature' };
    const data = parsePayload(payload);
    if (data['act'] !== 'optout') return { ok: false, reason: 'act' };
    const exp = Number(data['exp'] || 0);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' };
    const tid = data['tid'];
    if (!tid) return { ok: false, reason: 'missing_tid' };
    return { ok: true, therapistId: tid };
  } catch {
    return { ok: false, reason: 'exception' };
  }
}
