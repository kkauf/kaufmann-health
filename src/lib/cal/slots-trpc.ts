/**
 * Cal.com Slots via tRPC API (EARTH-274)
 *
 * Fetches availability from Cal.com's internal tRPC API endpoint.
 * This is the same API Cal.com's frontend uses, so it accounts for:
 * - Buffer times (before/after events)
 * - Minimum booking notice
 * - Date overrides
 * - Existing bookings
 * - Slot reservations (temporary holds)
 *
 * Falls back to direct DB queries if tRPC API fails.
 */

import type { CalSlot } from './slots-db';

const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';
const TRPC_TIMEOUT_MS = 8000; // 8 seconds

interface TrpcSlotResponse {
  result?: {
    data?: {
      json?: {
        slots?: Record<string, Array<{ time: string }>>;
      };
    };
  };
  error?: {
    json?: {
      message?: string;
      code?: number;
    };
  };
}

/**
 * Fetch slots from Cal.com's tRPC API
 * Returns normalized slots or null if API call fails
 */
export async function fetchCalSlotsFromTrpc(
  calUsername: string,
  eventSlug: string,
  start: string, // YYYY-MM-DD
  end: string, // YYYY-MM-DD
  timeZone: string = 'Europe/Berlin'
): Promise<CalSlot[] | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TRPC_TIMEOUT_MS);

  try {
    // Build the tRPC input payload
    const input = {
      json: {
        isTeamEvent: false,
        usernameList: [calUsername],
        eventTypeSlug: eventSlug,
        startTime: `${start}T00:00:00.000Z`,
        endTime: `${end}T23:59:59.999Z`,
        timeZone,
      },
    };

    const url = new URL('/api/trpc/slots/getSchedule', CAL_ORIGIN);
    url.searchParams.set('input', JSON.stringify(input));

    console.log('[cal/slots-trpc] Fetching slots from tRPC API', {
      calUsername,
      eventSlug,
      start,
      end,
      timeZone,
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[cal/slots-trpc] HTTP error', {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const data: TrpcSlotResponse = await response.json();

    // Check for tRPC error response
    if (data.error) {
      console.error('[cal/slots-trpc] tRPC error', {
        message: data.error.json?.message,
        code: data.error.json?.code,
      });
      return null;
    }

    // Extract slots from response
    const slotsData = data.result?.data?.json?.slots;
    if (!slotsData) {
      console.warn('[cal/slots-trpc] No slots data in response');
      return [];
    }

    // Normalize slots to our format
    const normalizedSlots: CalSlot[] = [];

    for (const [dateKey, daySlots] of Object.entries(slotsData)) {
      for (const slot of daySlots) {
        const slotTime = new Date(slot.time);

        normalizedSlots.push({
          date_iso: dateKey, // Already in YYYY-MM-DD format
          time_label: slotTime.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone,
            hour12: false,
          }),
          time_utc: slot.time,
        });
      }
    }

    // Sort by time
    normalizedSlots.sort((a, b) => a.time_utc.localeCompare(b.time_utc));

    console.log('[cal/slots-trpc] Fetched slots', {
      calUsername,
      eventSlug,
      slotCount: normalizedSlots.length,
    });

    return normalizedSlots;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[cal/slots-trpc] Request timed out');
    } else {
      console.error('[cal/slots-trpc] Request failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }
}

/**
 * Check if tRPC API is available (simple health check)
 */
export async function isTrpcAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${CAL_ORIGIN}/api/trpc/features/map?batch=1&input={}`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
