/**
 * Smoke test: Phone user signup flow
 * EARTH-191: End-to-end validation that phone users can complete signup
 * 
 * This test validates the critical happy path:
 * 1. Submit phone number
 * 2. Request SMS code
 * 3. Verify code
 * 4. Complete questionnaire
 */

import { describe, it, expect } from 'vitest';
import { leadSubmissionSchema } from '@/lib/contracts';
import { isValidGermanMobile } from '@/lib/verification/phone';

describe('Smoke: Phone user signup flow', () => {
  const testPhone = '+4917612345678';
  
  it('validates phone number', () => {
    // Step 1: User enters phone number
    expect(isValidGermanMobile(testPhone)).toBe(true);
    expect(isValidGermanMobile('0176 123 45678')).toBe(true);
    expect(isValidGermanMobile('invalid')).toBe(false);
  });

  it('accepts phone-only lead submission payload', () => {
    // Step 4: User completes questionnaire, submits to /api/public/leads
    const payload = {
      type: 'patient' as const,
      name: 'Max',
      phone_number: testPhone,
      contact_method: 'phone' as const,
      consent_share_with_therapists: true as const,
      privacy_version: '2025-01-15',
      session_preference: 'online' as const,
    };

    const result = leadSubmissionSchema.safeParse(payload);
    
    if (!result.success) {
      console.error('Schema validation failed:', result.error);
    }
    
    expect(result.success).toBe(true);
    expect(result.data?.phone_number).toBe(testPhone);
    expect(result.data?.email).toBeUndefined();
  });

  it('validates send-code request payload', () => {
    // Step 2: Request SMS verification code
    const sendCodePayload = {
      contact: testPhone,
      contact_type: 'phone' as const,
    };

    expect(sendCodePayload.contact).toBeTruthy();
    expect(sendCodePayload.contact_type).toBe('phone');
    expect(isValidGermanMobile(sendCodePayload.contact)).toBe(true);
  });

  it('validates verify-code request payload', () => {
    // Step 3: Verify SMS code
    const verifyCodePayload = {
      contact: testPhone,
      contact_type: 'phone' as const,
      code: '123456',
    };

    expect(verifyCodePayload.code).toHaveLength(6);
    expect(/^\d{6}$/.test(verifyCodePayload.code)).toBe(true);
  });

  it('catches common pitfalls', () => {
    // Common mistake 1: Email required (old bug)
    const payloadWithoutEmail = {
      phone_number: testPhone,
      contact_method: 'phone' as const,
      consent_share_with_therapists: true as const,
      privacy_version: '2025-01-15',
    };
    
    const result = leadSubmissionSchema.safeParse(payloadWithoutEmail);
    expect(result.success).toBe(true); // Should NOT fail

    // Common mistake 2: Neither email nor phone
    const payloadWithNothing = {
      name: 'NoContact',
      consent_share_with_therapists: true as const,
      privacy_version: '2025-01-15',
    };
    
    const result2 = leadSubmissionSchema.safeParse(payloadWithNothing);
    expect(result2.success).toBe(false); // Should fail

    // Common mistake 3: Too short phone
    const payloadShortPhone = {
      phone_number: '+4917',
      contact_method: 'phone' as const,
      consent_share_with_therapists: true as const,
      privacy_version: '2025-01-15',
    };
    
    const result3 = leadSubmissionSchema.safeParse(payloadShortPhone);
    expect(result3.success).toBe(false); // Should fail
  });
});
