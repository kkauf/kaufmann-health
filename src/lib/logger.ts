import { createHash } from 'crypto';

// Unified logging for business events and errors. Best-effort, non-blocking.
// Writes to Supabase REST if environment is configured; otherwise no-ops.

export type LogLevel = 'info' | 'warn' | 'error';

type TrackParams = {
  type: string; // e.g. 'lead_submitted', 'email_send_failed'
  level?: LogLevel; // default 'info'
  props?: Record<string, unknown>; // arbitrary metadata (PII-free)
  ip?: string; // raw IP, will be hashed
  ua?: string; // user-agent
  source?: string; // logical component, e.g. 'api.leads', 'email.client'
};

const MAX_PROP_BYTES = 8_000; // keep payloads lean (<10ms overhead target)
const MAX_STRING_LEN = 1000; // per-string clamp

function truncateString(s: string, limit = MAX_STRING_LEN): string {
  if (typeof s !== 'string') return s as unknown as string;
  return s.length <= limit ? s : `${s.slice(0, limit)}…`;
}

function shallowSanitize(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return truncateString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth >= 2) return '[array]';
    const limited = value.slice(0, 20).map((v) => shallowSanitize(v, depth + 1));
    return limited.length === value.length ? limited : [...limited, '…'];
  }
  if (typeof value === 'object') {
    if (depth >= 2) return '[object]';
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = shallowSanitize(v, depth + 1);
      count++;
      if (count >= 20) {
        out['…'] = 'truncated-keys';
        break;
      }
    }
    return out;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function byteLength(obj: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8');
  } catch {
    return 0;
  }
}

function truncateProperties(input: unknown, maxBytes = MAX_PROP_BYTES) {
  const sanitized = shallowSanitize(input);
  if (byteLength(sanitized) <= maxBytes) return sanitized;
  // Fall back to a compact summary to stay within budget.
  const summary: Record<string, unknown> = { truncated: true };
  if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
    for (const [k, v] of Object.entries(sanitized as Record<string, unknown>)) {
      summary[k] = v;
      if (byteLength(summary) > maxBytes) {
        delete summary[k];
        summary['note'] = 'properties exceeded size limit';
        break;
      }
    }
    return summary;
  }
  return { truncated: true, note: 'properties exceeded size limit' };
}

export function hashIP(ip: string): string {
  try {
    const salt = process.env.IP_HASH_SALT || '';
    return createHash('sha256').update(`${salt}${ip}`).digest('hex');
  } catch {
    return ip; // fallback should never happen in Node runtime
  }
}

function normalizeError(err: unknown) {
  const e = err as { name?: unknown; message?: unknown; stack?: unknown; cause?: unknown };
  const out: Record<string, unknown> = {
    name: typeof e?.name === 'string' ? (e.name as string) : undefined,
    message: truncateString(String(e?.message ?? err ?? 'Unknown error')),
    stack: typeof e?.stack === 'string' ? truncateString(e.stack as string, 2000) : undefined,
  };
  if (e?.cause) out.cause = truncateString(String(e.cause));
  return out;
}

async function persistEvent(params: Required<Pick<TrackParams, 'type'>> &
  Pick<TrackParams, 'level' | 'props' | 'ip' | 'ua' | 'source'>) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return; // not configured; no-op

    const payload = {
      level: (params.level || 'info') as LogLevel,
      type: params.type,
      properties: truncateProperties({ ...(params.props || {}), ...(params.source ? { source: params.source } : {}) }),
      hashed_ip: params.ip ? hashIP(params.ip) : null,
      user_agent: params.ua ? truncateString(params.ua, 255) : null,
      // created_at defaults to now() on DB
    } as const;

    await fetch(`${url}/rest/v1/events`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // swallow
  }
}

export async function track(params: TrackParams): Promise<void> {
  // Fire-and-forget usage recommended by callers
  await persistEvent({
    type: params.type,
    level: params.level ?? 'info',
    props: params.props,
    ip: params.ip,
    ua: params.ua,
    source: params.source,
  });
}

export async function logError(
  source: string,
  error: unknown,
  props?: Record<string, unknown>,
  ip?: string,
  ua?: string
): Promise<void> {
  const errProps = { error: normalizeError(error), ...(props || {}) };
  await persistEvent({ type: 'error', level: 'error', props: errProps, source, ip, ua });
}

// Export internals for high-ROI tests
export const __internals = { truncateString, truncateProperties, normalizeError };
