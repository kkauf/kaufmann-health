/**
 * Reusable phone validation logic
 * Handles normalization and validation with fallback to DOM value
 */

import { normalizePhoneNumber } from './phone';

interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null;
  error?: string;
}

/**
 * Validate and normalize a phone number
 * Falls back to DOM input value if state value is empty or just dial code
 *
 * @param phoneValue - The phone value from state
 * @param formElement - Optional form element to query for DOM fallback
 * @returns Validation result with normalized phone number
 */
export function validatePhone(
  phoneValue: string,
  formElement?: HTMLFormElement | null
): PhoneValidationResult {
  let value = phoneValue;

  // Handle edge case: if phone is empty or just dial code, try to get value from DOM
  if (!value || value === '+49' || value === '+1') {
    if (formElement) {
      const domInput = formElement.querySelector<HTMLInputElement>(
        'input[type="tel"], input.react-international-phone-input'
      );
      if (domInput?.value) {
        value = domInput.value;
      }
    }
  }

  const normalized = normalizePhoneNumber(value || '');

  if (!normalized) {
    return {
      isValid: false,
      normalized: null,
      error: 'Bitte gib eine gültige Handynummer ein.',
    };
  }

  return {
    isValid: true,
    normalized,
  };
}
