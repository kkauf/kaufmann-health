/**
 * Pricing utilities for therapist session pricing display
 * Handles formatting of session prices with fallback to standard range
 */

export const DEFAULT_PRICE_RANGE = '80€-120€';

/**
 * Format session price for UI display (profile, booking confirmation)
 * @param rate - The typical session rate (number) or null/undefined
 * @returns Formatted price string with "pro Sitzung" or default range
 */
export function formatSessionPrice(rate: number | null | undefined): string {
  if (!rate || rate <= 0) {
    return `Sitzungspreise ${DEFAULT_PRICE_RANGE}`;
  }
  return `${rate}€ pro Sitzung`;
}

/**
 * Format session price for email templates with explanatory text
 * @param rate - The typical session rate (number) or null/undefined
 * @returns Formatted price string suitable for email body
 */
export function formatEmailPrice(rate: number | null | undefined): string {
  if (!rate || rate <= 0) {
    return `Sitzungspreise ${DEFAULT_PRICE_RANGE}, genauer Preis auf Anfrage bei deiner Therapeut:in`;
  }
  return `${rate}€ pro Sitzung`;
}
