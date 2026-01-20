/**
 * Therapist slug utilities for SEO-friendly profile URLs.
 * 
 * Slug format: firstname-lastname (lowercase, ASCII only)
 * Matches Cal.com username pattern for consistency.
 * Example: "anna-mueller"
 */

/**
 * Generate a URL-safe slug from therapist name.
 * Uses NFD normalization to remove diacritics (same as Cal.com).
 * Format matches cal_username for consistency.
 */
export function generateTherapistSlug(
  firstName: string,
  lastName: string
): string {
  const slug = (v: string) =>
    v
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics (ä→a, ö→o, ü→u)
      .replace(/[–—−]/g, '-')
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const first = slug(firstName) || 'therapist';
  const last = slug(lastName) || 'kh';
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
  
  // Find next available suffix
  let suffix = 2;
  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
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
