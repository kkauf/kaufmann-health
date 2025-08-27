// Simple in-memory fixed-window rate limiter.
// NOTE: This is per-runtime-instance and resets on deploy. Suitable for MVP.

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

type WindowState = { count: number; resetAt: number };

const registries = new Map<string, Map<string, WindowState>>(); // name -> (key -> state)

export function getFixedWindowLimiter(name: string, limit: number, windowMs: number) {
  if (!registries.has(name)) registries.set(name, new Map());
  const store = registries.get(name)!;

  function check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = store.get(key);
    if (!entry || now >= entry.resetAt) {
      const resetAt = now + windowMs;
      store.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSec: Math.ceil(windowMs / 1000) };
    }

    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    }

    entry.count += 1;
    store.set(key, entry);
    return { allowed: true, remaining: Math.max(0, limit - entry.count), retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }

  function reset() {
    store.clear();
  }

  return { check, reset };
}

// Helper to reset all limiters in tests
export function __resetAllRateLimitersForTests() {
  for (const [, store] of registries) store.clear();
}

export function extractIpFromHeaders(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}
