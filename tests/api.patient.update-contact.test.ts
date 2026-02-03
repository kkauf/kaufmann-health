/**
 * Unit tests for POST /api/public/patient/update-contact
 *
 * Tests the post-booking contact collection API:
 * - Session auth requirement
 * - Email update for phone-only users (+ booking confirmation re-send)
 * - Phone number update for email users
 * - Validation (invalid email, invalid phone, missing fields)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock client session
const mockGetClientSession = vi.fn();
vi.mock('@/lib/auth/clientSession', () => ({
  getClientSession: (...args: unknown[]) => mockGetClientSession(...args),
}));

// Mock supabase with chainable API
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockSingle = vi.fn();
const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'people') {
    return { select: mockSelect, update: mockUpdate };
  }
  if (table === 'cal_bookings') {
    return { select: mockSelect };
  }
  if (table === 'therapists') {
    return { select: mockSelect };
  }
  return { select: mockSelect, update: mockUpdate };
});

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: { from: mockFrom },
}));

// Mock email
const mockSendEmail = vi.fn().mockResolvedValue({ sent: true });
vi.mock('@/lib/email/client', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// Mock email template
vi.mock('@/lib/email/templates/calBookingClientConfirmation', () => ({
  renderCalBookingClientConfirmation: vi.fn().mockReturnValue({
    subject: 'Test booking confirmation',
    html: '<p>Booking confirmed</p>',
  }),
}));

// Mock logger
const mockLogError = vi.fn();
const mockTrack = vi.fn();
vi.mock('@/lib/logger', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  track: (...args: unknown[]) => mockTrack(...args),
}));

// Mock phone normalization
vi.mock('@/lib/verification/phone', () => ({
  normalizePhoneNumber: (input: string) => {
    if (input.startsWith('+') && input.length >= 10) return input;
    return null;
  },
}));

const PATIENT_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('POST /api/public/patient/update-contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: valid session
    mockGetClientSession.mockResolvedValue({
      patient_id: PATIENT_ID,
      contact_method: 'phone',
      contact_value: '+4917612345678',
      name: 'Test Patient',
    });
    // Default: update succeeds
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function callRoute(body: object, cookies?: string) {
    const { POST } = await import('@/app/api/public/patient/update-contact/route');

    const headers = new Headers({
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      'user-agent': 'test-agent',
    });
    if (cookies) {
      headers.set('cookie', cookies);
    }

    const req = new NextRequest('http://localhost/api/public/patient/update-contact', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    return POST(req);
  }

  describe('Authentication', () => {
    it('returns 401 when no session cookie', async () => {
      mockGetClientSession.mockResolvedValue(null);

      const response = await callRoute({ email: 'test@example.com' });
      expect(response.status).toBe(401);
    });

    it('returns 401 when session has no patient_id', async () => {
      mockGetClientSession.mockResolvedValue({ verified: true });

      const response = await callRoute({ email: 'test@example.com' });
      expect(response.status).toBe(401);
    });
  });

  describe('Validation', () => {
    it('rejects when neither email nor phone provided', async () => {
      const response = await callRoute({});
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBeTruthy();
    });

    it('rejects invalid email format', async () => {
      const response = await callRoute({ email: 'not-an-email' });

      expect(response.status).toBe(400);
    });

    it('rejects too-short phone number', async () => {
      const response = await callRoute({ phone_number: '123' });

      expect(response.status).toBe(400);
    });

    it('rejects phone number that fails normalization', async () => {
      // 5+ chars but not a valid international number (no + prefix)
      const response = await callRoute({ phone_number: '12345' });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain('Telefonnummer');
    });
  });

  describe('Email Update', () => {
    it('updates people record with lowercase email', async () => {
      const response = await callRoute({ email: 'Test@Example.COM' });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.updated).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('people');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' })
      );
    });

    it('tracks patient_contact_updated event', async () => {
      await callRoute({ email: 'test@example.com' });

      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'patient_contact_updated',
          props: expect.objectContaining({
            patient_id: PATIENT_ID,
            added_email: true,
            added_phone: false,
          }),
        })
      );
    });
  });

  describe('Phone Update', () => {
    it('updates people record with normalized phone number', async () => {
      mockGetClientSession.mockResolvedValue({
        patient_id: PATIENT_ID,
        contact_method: 'email',
        contact_value: 'test@example.com',
      });

      const response = await callRoute({ phone_number: '+4917612345678' });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.updated).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ phone_number: '+4917612345678' })
      );
    });
  });

  describe('Booking Confirmation Re-send', () => {
    it('sends booking confirmation when email + booking_uid provided', async () => {
      const mockBooking = {
        id: 'booking-id',
        patient_id: PATIENT_ID,
        therapist_id: 'therapist-id',
        start_time: '2026-02-10T14:00:00Z',
        status: 'ACCEPTED',
        booking_kind: 'intro',
        metadata: { videoCallUrl: 'https://cal.example.com/video/test' },
      };

      const mockTherapist = {
        first_name: 'Test',
        last_name: 'Therapeut',
        email: 'therapeut@example.com',
        typical_rate: 120,
        metadata: {},
      };

      const mockPatient = { name: 'Test Patient' };

      // Build per-table mock chains so each from() call resolves correctly
      mockFrom.mockImplementation((table: string) => {
        if (table === 'people') {
          // First call = update, second call = select for patient name
          return {
            update: mockUpdate,
            select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockPatient, error: null }) }) }),
          };
        }
        if (table === 'cal_bookings') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockBooking, error: null }) }) }) }),
          };
        }
        if (table === 'therapists') {
          return {
            select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: mockTherapist, error: null }) }) }),
          };
        }
        return { select: mockSelect, update: mockUpdate };
      });

      const response = await callRoute({
        email: 'patient@example.com',
        booking_uid: 'test-booking-uid',
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.updated).toBe(true);
      expect(json.data.confirmation_sent).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'patient@example.com',
          context: expect.objectContaining({
            kind: 'booking_confirmation_resend',
            booking_uid: 'test-booking-uid',
          }),
        })
      );
    });

    it('does not send confirmation when no booking_uid', async () => {
      const response = await callRoute({ email: 'patient@example.com' });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.confirmation_sent).toBe(false);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('still succeeds if confirmation email fails (non-fatal)', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'booking-id',
          patient_id: PATIENT_ID,
          therapist_id: 'therapist-id',
          start_time: '2026-02-10T14:00:00Z',
          status: 'ACCEPTED',
          booking_kind: 'intro',
          metadata: {},
        },
        error: null,
      });
      mockSendEmail.mockRejectedValueOnce(new Error('SMTP error'));

      const response = await callRoute({
        email: 'patient@example.com',
        booking_uid: 'test-uid',
      });
      const json = await response.json();

      // Contact was saved, but confirmation failed
      expect(response.status).toBe(200);
      expect(json.data.updated).toBe(true);
    });

    it('skips confirmation for cancelled bookings', async () => {
      const cancelledBooking = {
        id: 'booking-id',
        patient_id: PATIENT_ID,
        therapist_id: 'therapist-id',
        start_time: '2026-02-10T14:00:00Z',
        status: 'CANCELLED',
        booking_kind: 'intro',
        metadata: {},
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'people') {
          return { update: mockUpdate };
        }
        if (table === 'cal_bookings') {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: cancelledBooking, error: null }) }) }) }),
          };
        }
        return { select: mockSelect, update: mockUpdate };
      });

      const response = await callRoute({
        email: 'patient@example.com',
        booking_uid: 'cancelled-uid',
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(json.data.confirmation_sent).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('returns 500 when DB update fails', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      });

      const response = await callRoute({ email: 'test@example.com' });

      expect(response.status).toBe(500);
      expect(mockLogError).toHaveBeenCalled();
    });
  });
});
