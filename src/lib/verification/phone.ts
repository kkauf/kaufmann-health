/**
 * Phone number validation and formatting utilities
 * Supports international phone numbers in E.164 format
 */

/**
 * Normalize phone number to E.164 format
 * Accepts any valid international number (e.g., +1, +49, +44, etc.)
 * Returns: E.164 format (+<country><number>) or null if invalid
 */
export function normalizePhoneNumber(input: string): string | null {
  // Remove all non-digit characters except leading +
  let cleaned = input.replace(/[^\d+]/g, '');
  
  // Handle malformed +0... (user typed + followed by domestic prefix)
  // E.164 country codes never start with 0, so strip the + and treat as domestic
  if (cleaned.startsWith('+0')) {
    cleaned = cleaned.slice(1); // Remove + to process as domestic
  }
  
  // Handle German-specific formats first
  if (!cleaned.startsWith('+')) {
    // 0049 prefix (German international without +)
    if (cleaned.startsWith('0049')) {
      const digits = cleaned.slice(4);
      const validPrefixes = ['15', '16', '17'];
      const hasValidPrefix = validPrefixes.some(prefix => digits.startsWith(prefix));
      if (hasValidPrefix && digits.length >= 10 && digits.length <= 12) {
        return `+49${digits}`;
      }
      return null;
    }
    // 0 prefix (German domestic)
    if (cleaned.startsWith('0')) {
      const digits = cleaned.slice(1);
      const validPrefixes = ['15', '16', '17'];
      const hasValidPrefix = validPrefixes.some(prefix => digits.startsWith(prefix));
      if (hasValidPrefix && digits.length >= 10 && digits.length <= 12) {
        return `+49${digits}`;
      }
    }
    return null;
  }
  
  // E.164 format validation (international numbers)
  // - Must start with +
  // - Country code (1-3 digits) + subscriber number
  // - Total length 8-15 digits (excluding +)
  const digitsOnly = cleaned.slice(1); // Remove +
  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return null;
  }
  
  return cleaned;
}

/**
 * Format phone number for display: 0176 123 45678
 */
export function formatPhoneForDisplay(e164: string): string {
  // Remove +49 prefix
  const digits = e164.startsWith('+49') ? e164.slice(3) : e164;
  
  // Add leading 0 and format with spaces
  if (digits.length >= 10) {
    return `0${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  
  return `0${digits}`;
}

/**
 * Validate if string is a valid mobile number (international)
 * Legacy name kept for compatibility
 */
export function isValidGermanMobile(input: string): boolean {
  return normalizePhoneNumber(input) !== null;
}

/**
 * Validate phone number and return result with normalized value
 * Used by verification flows for input validation
 */
export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null;
  error?: string;
}

export function validatePhone(input: string): PhoneValidationResult {
  if (!input || !input.trim()) {
    return { isValid: false, normalized: null, error: 'Bitte gib eine Handynummer ein.' };
  }
  
  const normalized = normalizePhoneNumber(input);
  
  if (!normalized) {
    return { 
      isValid: false, 
      normalized: null, 
      error: 'Bitte gib eine gültige Handynummer ein (z.B. 0176 123 45678).' 
    };
  }
  
  return { isValid: true, normalized };
}

/**
 * Format phone as user types: adds spaces automatically
 * Input: "0176123" -> Output: "0176 123"
 */
export function formatPhoneInput(value: string): string {
  // Remove all non-digits except leading +
  let cleaned = value.replace(/[^\d+]/g, '');
  
  // Handle +49 prefix
  if (cleaned.startsWith('+49')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('49')) {
    cleaned = '0' + cleaned.slice(2);
  }
  
  // Ensure leading 0
  if (cleaned && !cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  
  // Limit to 12 digits (0176 123 45678 = 11 digits, but we account for edge cases)
  cleaned = cleaned.slice(0, 12);
  
  // Add spaces: 0XXX XXX XXXXX
  let formatted = cleaned;
  if (cleaned.length > 4) {
    formatted = `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  }
  if (cleaned.length > 7) {
    formatted = `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  
  return formatted;
}
