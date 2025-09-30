import { createHash } from 'crypto';

// Allowed specializations (slugs)
export const ALLOWED_SPECIALIZATIONS = [
  'narm',
  'core-energetics',
  'hakomi',
  'somatic-experiencing',
] as const;

export type AllowedSpecialization = (typeof ALLOWED_SPECIALIZATIONS)[number];

export function sanitize(v?: string) {
  if (!v) return undefined;
  return v.toString().replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 1000);
}

export function normalizeSpecializations(values: unknown): AllowedSpecialization[] {
  if (!Array.isArray(values)) return [];
  const out: AllowedSpecialization[] = [];
  for (const raw of values) {
    const s = sanitize(String(raw))
      ?.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (s && (ALLOWED_SPECIALIZATIONS as readonly string[]).includes(s)) {
      out.push(s as AllowedSpecialization);
    }
  }
  return out;
}

export function hashIP(ip: string) {
  try {
    const salt = process.env.IP_HASH_SALT || '';
    return createHash('sha256').update(`${salt}${ip}`).digest('hex');
  } catch {
    return ip; // Fallback, should not happen in Node runtime
  }
}

// Email validation helper (consolidated from lib/validation.ts)
export function getEmailError(value: string | undefined | null): string | null {
  const email = (value ?? '').trim();
  if (!email) return 'Bitte gib deine E‑Mail‑Adresse ein.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Bitte gib eine gültige E‑Mail‑Adresse ein.';
  return null;
}
