import { URL } from 'url';

export function eurosToMicros(eur: number): number {
  return Math.round((eur || 0) * 1_000_000);
}

export function uniqueKeepOrder(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const s = (x || '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function normalizeText(s: string): string {
  return (s || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+–\s+/g, ' – ')
    .trim();
}

export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const sub = s.slice(0, max);
  const lastSpace = sub.lastIndexOf(' ');
  return (lastSpace > 10 ? sub.slice(0, lastSpace) : sub).trim();
}

export function sanitizePathPart(s?: string): string | undefined {
  if (!s) return undefined;
  const cleaned = normalizeText(s).replace(/\//g, '-');
  return clip(cleaned, 15);
}

export function buildFinalUrl(base: string, params?: Record<string, string>) {
  if (!params || Object.keys(params).length === 0) return base;
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  return url.toString();
}

export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}
