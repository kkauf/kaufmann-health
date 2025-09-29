/**
 * Verification configuration and mode detection
 * EARTH-191: Support email | sms | choice modes
 */

export type VerificationMode = 'email' | 'sms' | 'choice';

/**
 * Get current verification mode from environment
 * Uses NEXT_PUBLIC_VERIFICATION_MODE for both server and client
 * Defaults to 'email' for backward compatibility
 */
export function getVerificationMode(): VerificationMode {
  const mode = process.env.NEXT_PUBLIC_VERIFICATION_MODE?.toLowerCase();
  
  if (mode === 'sms' || mode === 'choice') {
    return mode;
  }
  
  return 'email';
}

/**
 * Get verification mode for client components
 * Safe for SSR - returns 'email' on server to avoid hydration issues
 */
export function getVerificationModeClient(): VerificationMode {
  // Always return email during SSR to avoid hydration mismatch
  // The actual mode will be determined on mount
  if (typeof window === 'undefined') {
    return 'email';
  }
  
  return getVerificationMode();
}

/**
 * Check if SMS verification is enabled in any capacity
 */
export function isSmsEnabled(): boolean {
  const mode = getVerificationMode();
  return mode === 'sms' || mode === 'choice';
}

/**
 * Check if email verification is enabled in any capacity
 */
export function isEmailEnabled(): boolean {
  const mode = getVerificationMode();
  return mode === 'email' || mode === 'choice';
}

/**
 * Determine default contact method based on user agent (mobile/desktop)
 * Only relevant in 'choice' mode
 */
export function getDefaultContactMethod(userAgent: string): 'phone' | 'email' {
  const mode = getVerificationMode();
  
  if (mode === 'sms') return 'phone';
  if (mode === 'email') return 'email';
  
  // Choice mode: detect mobile
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
  return isMobile ? 'phone' : 'email';
}
