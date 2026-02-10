/**
 * Therapist slug utilities for SEO-friendly profile URLs.
 *
 * Slug format: firstname-lastname (lowercase, ASCII only)
 * German umlauts are expanded: ü→ue, ö→oe, ä→ae, ß→ss
 * Titles (Dr., Prof., etc.) are stripped.
 * Example: "anna-mueller", "juergen-schroeder"
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Titles to strip from names before slugifying. */
const TITLE_PATTERNS = /\b(dr\.?\s*med\.?|dr\.?|prof\.?\s*dr\.?|prof\.?)\b/gi;

/** German umlaut/ligature expansions (must run before NFD normalization). */
function expandGermanChars(s: string): string {
  return s
    .replace(/ü/g, 'ue').replace(/Ü/g, 'Ue')
    .replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
    .replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
    .replace(/ß/g, 'ss');
}

/**
 * Generate a URL-safe slug from therapist name.
 * Strips titles, expands German umlauts, then removes remaining diacritics via NFD.
 */
export function generateTherapistSlug(
  firstName: string,
  lastName: string
): string {
  const slugify = (v: string) =>
    expandGermanChars(v.trim().replace(TITLE_PATTERNS, ''))
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove remaining diacritics
      .replace(/[–—−]/g, '-')
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const first = slugify(firstName) || 'therapist';
  const last = slugify(lastName) || 'kh';
  return `${first}-${last}`;
}

/**
 * Generate a unique slug, appending a numeric suffix if needed.
 * Call this with existing slugs to ensure uniqueness.
 */
export function generateUniqueSlug(
  firstName: string,
  lastName: string,
  existingSlugs: Set<string>
): string {
  const baseSlug = generateTherapistSlug(firstName, lastName);

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix++;
  }

  return `${baseSlug}-${suffix}`;
}

/**
 * Generate a unique slug by querying the database for collisions.
 * Suitable for use during registration where you don't have all slugs in memory.
 */
export async function generateUniqueSlugFromDb(
  firstName: string,
  lastName: string,
  supabase: SupabaseClient
): Promise<string> {
  const baseSlug = generateTherapistSlug(firstName, lastName);

  const { data } = await supabase
    .from('therapists')
    .select('slug')
    .like('slug', `${baseSlug}%`);

  const existing = new Set(
    (data || []).map((r: { slug: string | null }) => r.slug).filter(Boolean)
  );

  if (!existing.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existing.has(`${baseSlug}-${suffix}`)) {
    suffix++;
  }

  return `${baseSlug}-${suffix}`;
}

/**
 * Validate that a slug is well-formed.
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3;
}
