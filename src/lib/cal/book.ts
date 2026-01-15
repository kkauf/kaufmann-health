/**
 * EARTH-271: Native Cal.com Booking API
 *
 * Creates bookings via Cal.com's internal /api/book/event endpoint
 * instead of redirecting users to Cal.com.
 */

import type {
  CalBookingRequest,
  CalBookingResult,
  CalBookingSuccessResponse,
} from '@/contracts/cal';

const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';
const BOOKING_TIMEOUT_MS = 10000; // 10 seconds

export const USE_NATIVE_BOOKING = process.env.NEXT_PUBLIC_NATIVE_BOOKING === 'true';

/**
 * Known Cal.com error codes that indicate slot is no longer available.
 * These errors are recoverable by refreshing slots and letting user pick again.
 */
const SLOT_MISMATCH_ERRORS = [
  'no_available_users_found_error',
  'booking_time_out_of_bounds_error',
];

/**
 * Create a booking via Cal.com's internal API.
 *
 * @returns CalBookingResult with success/failure state
 *
 * Success: { success: true, booking: CalBookingSuccessResponse }
 * Slot mismatch: { success: false, error: 'slot_mismatch', canRetry: true }
 * API error: { success: false, error: 'api_error', fallbackToRedirect: true }
 */
export async function createCalBooking(
  request: CalBookingRequest
): Promise<CalBookingResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BOOKING_TIMEOUT_MS);

  try {
    const response = await fetch(`${CAL_ORIGIN}/api/book/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      console.error('[cal/book] Failed to parse response JSON');
      return {
        success: false,
        error: 'api_error',
        fallbackToRedirect: true,
        message: 'Invalid response from Cal.com',
      };
    }

    // Check for HTTP errors
    if (!response.ok) {
      console.error('[cal/book] HTTP error', { status: response.status, data });
      return {
        success: false,
        error: 'api_error',
        fallbackToRedirect: true,
        message: `HTTP ${response.status}`,
      };
    }

    // Check if response has error message (Cal.com returns 200 with error in body)
    const errorResponse = data as { message?: string; data?: { traceId?: string } };
    if (errorResponse.message && typeof errorResponse.message === 'string') {
      // Check if it's a recoverable slot mismatch error
      if (SLOT_MISMATCH_ERRORS.some((err) => errorResponse.message?.includes(err))) {
        console.warn('[cal/book] Slot mismatch', {
          error: errorResponse.message,
          traceId: errorResponse.data?.traceId,
        });
        return {
          success: false,
          error: 'slot_mismatch',
          canRetry: true,
          message: errorResponse.message,
        };
      }

      // Unknown error - fallback to redirect
      console.error('[cal/book] Unknown error', {
        error: errorResponse.message,
        traceId: errorResponse.data?.traceId,
      });
      return {
        success: false,
        error: 'api_error',
        fallbackToRedirect: true,
        message: errorResponse.message,
      };
    }

    // Success - validate response structure
    const booking = data as CalBookingSuccessResponse;
    if (!booking.uid || !booking.startTime) {
      console.error('[cal/book] Invalid success response', { data });
      return {
        success: false,
        error: 'api_error',
        fallbackToRedirect: true,
        message: 'Invalid booking response structure',
      };
    }

    console.log('[cal/book] Booking created', {
      uid: booking.uid,
      startTime: booking.startTime,
      videoCallUrl: booking.metadata?.videoCallUrl,
    });

    return {
      success: true,
      booking,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[cal/book] Request timed out');
      return {
        success: false,
        error: 'api_error',
        fallbackToRedirect: true,
        message: 'Request timed out',
      };
    }

    // Network or other error
    console.error('[cal/book] Request failed', { error });
    return {
      success: false,
      error: 'api_error',
      fallbackToRedirect: true,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Build location object for booking request.
 *
 * @param locationType - 'video' for Cal Video, 'in_person' for physical location
 * @param address - Physical address (only used for in_person)
 */
export function buildBookingLocation(
  locationType: 'video' | 'in_person',
  address?: string
): { value: string; optionValue: string } {
  if (locationType === 'video') {
    return { value: 'integrations:daily', optionValue: '' };
  }
  return { value: 'inPerson', optionValue: address || '' };
}
