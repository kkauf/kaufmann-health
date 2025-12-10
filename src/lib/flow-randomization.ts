/**
 * Flow Randomization for Test 4 A/B Testing
 * 
 * When no ?variant= param is present, randomizes 50/50 between concierge and self-service.
 * Persists choice in localStorage for session consistency.
 */

export type FlowVariant = 'concierge' | 'self-service';

const STORAGE_KEY = 'kh_flow_variant';

/**
 * Get or assign a flow variant.
 * - If explicit variant in URL params → use it
 * - If previously assigned → use stored value
 * - Otherwise → randomize 50/50 and persist
 */
export function getFlowVariant(urlVariant?: string | null): FlowVariant {
  // 1. Explicit URL param takes precedence
  if (urlVariant === 'concierge' || urlVariant === 'self-service') {
    return urlVariant;
  }
  
  // 2. Check localStorage for existing assignment
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'concierge' || stored === 'self-service') {
      return stored;
    }
    
    // 3. Randomize and persist
    const randomized: FlowVariant = Math.random() < 0.5 ? 'concierge' : 'self-service';
    localStorage.setItem(STORAGE_KEY, randomized);
    return randomized;
  }
  
  // SSR fallback: default to concierge
  return 'concierge';
}

/**
 * Check if flow was randomized (no explicit URL param)
 */
export function wasFlowRandomized(urlVariant?: string | null): boolean {
  return urlVariant !== 'concierge' && urlVariant !== 'self-service';
}
