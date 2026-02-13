/**
 * Flow Randomization for A/B Testing
 *
 * Variants:
 * - 'concierge': Manual curation flow (unchanged)
 * - 'progressive': Progressive disclosure — anonymous submit → match preview → phone-only → name after SMS
 * - 'classic': Traditional flow — full contact form (name + email/phone toggle) after preferences
 *
 * URL params:
 * - ?v=concierge / ?v=progressive / ?v=classic → force specific flow (QA)
 * - ?v=self-service → randomize 50/50 progressive/classic (ad traffic)
 * - No param → randomize 50/50 progressive/classic
 *
 * Persists choice in localStorage for session consistency.
 */

export type FlowVariant = 'concierge' | 'self-service' | 'progressive' | 'classic';

const STORAGE_KEY = 'kh_flow_variant';

/** Variants that force a specific flow (QA/debugging) */
const FORCED_VARIANTS = new Set<string>(['concierge', 'progressive', 'classic']);

/**
 * Get or assign a flow variant.
 * - If explicit forced variant in URL params → use it
 * - If previously assigned (progressive/classic/concierge) → use stored value
 * - Otherwise → randomize 50/50 progressive/classic and persist
 *
 * Note: ?v=self-service (from ad URLs) triggers randomization, not a forced flow.
 * Old stored 'self-service' values are re-randomized.
 */
export function getFlowVariant(urlVariant?: string | null): FlowVariant {
  // 1. Explicit forced variants (QA only)
  if (urlVariant && FORCED_VARIANTS.has(urlVariant)) {
    return urlVariant as FlowVariant;
  }

  // 2. Check localStorage for existing assignment
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Accept stored progressive/classic assignments
    if (stored === 'progressive' || stored === 'classic') {
      return stored;
    }
    // Concierge stays concierge (not re-randomized)
    if (stored === 'concierge') return stored;

    // 3. Randomize and persist (covers ?v=self-service from ads AND no-param visits)
    // Old 'self-service' stored values also fall through here and get re-randomized
    const randomized: FlowVariant = Math.random() < 0.5 ? 'classic' : 'progressive';
    localStorage.setItem(STORAGE_KEY, randomized);
    return randomized;
  }

  // SSR fallback
  return 'classic';
}

/**
 * Check if the variant is a progressive disclosure flow.
 */
export function isProgressiveFlow(variant: FlowVariant | string | null): boolean {
  return variant === 'progressive';
}

/**
 * Check if flow was randomized (no explicit forced URL param)
 */
export function wasFlowRandomized(urlVariant?: string | null): boolean {
  return !urlVariant || !FORCED_VARIANTS.has(urlVariant);
}
