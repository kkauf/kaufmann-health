/**
 * Analytics helpers.
 *
 * buildEventId(page, location, action, qualifier?) creates a stable kebab-case
 * identifier like: "fuer-therapeuten-hero-apply".
 *
 * Pass pathname like "/fuer-therapeuten". Slashes are converted to dashes and
 * all segments are normalized.
 */
export function buildEventId(
  page: string,
  location: string,
  action: string,
  qualifier?: string
): string {
  const slug = (v: string | undefined | null) => {
    if (!v) return '';
    // Normalize, keep letters/numbers, convert separators to '-'
    return v
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[\/]+/g, '-')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const parts = [slug(page), slug(location), slug(action)];
  const q = slug(qualifier);
  if (q) parts.push(q);
  return parts.filter(Boolean).join('-');
}
