/**
 * Contract validation tests for lead submission schema
 * CRITICAL: These tests validate the schema accepts valid payloads
 * Catches bugs like "email required but phone users don't have email"
 */

import { describe, it, expect } from 'vitest';
import { leadSubmissionSchema } from '@/lib/contracts';

describe('leadSubmissionSchema validation', () => {
  const basePayload = {
    consent_share_with_therapists: true as const,
    privacy_version: '2025-01-15',
  };

  describe('Email users (backward compatibility)', () => {
    it('accepts valid email-only submission', () => {
      const payload = {
        ...basePayload,
        name: 'Anna',
        email: 'anna@example.com',
        contact_method: 'email' as const,
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('anna@example.com');
        expect(result.data.phone_number).toBeUndefined();
      }
    });

    it('accepts email without contact_method (legacy)', () => {
      const payload = {
        ...basePayload,
        email: 'legacy@example.com',
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('Phone users (EARTH-191)', () => {
    it('accepts valid phone-only submission', () => {
      const payload = {
        ...basePayload,
        name: 'Max',
        phone_number: '+4917612345678',
        contact_method: 'phone' as const,
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.phone_number).toBe('+4917612345678');
        expect(result.data.email).toBeUndefined();
        expect(result.data.contact_method).toBe('phone');
      }
    });

    it('accepts phone without email', () => {
      // This was the bug: schema required email, failed for phone users
      const payload = {
        ...basePayload,
        phone_number: '+4915112345678',
        contact_method: 'phone' as const,
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('validates minimum phone length', () => {
      const payload = {
        ...basePayload,
        phone_number: '+4917', // Too short
        contact_method: 'phone' as const,
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('phone_number');
      }
    });
  });

  describe('Dual contact (both email and phone)', () => {
    it('accepts both email and phone', () => {
      const payload = {
        ...basePayload,
        email: 'both@example.com',
        phone_number: '+4917612345678',
        contact_method: 'phone' as const,
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation failures', () => {
    it('rejects submission without email or phone', () => {
      const payload = {
        ...basePayload,
        name: 'NoContact',
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Either email or phone_number is required');
      }
    });

    it('rejects invalid email format', () => {
      const payload = {
        ...basePayload,
        email: 'not-an-email',
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects missing consent', () => {
      const payload = {
        email: 'test@example.com',
        privacy_version: '2025-01-15',
        // Missing consent_share_with_therapists
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects missing privacy version', () => {
      const payload = {
        email: 'test@example.com',
        consent_share_with_therapists: true as const,
        // Missing privacy_version
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Optional fields', () => {
    it('accepts session preferences', () => {
      const payload = {
        ...basePayload,
        email: 'test@example.com',
        session_preference: 'online' as const,
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.session_preference).toBe('online');
      }
    });

    it('accepts session_preferences array (either)', () => {
      const payload = {
        ...basePayload,
        email: 'test@example.com',
        session_preferences: ['online', 'in_person'] as const,
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.session_preferences).toHaveLength(2);
      }
    });

    it('accepts form_session_id and confirm_redirect_path', () => {
      const payload = {
        ...basePayload,
        email: 'test@example.com',
        form_session_id: 'fs-123',
        confirm_redirect_path: '/fragebogen',
      };

      const result = leadSubmissionSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});
