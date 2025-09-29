/**
 * Phone number validation and formatting utilities
 * German mobile numbers only (+49)
 */

/**
 * Normalize German phone number to E.164 format
 * Accepts: 0176 123 456 78, +49 176 123 456 78, 49176123456, etc.
 * Returns: +4917612345678 or null if invalid
 */
export function normalizePhoneNumber(input: string): string | null {
  // Remove all non-digit characters except leading +
  const cleaned = input.replace(/[^\d+]/g, '');
  
  // Handle different input formats
  let digits = cleaned;
  
  if (digits.startsWith('+49')) {
    digits = digits.slice(3); // Remove +49
  } else if (digits.startsWith('0049')) {
    digits = digits.slice(4); // Remove 0049
  } else if (digits.startsWith('49')) {
    digits = digits.slice(2); // Remove 49
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1); // Remove leading 0
  }
  
  // Validate German mobile prefixes (15x, 16x, 17x)
  const validPrefixes = ['15', '16', '17'];
  const hasValidPrefix = validPrefixes.some(prefix => digits.startsWith(prefix));
  
  if (!hasValidPrefix) {
    return null;
  }
  
  // German mobile numbers should be 10-11 digits after country code
  // Allow some flexibility for different formats
  if (digits.length < 10 || digits.length > 12) {
    return null;
  }
  
  return `+49${digits}`;
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
 * Validate if string is a valid German mobile number
 */
export function isValidGermanMobile(input: string): boolean {
  return normalizePhoneNumber(input) !== null;
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
