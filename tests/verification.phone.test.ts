/**
 * EARTH-191: Phone number validation and formatting tests
 */

import { describe, it, expect } from 'vitest';
import { 
  normalizePhoneNumber, 
  formatPhoneForDisplay, 
  isValidGermanMobile,
  formatPhoneInput 
} from '@/lib/verification/phone';

describe('Phone validation and formatting', () => {
  describe('normalizePhoneNumber', () => {
    it('normalizes various German mobile formats to E.164', () => {
      expect(normalizePhoneNumber('0176 123 45678')).toBe('+4917612345678');
      expect(normalizePhoneNumber('+49 176 123 45678')).toBe('+4917612345678');
      expect(normalizePhoneNumber('00491761234567')).toBe('+491761234567'); // 0049 prefix
      expect(normalizePhoneNumber('0176-123-456-78')).toBe('+4917612345678');
    });

    it('accepts valid German mobile prefixes (15x, 16x, 17x)', () => {
      expect(normalizePhoneNumber('015112345678')).toBe('+4915112345678');
      expect(normalizePhoneNumber('016012345678')).toBe('+4916012345678');
      expect(normalizePhoneNumber('017912345678')).toBe('+4917912345678');
    });

    it('rejects invalid prefixes for German numbers', () => {
      expect(normalizePhoneNumber('01234567890')).toBeNull(); // Invalid prefix
      expect(normalizePhoneNumber('030123456')).toBeNull(); // Landline
    });

    it('accepts valid international E.164 numbers', () => {
      expect(normalizePhoneNumber('+12125551234')).toBe('+12125551234'); // US
      expect(normalizePhoneNumber('+447700900123')).toBe('+447700900123'); // UK
      expect(normalizePhoneNumber('+33612345678')).toBe('+33612345678'); // France
    });

    it('rejects too short/long numbers', () => {
      expect(normalizePhoneNumber('0176123')).toBeNull(); // Too short
      expect(normalizePhoneNumber('0176123456789012')).toBeNull(); // Too long
    });
  });

  describe('formatPhoneForDisplay', () => {
    it('formats E.164 to display format', () => {
      expect(formatPhoneForDisplay('+4917612345678')).toBe('0176 123 45678');
      expect(formatPhoneForDisplay('+4915112345678')).toBe('0151 123 45678');
    });
  });

  describe('isValidGermanMobile', () => {
    it('validates German mobile numbers', () => {
      expect(isValidGermanMobile('0176 123 45678')).toBe(true);
      expect(isValidGermanMobile('+49 176 123 45678')).toBe(true);
      expect(isValidGermanMobile('015112345678')).toBe(true);
    });

    it('validates international numbers', () => {
      expect(isValidGermanMobile('+12125551234')).toBe(true); // US
      expect(isValidGermanMobile('+447700900123')).toBe(true); // UK
    });

    it('rejects invalid numbers', () => {
      expect(isValidGermanMobile('030123456')).toBe(false); // German landline
      expect(isValidGermanMobile('invalid')).toBe(false);
      expect(isValidGermanMobile('+1234')).toBe(false); // Too short
      expect(isValidGermanMobile('+12345678901234567')).toBe(false); // Too long
    });
  });

  describe('formatPhoneInput', () => {
    it('formats as user types with spaces', () => {
      expect(formatPhoneInput('0176')).toBe('0176');
      expect(formatPhoneInput('0176123')).toBe('0176 123');
      expect(formatPhoneInput('0176123456')).toBe('0176 123 456');
      expect(formatPhoneInput('017612345678')).toBe('0176 123 45678');
    });

    it('handles +49 prefix', () => {
      expect(formatPhoneInput('+49176')).toBe('0176');
      expect(formatPhoneInput('+49176123456')).toBe('0176 123 456');
    });

    it('limits to 12 digits total', () => {
      // Should truncate overly long input
      expect(formatPhoneInput('0176123456789999').length).toBeLessThanOrEqual(14); // 12 digits + 2 spaces max
    });

    it('removes non-digit characters', () => {
      expect(formatPhoneInput('0176-123-456')).toBe('0176 123 456');
      expect(formatPhoneInput('0176 abc 123')).toBe('0176 123');
    });
  });
});
