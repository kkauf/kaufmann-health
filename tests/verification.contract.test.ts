/**
 * Contract validation tests for verification API
 * 
 * These tests ensure that:
 * 1. The API contract (SendCodeInput, VerifyCodeInput) is correctly defined
 * 2. Common field name mistakes are caught at compile/test time
 * 3. Client code patterns match the expected contract
 * 
 * This prevents regressions like using `contact_method` instead of `contact_type`.
 */

import { describe, it, expect } from 'vitest';
import { SendCodeInput, VerifyCodeInput } from '@/contracts/verification';

describe('Verification API Contract', () => {
  describe('SendCodeInput schema', () => {
    it('requires contact field (not contact_value)', () => {
      // Valid: uses 'contact'
      const validResult = SendCodeInput.safeParse({
        contact: 'test@example.com',
        contact_type: 'email',
      });
      expect(validResult.success).toBe(true);

      // Invalid: uses 'contact_value' instead of 'contact'
      const invalidResult = SendCodeInput.safeParse({
        contact_value: 'test@example.com', // WRONG field name
        contact_type: 'email',
      });
      expect(invalidResult.success).toBe(false);
    });

    it('requires contact_type field (not contact_method)', () => {
      // Valid: uses 'contact_type'
      const validResult = SendCodeInput.safeParse({
        contact: 'test@example.com',
        contact_type: 'email',
      });
      expect(validResult.success).toBe(true);

      // Invalid: uses 'contact_method' instead of 'contact_type'
      const invalidResult = SendCodeInput.safeParse({
        contact: 'test@example.com',
        contact_method: 'email', // WRONG field name
      });
      expect(invalidResult.success).toBe(false);
    });

    it('validates contact_type is email or phone', () => {
      const emailResult = SendCodeInput.safeParse({
        contact: 'test@example.com',
        contact_type: 'email',
      });
      expect(emailResult.success).toBe(true);

      const phoneResult = SendCodeInput.safeParse({
        contact: '+4917612345678',
        contact_type: 'phone',
      });
      expect(phoneResult.success).toBe(true);

      const invalidResult = SendCodeInput.safeParse({
        contact: 'test@example.com',
        contact_type: 'sms', // Invalid value
      });
      expect(invalidResult.success).toBe(false);
    });

    it('accepts optional draft_booking with correct structure', () => {
      const result = SendCodeInput.safeParse({
        contact: '+4917612345678',
        contact_type: 'phone',
        name: 'Test User',
        draft_booking: {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          date_iso: '2025-01-15',
          time_label: '10:00',
          format: 'online',
        },
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional draft_contact with correct structure', () => {
      const result = SendCodeInput.safeParse({
        contact: 'test@example.com',
        contact_type: 'email',
        name: 'Test User',
        draft_contact: {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          contact_type: 'booking',
          patient_reason: 'Test reason',
          patient_message: 'Test message',
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('VerifyCodeInput schema', () => {
    it('requires contact field (not contact_value)', () => {
      // Valid: uses 'contact'
      const validResult = VerifyCodeInput.safeParse({
        contact: '+4917612345678',
        contact_type: 'phone',
        code: '123456',
      });
      expect(validResult.success).toBe(true);

      // Invalid: uses 'contact_value' instead of 'contact'
      const invalidResult = VerifyCodeInput.safeParse({
        contact_value: '+4917612345678', // WRONG field name
        contact_type: 'phone',
        code: '123456',
      });
      expect(invalidResult.success).toBe(false);
    });

    it('requires contact_type field (not contact_method)', () => {
      // Valid: uses 'contact_type'
      const validResult = VerifyCodeInput.safeParse({
        contact: '+4917612345678',
        contact_type: 'phone',
        code: '123456',
      });
      expect(validResult.success).toBe(true);

      // Invalid: uses 'contact_method' instead of 'contact_type'
      const invalidResult = VerifyCodeInput.safeParse({
        contact: '+4917612345678',
        contact_method: 'phone', // WRONG field name
        code: '123456',
      });
      expect(invalidResult.success).toBe(false);
    });

    it('requires code field', () => {
      const result = VerifyCodeInput.safeParse({
        contact: '+4917612345678',
        contact_type: 'phone',
        // missing code
      });
      expect(result.success).toBe(false);
    });
  });

  describe('BookingPageClient contract compliance', () => {
    /**
     * This test documents the correct API call structure for BookingPageClient.
     * If this test fails, the BookingPageClient needs to be updated.
     */
    it('handleSendCode should use correct field names', () => {
      // Simulates what BookingPageClient.handleSendCode sends
      const sendCodePayload = {
        name: 'Test User',
        contact: 'test@example.com', // CORRECT: not contact_value
        contact_type: 'email' as const, // CORRECT: not contact_method
        draft_booking: {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          date_iso: '2025-01-15',
          time_label: '10:00',
          format: 'online' as const,
        },
      };

      const result = SendCodeInput.safeParse(sendCodePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contact).toBe('test@example.com');
        expect(result.data.contact_type).toBe('email');
      }
    });

    it('handleVerifyCode should use correct field names', () => {
      // Simulates what BookingPageClient.handleVerifyCode sends
      const verifyCodePayload = {
        contact: 'test@example.com', // CORRECT: not contact_value
        contact_type: 'email' as const, // CORRECT: not contact_method
        code: '123456',
      };

      const result = VerifyCodeInput.safeParse(verifyCodePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contact).toBe('test@example.com');
        expect(result.data.contact_type).toBe('email');
        expect(result.data.code).toBe('123456');
      }
    });
  });

  describe('ContactModal contract compliance (via useVerification)', () => {
    /**
     * Documents correct API call structure used by ContactModal via useVerification hook.
     */
    it('sendCode should use correct field names', () => {
      const sendCodePayload = {
        contact: '+4917612345678',
        contact_type: 'phone' as const,
        name: 'Test User',
        draft_contact: {
          therapist_id: '550e8400-e29b-41d4-a716-446655440000',
          contact_type: 'consultation' as const,
          patient_reason: 'Test reason',
          patient_message: 'Test message',
          session_format: 'online' as const,
        },
      };

      const result = SendCodeInput.safeParse(sendCodePayload);
      expect(result.success).toBe(true);
    });

    it('verifyCode should use correct field names', () => {
      const verifyCodePayload = {
        contact: '+4917612345678',
        contact_type: 'phone' as const,
        code: '123456',
      };

      const result = VerifyCodeInput.safeParse(verifyCodePayload);
      expect(result.success).toBe(true);
    });
  });
});

describe('Common API call mistakes (regression prevention)', () => {
  it('rejects contact_value (common mistake)', () => {
    const result = SendCodeInput.safeParse({
      contact_value: 'test@example.com',
      contact_type: 'email',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some(i => i.path.includes('contact'))).toBe(true);
  });

  it('rejects contact_method (common mistake)', () => {
    const result = SendCodeInput.safeParse({
      contact: 'test@example.com',
      contact_method: 'email',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some(i => i.path.includes('contact_type'))).toBe(true);
  });

  it('rejects email_address (common mistake)', () => {
    const result = SendCodeInput.safeParse({
      email_address: 'test@example.com',
      contact_type: 'email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects phone_number at top level (common mistake)', () => {
    const result = SendCodeInput.safeParse({
      phone_number: '+4917612345678',
      contact_type: 'phone',
    });
    expect(result.success).toBe(false);
  });
});
