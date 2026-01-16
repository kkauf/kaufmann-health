/**
 * Unit tests for POST /api/public/cal/book
 * 
 * Tests the native booking API including:
 * - Test mode detection from kh_test cookie
 * - Metadata pre-insert to cal_bookings table
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock supabase
const mockUpsert = vi.fn().mockReturnValue({
  then: (cb: (result: { error: null }) => void) => {
    cb({ error: null });
    return { catch: () => {} };
  },
});
const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
const mockFrom = vi.fn().mockReturnValue({ 
  select: mockSelect,
  upsert: mockUpsert,
});

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: { from: mockFrom },
}));

// Mock cal/book functions
const mockCreateCalBooking = vi.fn();
const mockBuildBookingLocation = vi.fn().mockReturnValue({ 
  value: 'integrations:daily', 
  optionValue: '' 
});

vi.mock('@/lib/cal/book', () => ({
  createCalBooking: mockCreateCalBooking,
  buildBookingLocation: mockBuildBookingLocation,
  USE_NATIVE_BOOKING: true,
}));

// Mock cal/slots-db
vi.mock('@/lib/cal/slots-db', () => ({
  getEventType: vi.fn().mockResolvedValue({ eventTypeId: 123 }),
}));

// Mock analytics
vi.mock('@/lib/server-analytics', () => ({
  ServerAnalytics: {
    trackEventFromRequest: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

describe('POST /api/public/cal/book', () => {
  const THERAPIST_ID = 'e5de1fb4-90c6-4681-aa23-b4e84e7defa8';
  
  const validRequestBody = {
    therapist_id: THERAPIST_ID,
    kind: 'intro',
    slot_utc: '2026-01-20T10:00:00.000Z',
    name: 'Test Patient',
    email: 'test@example.com',
    location_type: 'video',
  };

  const mockTherapist = {
    id: THERAPIST_ID,
    first_name: 'Test',
    last_name: 'Therapist',
    cal_username: 'test-therapist',
    cal_enabled: true,
    email: 'therapist@example.com',
  };

  const mockBookingResult = {
    success: true,
    booking: {
      uid: 'test-booking-uid-123',
      startTime: '2026-01-20T10:00:00.000Z',
      endTime: '2026-01-20T10:15:00.000Z',
      metadata: {
        videoCallUrl: 'https://cal.example.com/video/test',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: mockTherapist, error: null });
    mockCreateCalBooking.mockResolvedValue(mockBookingResult);
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function callRoute(body: object, cookies?: string) {
    const { POST } = await import('@/app/api/public/cal/book/route');
    
    const headers = new Headers({
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      'user-agent': 'test-agent',
    });
    if (cookies) {
      headers.set('cookie', cookies);
    }

    const req = new NextRequest('http://localhost/api/public/cal/book', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    return POST(req);
  }

  describe('Test Mode Detection', () => {
    it('detects test mode from kh_test=1 cookie', async () => {
      await callRoute(validRequestBody, 'kh_test=1; other_cookie=value');

      // Check the upsert call includes is_test: true
      expect(mockUpsert).toHaveBeenCalled();
      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.is_test).toBe(true);
    });

    it('is_test is false when kh_test cookie is not present', async () => {
      await callRoute(validRequestBody, 'other_cookie=value');

      expect(mockUpsert).toHaveBeenCalled();
      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.is_test).toBe(false);
    });

    it('is_test is false when no cookies present', async () => {
      await callRoute(validRequestBody);

      expect(mockUpsert).toHaveBeenCalled();
      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.is_test).toBe(false);
    });

    it('detects test mode from metadata.kh_test', async () => {
      const bodyWithTestMetadata = {
        ...validRequestBody,
        metadata: { kh_test: true },
      };

      await callRoute(bodyWithTestMetadata);

      expect(mockUpsert).toHaveBeenCalled();
      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.is_test).toBe(true);
    });

    it('cookie OR metadata can trigger test mode', async () => {
      // Cookie alone
      await callRoute(validRequestBody, 'kh_test=1');
      expect(mockUpsert.mock.calls[0][0].is_test).toBe(true);

      vi.clearAllMocks();
      mockSingle.mockResolvedValue({ data: mockTherapist, error: null });
      mockCreateCalBooking.mockResolvedValue(mockBookingResult);

      // Metadata alone
      const bodyWithMeta = { ...validRequestBody, metadata: { kh_test: true } };
      await callRoute(bodyWithMeta);
      expect(mockUpsert.mock.calls[0][0].is_test).toBe(true);
    });
  });

  describe('Metadata Pre-insert', () => {
    it('pre-inserts cal_booking record with correct metadata', async () => {
      await callRoute(validRequestBody);

      expect(mockFrom).toHaveBeenCalledWith('cal_bookings');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          cal_uid: 'test-booking-uid-123',
          therapist_id: THERAPIST_ID,
          booking_kind: 'intro',
          source: 'native',
          is_test: false,
        }),
        { onConflict: 'cal_uid' }
      );
    });

    it('includes UTM parameters in metadata', async () => {
      const bodyWithUtm = {
        ...validRequestBody,
        metadata: {
          kh_gclid: 'gclid_123',
          kh_utm_source: 'google',
          kh_utm_medium: 'cpc',
          kh_utm_campaign: 'test_campaign',
        },
      };

      await callRoute(bodyWithUtm);

      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.metadata).toMatchObject({
        kh_gclid: 'gclid_123',
        kh_utm_source: 'google',
        kh_utm_medium: 'cpc',
        kh_utm_campaign: 'test_campaign',
      });
    });
  });

  describe('Error Handling', () => {
    it('returns 404 when therapist not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const response = await callRoute(validRequestBody);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe('Therapist not found');
    });

    it('returns 400 when Cal.com is not enabled for therapist', async () => {
      mockSingle.mockResolvedValueOnce({ 
        data: { ...mockTherapist, cal_enabled: false }, 
        error: null 
      });

      const response = await callRoute(validRequestBody);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Cal.com not enabled for this therapist');
    });

    it('returns error when createCalBooking fails', async () => {
      mockCreateCalBooking.mockResolvedValueOnce({
        success: false,
        error: 'slot_mismatch',
        message: 'Slot no longer available',
        canRetry: true,
      });

      const response = await callRoute(validRequestBody);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.success).toBe(false);
      expect(json.data.error).toBe('slot_mismatch');
    });
  });

  describe('Request Validation', () => {
    it('rejects invalid therapist_id', async () => {
      const invalidBody = { ...validRequestBody, therapist_id: 'not-a-uuid' };
      const response = await callRoute(invalidBody);
      
      expect(response.status).toBe(400);
    });

    it('rejects missing required fields', async () => {
      const { name, ...bodyWithoutName } = validRequestBody;
      const response = await callRoute(bodyWithoutName);
      
      expect(response.status).toBe(400);
    });

    it('rejects invalid email', async () => {
      const invalidBody = { ...validRequestBody, email: 'not-an-email' };
      const response = await callRoute(invalidBody);
      
      expect(response.status).toBe(400);
    });
  });
});
