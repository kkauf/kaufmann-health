/**
 * GET /api/public/cal/slots
 *
 * Proxy to Cal.com v2 slots API (EARTH-256)
 *
 * WHY: Fetch real Cal.com availability without exposing API key to client.
 * Returns normalized slots grouped by day for KH availability picker UI.
 *
 * Contract:
 * - Input: therapist_id, kind (intro|full_session), start?, end?, timeZone?
 * - Output: { data: { slots: CalNormalizedSlot[], therapist_id, kind, cal_username, event_type_slug }, error }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { parseQueryParams } from '@/lib/api-utils';
import { ServerAnalytics } from '@/lib/server-analytics';
import {
  CalSlotsInput,
  CalNormalizedSlot,
  type CalSlotsResponse,
  type CalBookingKind,
} from '@/contracts/cal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CAL_API_KEY = process.env.CAL_API_KEY || '';
const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';
const CAL_API_VERSION = '2024-09-04';

// In-memory cache for slots (cleared on deploy)
const slotsCache = new Map<string, { data: CalNormalizedSlot[]; expires: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Map booking kind to Cal.com event type slug
 */
function kindToEventSlug(kind: CalBookingKind): string {
  return kind === 'intro' ? 'intro' : 'full-session';
}

/**
 * Format ISO datetime to local time label (HH:MM) in given timezone
 */
function toTimeLabel(isoDatetime: string, timeZone: string): string {
  const date = new Date(isoDatetime);
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
    hour12: false,
  });
}

/**
 * Format ISO datetime to date string (YYYY-MM-DD) in given timezone
 */
function toDateIso(isoDatetime: string, timeZone: string): string {
  const date = new Date(isoDatetime);
  return date.toLocaleDateString('sv-SE', { timeZone }); // sv-SE gives YYYY-MM-DD format
}

/**
 * Fetch slots from Cal.com v2 API
 */
async function fetchCalSlots(
  calUsername: string,
  eventSlug: string,
  start: string,
  end: string,
  timeZone: string
): Promise<{ slots: Record<string, Array<{ time: string }>> } | null> {
  if (!CAL_API_KEY) {
    console.warn('[cal/slots] CAL_API_KEY not configured');
    return null;
  }

  const url = new URL(`${CAL_ORIGIN}/api/v2/slots`);
  url.searchParams.set('eventTypeSlug', eventSlug);
  url.searchParams.set('username', calUsername);
  url.searchParams.set('start', start);
  url.searchParams.set('end', end);
  url.searchParams.set('timeZone', timeZone);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${CAL_API_KEY}`,
        'cal-api-version': CAL_API_VERSION,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[cal/slots] Cal API error ${res.status}:`, text);
      return null;
    }

    const json = await res.json();
    return json?.data || json;
  } catch (err) {
    console.error('[cal/slots] Cal API fetch failed:', err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    // Parse and validate query params
    const parsed = parseQueryParams(req, CalSlotsInput);
    if (!parsed.success) {
      return parsed.response;
    }

    const { therapist_id, kind, timeZone = 'Europe/Berlin' } = parsed.data;

    // Default date range: today + 7 days (extend to 14 if sparse)
    const today = new Date();
    const defaultStart = today.toISOString().split('T')[0];
    const defaultEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const start = parsed.data.start || defaultStart;
    const end = parsed.data.end || defaultEnd;
    const eventSlug = kindToEventSlug(kind);

    // Look up therapist's cal_username
    const { data: therapist, error: therapistErr } = await supabaseServer
      .from('therapists')
      .select('id, cal_username, cal_enabled')
      .eq('id', therapist_id)
      .single();

    if (therapistErr || !therapist) {
      return NextResponse.json(
        { data: null, error: 'Therapist not found' } satisfies CalSlotsResponse,
        { status: 404 }
      );
    }

    if (!therapist.cal_enabled || !therapist.cal_username) {
      return NextResponse.json(
        { data: null, error: 'Cal.com not enabled for this therapist' } satisfies CalSlotsResponse,
        { status: 400 }
      );
    }

    const calUsername = therapist.cal_username;

    // Check cache
    const cacheKey = `${therapist_id}:${kind}:${start}:${end}`;
    const cached = slotsCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'cal_slots_cache_hit',
        source: 'api.public.cal.slots',
        props: { therapist_id, kind },
      });

      return NextResponse.json({
        data: {
          slots: cached.data,
          therapist_id,
          kind,
          cal_username: calUsername,
          event_type_slug: eventSlug,
        },
        error: null,
      } satisfies CalSlotsResponse);
    }

    // Fetch from Cal.com API
    const calResponse = await fetchCalSlots(calUsername, eventSlug, start, end, timeZone);

    if (!calResponse) {
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'cal_slots_api_failed',
        source: 'api.public.cal.slots',
        props: { therapist_id, kind, cal_username: calUsername },
      });

      return NextResponse.json(
        { data: null, error: 'Failed to fetch availability' } satisfies CalSlotsResponse,
        { status: 502 }
      );
    }

    // Normalize slots to KH format
    const normalizedSlots: CalNormalizedSlot[] = [];
    const rawSlots = calResponse.slots || {};

    for (const [dateKey, daySlots] of Object.entries(rawSlots)) {
      for (const slot of daySlots) {
        if (slot.time) {
          normalizedSlots.push({
            date_iso: toDateIso(slot.time, timeZone),
            time_label: toTimeLabel(slot.time, timeZone),
            time_utc: slot.time,
          });
        }
      }
    }

    // Sort by time
    normalizedSlots.sort((a, b) => a.time_utc.localeCompare(b.time_utc));

    // Cache result
    slotsCache.set(cacheKey, {
      data: normalizedSlots,
      expires: Date.now() + CACHE_TTL_MS,
    });

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'cal_slots_fetched',
      source: 'api.public.cal.slots',
      props: {
        therapist_id,
        kind,
        cal_username: calUsername,
        slot_count: normalizedSlots.length,
        days_with_slots: Object.keys(rawSlots).length,
      },
    });

    return NextResponse.json({
      data: {
        slots: normalizedSlots,
        therapist_id,
        kind,
        cal_username: calUsername,
        event_type_slug: eventSlug,
      },
      error: null,
    } satisfies CalSlotsResponse);
  } catch (err) {
    console.error('[cal/slots] Unexpected error:', err);

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'cal_slots_error',
      source: 'api.public.cal.slots',
      props: { error: err instanceof Error ? err.message : 'unknown' },
    });

    return NextResponse.json(
      { data: null, error: 'Internal error' } satisfies CalSlotsResponse,
      { status: 500 }
    );
  }
}
