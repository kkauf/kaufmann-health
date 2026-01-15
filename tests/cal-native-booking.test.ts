/**
 * EARTH-271: Native Cal.com Booking API Tests
 *
 * Tests for createCalBooking() function that calls Cal.com's internal
 * /api/book/event endpoint to create bookings without redirect.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CalBookingRequest, CalBookingResult } from '@/contracts/cal';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
const importCreateCalBooking = async () => {
  const module = await import('@/lib/cal/book');
  return module.createCalBooking;
};

describe('createCalBooking (EARTH-271)', () => {
  const CAL_ORIGIN = 'https://cal.kaufmann.health';
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_CAL_ORIGIN', CAL_ORIGIN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const validRequest: CalBookingRequest = {
    eventTypeId: 27,
    start: '2026-01-22T17:00:00.000Z',
    responses: {
      name: 'Test Patient',
      email: 'test@example.com',
      location: { value: 'integrations:daily', optionValue: '' },
    },
    timeZone: 'Europe/Berlin',
    language: 'de',
    metadata: {
      kh_therapist_id: 'f2d0c4ad-a428-4f69-86b6-26af2d4ccb49',
      kh_patient_id: '53db1010-07b8-43ef-a42d-323341a31063',
      kh_booking_kind: 'intro',
      kh_source: 'directory',
      kh_gclid: undefined,
      kh_utm_source: undefined,
      kh_utm_medium: undefined,
      kh_utm_campaign: undefined,
      kh_utm_term: undefined,
      kh_utm_content: undefined,
    },
  };

  const successResponse = {
    id: 123,
    uid: '2wnPXcx33FJ2bck9ntWuA5',
    eventTypeId: 27,
    userId: 12,
    startTime: '2026-01-22T17:00:00.000Z',
    endTime: '2026-01-22T17:15:00.000Z',
    status: 'accepted',
    metadata: {
      videoCallUrl: 'https://cal.kaufmann.health/video/2wnPXcx33FJ2bck9ntWuA5',
      kh_therapist_id: 'f2d0c4ad-a428-4f69-86b6-26af2d4ccb49',
    },
    responses: {
      name: 'Test Patient',
      email: 'test@example.com',
      location: { value: 'integrations:daily', optionValue: '' },
    },
  };

  describe('AC1: Successful Booking Creation', () => {
    it('creates booking and returns uid, times, and videoCallUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(successResponse),
      });

      const createCalBooking = await importCreateCalBooking();
      const result = await createCalBooking(validRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.booking.uid).toBe('2wnPXcx33FJ2bck9ntWuA5');
        expect(result.booking.startTime).toBe('2026-01-22T17:00:00.000Z');
        expect(result.booking.endTime).toBe('2026-01-22T17:15:00.000Z');
        expect(result.booking.metadata?.videoCallUrl).toBe(
          'https://cal.kaufmann.health/video/2wnPXcx33FJ2bck9ntWuA5'
        );
      }
    });

    it('calls correct endpoint with correct payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(successResponse),
      });

      const createCalBooking = await importCreateCalBooking();
      await createCalBooking(validRequest);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${CAL_ORIGIN}/api/book/event`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        })
      );

      // Verify body contains required fields
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.eventTypeId).toBe(27);
      expect(body.start).toBe('2026-01-22T17:00:00.000Z');
      expect(body.responses.name).toBe('Test Patient');
      expect(body.responses.email).toBe('test@example.com');
      expect(body.metadata.kh_therapist_id).toBe('f2d0c4ad-a428-4f69-86b6-26af2d4ccb49');
    });
  });

  describe('AC2: Slot Mismatch Handling', () => {
    it('returns slot_mismatch error with canRetry=true for no_available_users_found_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: 'no_available_users_found_error',
          data: { traceId: 'trace_123' },
        }),
      });

      const createCalBooking = await importCreateCalBooking();
      const result = await createCalBooking(validRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('slot_mismatch');
        expect(result.canRetry).toBe(true);
      }
    });

    it('returns slot_mismatch for booking_time_out_of_bounds_error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: 'booking_time_out_of_bounds_error',
          data: { traceId: 'trace_456' },
        }),
      });

      const createCalBooking = await importCreateCalBooking();
      const result = await createCalBooking(validRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('slot_mismatch');
        expect(result.canRetry).toBe(true);
      }
    });
  });

  describe('AC3: API Error Handling', () => {
    it('returns api_error with fallbackToRedirect=true for network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const createCalBooking = await importCreateCalBooking();
      const result = await createCalBooking(validRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('api_error');
        expect(result.fallbackToRedirect).toBe(true);
      }
    });

    it('returns api_error for HTTP 500 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal Server Error' }),
      });

      const createCalBooking = await importCreateCalBooking();
      const result = await createCalBooking(validRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('api_error');
        expect(result.fallbackToRedirect).toBe(true);
      }
    });

    it('returns api_error for unexpected error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: 'some_unknown_error',
          data: { traceId: 'trace_789' },
        }),
      });

      const createCalBooking = await importCreateCalBooking();
      const result = await createCalBooking(validRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('api_error');
        expect(result.fallbackToRedirect).toBe(true);
      }
    });

    it('returns api_error for malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const createCalBooking = await importCreateCalBooking();
      const result = await createCalBooking(validRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('api_error');
        expect(result.fallbackToRedirect).toBe(true);
      }
    });

    it('handles AbortError (timeout) correctly', async () => {
      // Simulate timeout by throwing AbortError
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const createCalBooking = await importCreateCalBooking();
      const result = await createCalBooking(validRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('api_error');
        expect(result.fallbackToRedirect).toBe(true);
        expect(result.message).toBe('Request timed out');
      }
    });
  });

  describe('AC5: Metadata Preservation', () => {
    it('includes all KH metadata in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(successResponse),
      });

      const requestWithFullMetadata: CalBookingRequest = {
        ...validRequest,
        metadata: {
          kh_therapist_id: 'therapist-uuid',
          kh_patient_id: 'patient-uuid',
          kh_booking_kind: 'intro',
          kh_source: 'directory',
          kh_gclid: 'gclid_123',
          kh_utm_source: 'google',
          kh_utm_medium: 'cpc',
          kh_utm_campaign: 'therapie_berlin',
          kh_utm_term: undefined,
          kh_utm_content: undefined,
        },
      };

      const createCalBooking = await importCreateCalBooking();
      await createCalBooking(requestWithFullMetadata);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.metadata.kh_therapist_id).toBe('therapist-uuid');
      expect(body.metadata.kh_patient_id).toBe('patient-uuid');
      expect(body.metadata.kh_booking_kind).toBe('intro');
      expect(body.metadata.kh_source).toBe('directory');
      expect(body.metadata.kh_gclid).toBe('gclid_123');
      expect(body.metadata.kh_utm_source).toBe('google');
      expect(body.metadata.kh_utm_medium).toBe('cpc');
      expect(body.metadata.kh_utm_campaign).toBe('therapie_berlin');
    });
  });
});

describe('Feature Flag (EARTH-271 AC4)', () => {
  it('exports USE_NATIVE_BOOKING constant based on env', async () => {
    vi.stubEnv('NEXT_PUBLIC_NATIVE_BOOKING', 'true');
    vi.resetModules();
    
    const { USE_NATIVE_BOOKING } = await import('@/lib/cal/book');
    expect(USE_NATIVE_BOOKING).toBe(true);
    
    vi.unstubAllEnvs();
  });

  it('USE_NATIVE_BOOKING is false when env not set', async () => {
    vi.stubEnv('NEXT_PUBLIC_NATIVE_BOOKING', '');
    vi.resetModules();
    
    const { USE_NATIVE_BOOKING } = await import('@/lib/cal/book');
    expect(USE_NATIVE_BOOKING).toBe(false);
    
    vi.unstubAllEnvs();
  });
});
