/**
 * Unit tests for useVerification hook
 * Tests the shared verification logic used by SignupWizard and ContactModal
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVerification } from '@/lib/verification/useVerification';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useVerification hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useVerification());
      
      expect(result.current.state).toEqual({
        step: 'input',
        contactMethod: 'phone',
        name: '',
        email: '',
        phone: '',
        code: '',
        loading: false,
        error: null,
        verified: false,
        patientId: null,
      });
    });

    it('should accept initial contact method', () => {
      const { result } = renderHook(() => 
        useVerification({ initialContactMethod: 'email' })
      );
      
      expect(result.current.state.contactMethod).toBe('email');
    });
  });

  describe('state setters', () => {
    it('should update name', () => {
      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setName('Max Mustermann');
      });
      
      expect(result.current.state.name).toBe('Max Mustermann');
    });

    it('should update email', () => {
      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setEmail('test@example.com');
      });
      
      expect(result.current.state.email).toBe('test@example.com');
    });

    it('should update phone', () => {
      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setPhone('0176 123 45678');
      });
      
      expect(result.current.state.phone).toBe('0176 123 45678');
    });

    it('should update code', () => {
      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setCode('123456');
      });
      
      expect(result.current.state.code).toBe('123456');
    });

    it('should update contact method', () => {
      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setContactMethod('email');
      });
      
      expect(result.current.state.contactMethod).toBe('email');
    });

    it('should update error', () => {
      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setError('Test error');
      });
      
      expect(result.current.state.error).toBe('Test error');
    });
  });

  describe('validation helpers', () => {
    describe('isEmailValid', () => {
      it('should return true for valid email', () => {
        const { result } = renderHook(() => useVerification());
        
        act(() => {
          result.current.setEmail('test@example.com');
        });
        
        expect(result.current.isEmailValid()).toBe(true);
      });

      it('should return false for invalid email', () => {
        const { result } = renderHook(() => useVerification());
        
        act(() => {
          result.current.setEmail('invalid-email');
        });
        
        expect(result.current.isEmailValid()).toBe(false);
      });

      it('should return false for empty email', () => {
        const { result } = renderHook(() => useVerification());
        expect(result.current.isEmailValid()).toBe(false);
      });
    });

    describe('isPhoneValid', () => {
      it('should return true for valid German mobile', () => {
        const { result } = renderHook(() => useVerification());
        
        act(() => {
          result.current.setPhone('0176 123 45678');
        });
        
        expect(result.current.isPhoneValid()).toBe(true);
      });

      it('should return true for valid international format', () => {
        const { result } = renderHook(() => useVerification());
        
        act(() => {
          result.current.setPhone('+4917612345678');
        });
        
        expect(result.current.isPhoneValid()).toBe(true);
      });

      it('should return false for invalid phone', () => {
        const { result } = renderHook(() => useVerification());
        
        act(() => {
          result.current.setPhone('123');
        });
        
        expect(result.current.isPhoneValid()).toBe(false);
      });
    });

    describe('validateInputs', () => {
      it('should fail when name is empty', () => {
        const { result } = renderHook(() => useVerification());
        
        act(() => {
          result.current.setPhone('0176 123 45678');
        });
        
        const validation = result.current.validateInputs();
        expect(validation.valid).toBe(false);
        expect(validation.error).toContain('Namen');
      });

      it('should fail when email is invalid (email method)', () => {
        const { result } = renderHook(() => 
          useVerification({ initialContactMethod: 'email' })
        );
        
        act(() => {
          result.current.setName('Max');
          result.current.setEmail('invalid');
        });
        
        const validation = result.current.validateInputs();
        expect(validation.valid).toBe(false);
        expect(validation.error).toContain('E-Mail');
      });

      it('should fail when phone is invalid (phone method)', () => {
        const { result } = renderHook(() => useVerification());
        
        act(() => {
          result.current.setName('Max');
          result.current.setPhone('123');
        });
        
        const validation = result.current.validateInputs();
        expect(validation.valid).toBe(false);
        expect(validation.error).toContain('Handynummer');
      });

      it('should pass with valid name and phone', () => {
        const { result } = renderHook(() => useVerification());
        
        act(() => {
          result.current.setName('Max Mustermann');
          result.current.setPhone('0176 123 45678');
        });
        
        const validation = result.current.validateInputs();
        expect(validation.valid).toBe(true);
        expect(validation.error).toBeUndefined();
      });

      it('should pass with valid name and email', () => {
        const { result } = renderHook(() => 
          useVerification({ initialContactMethod: 'email' })
        );
        
        act(() => {
          result.current.setName('Max Mustermann');
          result.current.setEmail('test@example.com');
        });
        
        const validation = result.current.validateInputs();
        expect(validation.valid).toBe(true);
      });
    });

    describe('getContact', () => {
      it('should return normalized phone for phone method', () => {
        const { result } = renderHook(() => useVerification());
        
        act(() => {
          result.current.setPhone('0176 123 45678');
        });
        
        expect(result.current.getContact()).toBe('+4917612345678');
      });

      it('should return trimmed email for email method', () => {
        const { result } = renderHook(() => 
          useVerification({ initialContactMethod: 'email' })
        );
        
        act(() => {
          result.current.setEmail('  test@example.com  ');
        });
        
        expect(result.current.getContact()).toBe('test@example.com');
      });

      it('should return null for invalid contact', () => {
        const { result } = renderHook(() => useVerification());
        
        act(() => {
          result.current.setPhone('invalid');
        });
        
        expect(result.current.getContact()).toBeNull();
      });
    });
  });

  describe('sendCode', () => {
    it('should fail validation if inputs are invalid', async () => {
      const { result } = renderHook(() => useVerification());
      
      let sendResult: { success: boolean; error?: string };
      await act(async () => {
        sendResult = await result.current.sendCode({ name: '' });
      });
      
      expect(sendResult!.success).toBe(false);
      expect(sendResult!.error).toContain('Namen');
      expect(result.current.state.error).toContain('Namen');
    });

    it('should send code successfully for phone', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { sent: true } }),
      });

      const onTrackEvent = vi.fn();
      const { result } = renderHook(() => 
        useVerification({ onTrackEvent })
      );
      
      act(() => {
        result.current.setName('Max Mustermann');
        result.current.setPhone('0176 123 45678');
      });
      
      let sendResult: { success: boolean };
      await act(async () => {
        sendResult = await result.current.sendCode({ name: 'Max Mustermann' });
      });
      
      expect(sendResult!.success).toBe(true);
      expect(result.current.state.step).toBe('code');
      expect(result.current.state.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/public/verification/send-code',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('+4917612345678'),
        })
      );
      expect(onTrackEvent).toHaveBeenCalledWith('verification_code_sent', expect.any(Object));
    });

    it('should send code successfully for email (6-digit code)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { sent: true } }),
      });

      const { result } = renderHook(() => 
        useVerification({ initialContactMethod: 'email' })
      );
      
      act(() => {
        result.current.setName('Max Mustermann');
        result.current.setEmail('test@example.com');
      });
      
      let sendResult: { success: boolean };
      await act(async () => {
        sendResult = await result.current.sendCode({ name: 'Max Mustermann' });
      });
      
      expect(sendResult!.success).toBe(true);
      // Email now uses 6-digit code just like SMS
      expect(result.current.state.step).toBe('code');
    });

    it('should handle API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });

      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setName('Max');
        result.current.setPhone('0176 123 45678');
      });
      
      let sendResult: { success: boolean; error?: string };
      await act(async () => {
        sendResult = await result.current.sendCode({ name: 'Max' });
      });
      
      expect(sendResult!.success).toBe(false);
      expect(sendResult!.error).toBe('Server error');
      expect(result.current.state.error).toBe('Server error');
    });

    it('should handle fallback to email', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { fallback: 'email' } }),
      });

      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setName('Max');
        result.current.setPhone('0176 123 45678');
      });
      
      let sendResult: { success: boolean; fallbackToEmail?: boolean };
      await act(async () => {
        sendResult = await result.current.sendCode({ name: 'Max' });
      });
      
      expect(sendResult!.success).toBe(false);
      expect(sendResult!.fallbackToEmail).toBe(true);
    });

    it('should include campaign headers when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { sent: true } }),
      });

      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setName('Max');
        result.current.setPhone('0176 123 45678');
      });
      
      await act(async () => {
        await result.current.sendCode({
          name: 'Max',
          campaignSource: '/start',
          campaignVariant: 'self-service',
          gclid: 'test-gclid',
        });
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/public/verification/send-code',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Campaign-Source-Override': '/start',
            'X-Campaign-Variant-Override': 'self-service',
            'X-Gclid': 'test-gclid',
          }),
        })
      );
    });

    it('should include draft contact when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { sent: true } }),
      });

      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setName('Max');
        result.current.setPhone('0176 123 45678');
      });
      
      const draftContact = {
        therapist_id: 'therapist-123',
        contact_type: 'booking' as const,
        patient_reason: 'Test reason',
      };
      
      await act(async () => {
        await result.current.sendCode({ name: 'Max', draftContact });
      });
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.draft_contact).toEqual(draftContact);
    });

    it('should set loading state during request', async () => {
      let resolvePromise: (value: unknown) => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      
      mockFetch.mockReturnValueOnce(delayedPromise);

      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setName('Max');
        result.current.setPhone('0176 123 45678');
      });
      
      let sendPromise: Promise<{ success: boolean }>;
      act(() => {
        sendPromise = result.current.sendCode({ name: 'Max' });
      });
      
      // Should be loading while request is in progress
      expect(result.current.state.loading).toBe(true);
      
      // Resolve the fetch
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({ data: { sent: true } }),
        });
        await sendPromise;
      });
      
      expect(result.current.state.loading).toBe(false);
    });
  });

  describe('verifyCode', () => {
    it('should fail if contact is invalid', async () => {
      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setCode('123456');
      });
      
      let verifyResult: { success: boolean; error?: string };
      await act(async () => {
        verifyResult = await result.current.verifyCode();
      });
      
      expect(verifyResult!.success).toBe(false);
      expect(verifyResult!.error).toContain('Kontaktinformation');
    });

    it('should fail if code is empty', async () => {
      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setPhone('0176 123 45678');
      });
      
      let verifyResult: { success: boolean; error?: string };
      await act(async () => {
        verifyResult = await result.current.verifyCode();
      });
      
      expect(verifyResult!.success).toBe(false);
      expect(verifyResult!.error).toContain('Bestätigungscode');
    });

    it('should verify code successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { verified: true } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { patient_id: 'patient-123' } }),
        });

      const onVerified = vi.fn();
      const onTrackEvent = vi.fn();
      const { result } = renderHook(() => 
        useVerification({ onVerified, onTrackEvent })
      );
      
      act(() => {
        result.current.setPhone('0176 123 45678');
        result.current.setCode('123456');
      });
      
      let verifyResult: { success: boolean; patientId?: string };
      await act(async () => {
        verifyResult = await result.current.verifyCode();
      });
      
      expect(verifyResult!.success).toBe(true);
      expect(verifyResult!.patientId).toBe('patient-123');
      expect(result.current.state.verified).toBe(true);
      expect(result.current.state.step).toBe('verified');
      expect(result.current.state.patientId).toBe('patient-123');
      expect(onVerified).toHaveBeenCalledWith('patient-123');
      expect(onTrackEvent).toHaveBeenCalledWith('verification_completed', expect.any(Object));
    });

    it('should handle invalid code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ data: { verified: false } }),
      });

      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setPhone('0176 123 45678');
        result.current.setCode('wrong');
      });
      
      let verifyResult: { success: boolean; error?: string };
      await act(async () => {
        verifyResult = await result.current.verifyCode();
      });
      
      expect(verifyResult!.success).toBe(false);
      expect(verifyResult!.error).toBe('Ungültiger Code');
      expect(result.current.state.error).toBe('Ungültiger Code');
      expect(result.current.state.verified).toBe(false);
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setPhone('0176 123 45678');
        result.current.setCode('123456');
      });
      
      let verifyResult: { success: boolean; error?: string };
      await act(async () => {
        verifyResult = await result.current.verifyCode();
      });
      
      expect(verifyResult!.success).toBe(false);
      expect(verifyResult!.error).toBe('Network error');
    });
  });

  describe('resendCode', () => {
    it('should resend code using current state', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { sent: true } }),
      });

      const { result } = renderHook(() => useVerification());
      
      act(() => {
        result.current.setName('Max Mustermann');
        result.current.setPhone('0176 123 45678');
      });
      
      // First send
      await act(async () => {
        await result.current.sendCode({ name: 'Max Mustermann' });
      });
      
      // Resend
      let resendResult: { success: boolean };
      await act(async () => {
        resendResult = await result.current.resendCode();
      });
      
      expect(resendResult!.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { sent: true } }),
      });

      const { result } = renderHook(() => useVerification());
      
      // Populate state
      act(() => {
        result.current.setName('Max');
        result.current.setEmail('test@example.com');
        result.current.setPhone('0176 123 45678');
        result.current.setCode('123456');
        result.current.setError('Some error');
      });
      
      // Send to change step
      await act(async () => {
        await result.current.sendCode({ name: 'Max' });
      });
      
      // Reset
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.state).toEqual({
        step: 'input',
        contactMethod: 'phone',
        name: '',
        email: '',
        phone: '',
        code: '',
        loading: false,
        error: null,
        verified: false,
        patientId: null,
      });
    });
  });

  describe('analytics tracking', () => {
    it('should track events throughout the flow', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { sent: true } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { verified: true } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { patient_id: 'patient-123' } }),
        });

      const onTrackEvent = vi.fn();
      const { result } = renderHook(() => 
        useVerification({ onTrackEvent })
      );
      
      act(() => {
        result.current.setName('Max');
        result.current.setPhone('0176 123 45678');
      });
      
      // Send code
      await act(async () => {
        await result.current.sendCode({ name: 'Max' });
      });
      
      expect(onTrackEvent).toHaveBeenCalledWith('verification_send_started', expect.any(Object));
      expect(onTrackEvent).toHaveBeenCalledWith('verification_code_sent', expect.any(Object));
      
      // Enter code and verify
      act(() => {
        result.current.setCode('123456');
      });
      
      await act(async () => {
        await result.current.verifyCode();
      });
      
      expect(onTrackEvent).toHaveBeenCalledWith('verification_verify_started', expect.any(Object));
      expect(onTrackEvent).toHaveBeenCalledWith('verification_completed', expect.any(Object));
    });

    it('should track errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Test error' }),
      });

      const onTrackEvent = vi.fn();
      const { result } = renderHook(() => 
        useVerification({ onTrackEvent })
      );
      
      act(() => {
        result.current.setName('Max');
        result.current.setPhone('0176 123 45678');
      });
      
      await act(async () => {
        await result.current.sendCode({ name: 'Max' });
      });
      
      expect(onTrackEvent).toHaveBeenCalledWith('verification_send_failed', expect.objectContaining({
        error: 'Test error',
      }));
    });
  });
});
