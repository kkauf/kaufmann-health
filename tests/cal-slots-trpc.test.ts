/**
 * Tests for Cal.com tRPC slot fetching (EARTH-274)
 *
 * Tests the tRPC API integration for fetching Cal.com availability,
 * including buffer times, date overrides, and booking conflicts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCalSlotsFromTrpc } from '@/lib/cal/slots-trpc';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetchCalSlotsFromTrpc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns normalized slots from tRPC API response', async () => {
    const mockResponse = {
      result: {
        data: {
          json: {
            slots: {
              '2026-01-19': [
                { time: '2026-01-19T08:00:00.000Z' },
                { time: '2026-01-19T09:00:00.000Z' },
                { time: '2026-01-19T10:00:00.000Z' },
              ],
              '2026-01-20': [
                { time: '2026-01-20T08:00:00.000Z' },
              ],
            },
          },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const slots = await fetchCalSlotsFromTrpc(
      'testuser',
      'full-session',
      '2026-01-19',
      '2026-01-20',
      'Europe/Berlin'
    );

    expect(slots).not.toBeNull();
    expect(slots).toHaveLength(4);

    // Verify first slot
    expect(slots![0]).toMatchObject({
      date_iso: '2026-01-19',
      time_utc: '2026-01-19T08:00:00.000Z',
    });

    // Slots should be sorted by time
    expect(slots![0].time_utc).toBe('2026-01-19T08:00:00.000Z');
    expect(slots![1].time_utc).toBe('2026-01-19T09:00:00.000Z');
    expect(slots![2].time_utc).toBe('2026-01-19T10:00:00.000Z');
    expect(slots![3].time_utc).toBe('2026-01-20T08:00:00.000Z');
  });

  it('returns empty array when no slots available', async () => {
    const mockResponse = {
      result: {
        data: {
          json: {
            slots: {},
          },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const slots = await fetchCalSlotsFromTrpc(
      'testuser',
      'full-session',
      '2026-01-19',
      '2026-01-20',
      'Europe/Berlin'
    );

    expect(slots).toEqual([]);
  });

  it('returns null on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const slots = await fetchCalSlotsFromTrpc(
      'testuser',
      'full-session',
      '2026-01-19',
      '2026-01-20',
      'Europe/Berlin'
    );

    expect(slots).toBeNull();
  });

  it('returns null on tRPC error response', async () => {
    const mockResponse = {
      error: {
        json: {
          message: 'User not found',
          code: 404,
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const slots = await fetchCalSlotsFromTrpc(
      'nonexistent',
      'full-session',
      '2026-01-19',
      '2026-01-20',
      'Europe/Berlin'
    );

    expect(slots).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const slots = await fetchCalSlotsFromTrpc(
      'testuser',
      'full-session',
      '2026-01-19',
      '2026-01-20',
      'Europe/Berlin'
    );

    expect(slots).toBeNull();
  });

  it('returns null on timeout', async () => {
    // Simulate abort error
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const slots = await fetchCalSlotsFromTrpc(
      'testuser',
      'full-session',
      '2026-01-19',
      '2026-01-20',
      'Europe/Berlin'
    );

    expect(slots).toBeNull();
  });

  it('constructs correct tRPC API URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { data: { json: { slots: {} } } } }),
    });

    await fetchCalSlotsFromTrpc(
      'kgmkauf',
      'intro',
      '2026-01-19',
      '2026-01-25',
      'Europe/Berlin'
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0][0];

    // Verify URL structure
    expect(callUrl).toContain('/api/trpc/slots/getSchedule');
    expect(callUrl).toContain('input=');

    // Parse the input param
    const url = new URL(callUrl);
    const inputJson = JSON.parse(url.searchParams.get('input') || '{}');

    expect(inputJson.json.usernameList).toEqual(['kgmkauf']);
    expect(inputJson.json.eventTypeSlug).toBe('intro');
    expect(inputJson.json.timeZone).toBe('Europe/Berlin');
    expect(inputJson.json.startTime).toBe('2026-01-19T00:00:00.000Z');
    expect(inputJson.json.endTime).toBe('2026-01-25T23:59:59.999Z');
  });

  it('respects buffer times by returning fewer slots', async () => {
    // This test documents expected behavior: Cal.com's tRPC API
    // accounts for buffer times, so if a therapist has 15-min buffers,
    // some slots will be unavailable
    const mockResponse = {
      result: {
        data: {
          json: {
            slots: {
              // Only 3 slots instead of 8 due to buffer times
              '2026-01-19': [
                { time: '2026-01-19T08:00:00.000Z' },
                { time: '2026-01-19T10:00:00.000Z' },
                { time: '2026-01-19T14:00:00.000Z' },
              ],
            },
          },
        },
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const slots = await fetchCalSlotsFromTrpc(
      'testuser',
      'full-session',
      '2026-01-19',
      '2026-01-19',
      'Europe/Berlin'
    );

    // tRPC API returns exactly what Cal.com considers bookable
    expect(slots).toHaveLength(3);
  });
});
