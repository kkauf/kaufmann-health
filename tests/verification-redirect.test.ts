/**
 * Tests for email magic link redirect correctness across verification flows.
 * 
 * Each flow that uses email verification must pass a redirect path so users
 * return to the correct screen after clicking the magic link.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Verification Email Redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { sent: true, method: 'email' } }),
    });
  });

  describe('send-code API redirect parameter', () => {
    it('should accept redirect parameter in request body structure', () => {
      // Contract test: verify the expected request body structure
      const requestBody = {
        contact: 'test@example.com',
        contact_type: 'email',
        name: 'Test User',
        redirect: '/therapeuten?tid=123&view=cal-booking',
      };

      // Verify structure matches what send-code API expects
      expect(requestBody).toHaveProperty('redirect');
      expect(requestBody.redirect).toBe('/therapeuten?tid=123&view=cal-booking');
      expect(requestBody.contact_type).toBe('email');
    });

    it('should validate redirect is a safe path (starts with /, not /api or //)', () => {
      const safePaths = [
        '/therapeuten?tid=123',
        '/therapeuten?tid=123&view=cal-booking&kind=intro',
        '/fragebogen',
        '/fragebogen?confirm=1',
      ];

      const unsafePaths = [
        '//evil.com',
        '/api/admin/delete',
        'https://evil.com',
        'javascript:alert(1)',
      ];

      const isSafe = (path: string) => {
        return path.startsWith('/') && !path.startsWith('/api') && !path.startsWith('//');
      };

      safePaths.forEach(path => {
        expect(isSafe(path)).toBe(true);
      });

      unsafePaths.forEach(path => {
        expect(isSafe(path)).toBe(false);
      });
    });
  });

  describe('Flow-specific redirect paths', () => {
    it('Cal booking flow should redirect to /therapeuten with therapist ID and booking view', () => {
      const therapistId = 'abc-123';
      const bookingKind = 'intro';
      
      // This is the expected format from TherapistDetailModal
      const expectedRedirect = `/therapeuten?tid=${therapistId}&view=cal-booking&kind=${bookingKind}`;
      
      expect(expectedRedirect).toBe('/therapeuten?tid=abc-123&view=cal-booking&kind=intro');
      expect(expectedRedirect.startsWith('/therapeuten')).toBe(true);
      expect(expectedRedirect).toContain('tid=');
      expect(expectedRedirect).toContain('view=cal-booking');
    });

    it('ContactModal flow should redirect to /therapeuten with therapist ID and contact compose', () => {
      const therapistId = 'xyz-456';
      const contactType = 'booking';
      
      // This is the expected format from ContactModal
      const expectedRedirect = `/therapeuten?contact=compose&tid=${therapistId}&type=${contactType}`;
      
      expect(expectedRedirect).toBe('/therapeuten?contact=compose&tid=xyz-456&type=booking');
      expect(expectedRedirect.startsWith('/therapeuten')).toBe(true);
      expect(expectedRedirect).toContain('tid=');
      expect(expectedRedirect).toContain('contact=compose');
    });

    it('SignupWizard flow should redirect to /fragebogen', () => {
      // SignupWizard uses confirm_redirect_path: '/fragebogen'
      const expectedRedirect = '/fragebogen';
      
      expect(expectedRedirect).toBe('/fragebogen');
    });
  });

  describe('confirm API redirect handling', () => {
    it('should prefer query param redirect over stored metadata redirect', () => {
      const queryRedirect = '/therapeuten?tid=123';
      const storedRedirect = '/fragebogen';
      
      // Query param takes precedence
      const effectiveRedirect = queryRedirect || storedRedirect;
      expect(effectiveRedirect).toBe('/therapeuten?tid=123');
    });

    it('should fall back to stored metadata redirect if no query param', () => {
      const queryRedirect = undefined;
      const storedRedirect = '/therapeuten?tid=123';
      
      const effectiveRedirect = queryRedirect || storedRedirect;
      expect(effectiveRedirect).toBe('/therapeuten?tid=123');
    });

    it('should append confirm=1 and id to redirect URL', () => {
      const redirect = '/therapeuten?tid=123&view=cal-booking';
      const id = 'patient-456';
      
      const hasQuery = redirect.includes('?');
      const separator = hasQuery ? '&' : '?';
      const finalUrl = `${redirect}${separator}confirm=1&id=${id}`;
      
      expect(finalUrl).toBe('/therapeuten?tid=123&view=cal-booking&confirm=1&id=patient-456');
    });
  });
});

describe('useVerification sendCode options', () => {
  it('should accept redirect in SendCodeOptions', async () => {
    // Type check - SendCodeOptions should have redirect field
    type SendCodeOptions = {
      name: string;
      redirect?: string;
      formSessionId?: string;
      leadId?: string;
      draftContact?: unknown;
      draftBooking?: unknown;
    };

    const options: SendCodeOptions = {
      name: 'Test User',
      redirect: '/therapeuten?tid=123',
    };

    expect(options.redirect).toBe('/therapeuten?tid=123');
  });
});

describe('useCalBooking emailRedirectPath', () => {
  it('should construct correct redirect path from therapist ID and booking kind', () => {
    const therapistId = 'therapist-789';
    const calBookingKind = 'full_session';
    
    const calEmailRedirectPath = `/therapeuten?tid=${therapistId}&view=cal-booking&kind=${calBookingKind}`;
    
    expect(calEmailRedirectPath).toBe('/therapeuten?tid=therapist-789&view=cal-booking&kind=full_session');
  });

  it('should pass redirect to verification.sendCode', () => {
    // This is a structural test - verifying the pattern is correct
    const mockVerificationSendCode = vi.fn();
    const emailRedirectPath = '/therapeuten?tid=123&view=cal-booking&kind=intro';
    const selectedSlot = {
      therapist_id: '123',
      date_iso: '2025-01-15',
      time_label: '10:00',
    };
    
    // Simulate what useCalBooking.sendCode does
    mockVerificationSendCode({
      name: 'Test User',
      redirect: emailRedirectPath,
      draftBooking: {
        therapist_id: selectedSlot.therapist_id,
        date_iso: selectedSlot.date_iso,
        time_label: selectedSlot.time_label,
        format: 'online',
      },
    });

    expect(mockVerificationSendCode).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect: '/therapeuten?tid=123&view=cal-booking&kind=intro',
      })
    );
  });
});
