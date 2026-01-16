/**
 * GET /api/public/cal/slots
 *
 * Fetch Cal.com availability via tRPC API (primary) or direct DB queries (fallback)
 *
 * Strategy (EARTH-274):
 * 1. Try Cal.com's internal tRPC API first - this is the most accurate as it accounts for
 *    buffer times, date overrides, slot reservations, and all Cal.com booking rules
 * 2. Fall back to direct DB queries if tRPC fails (network issues, etc.)
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
import { fetchCalSlotsFromDb, isCalDbEnabled } from '@/lib/cal/slots-db';
import { fetchCalSlotsFromTrpc } from '@/lib/cal/slots-trpc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory cache for slots (cleared on deploy)
const slotsCache = new Map<string, { data: CalNormalizedSlot[]; expires: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Map booking kind to Cal.com event type slug
 */
function kindToEventSlug(kind: CalBookingKind): string {
  return kind === 'intro' ? 'intro' : 'full-session';
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

    // Strategy: Try tRPC API first (most accurate), fall back to direct DB
    let slots: CalNormalizedSlot[] | null = null;
    let source: 'trpc' | 'db' = 'trpc';

    // 1. Try tRPC API first - this accounts for all Cal.com booking rules
    slots = await fetchCalSlotsFromTrpc(calUsername, eventSlug, start, end, timeZone);

    if (slots === null) {
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'cal_slots_trpc_failed',
        source: 'api.public.cal.slots',
        props: { therapist_id, kind, cal_username: calUsername },
      });

      // 2. Fall back to direct DB queries
      if (isCalDbEnabled()) {
        source = 'db';
        slots = await fetchCalSlotsFromDb(calUsername, eventSlug, start, end, timeZone);

        if (slots === null) {
          void ServerAnalytics.trackEventFromRequest(req, {
            type: 'cal_slots_db_failed',
            source: 'api.public.cal.slots',
            props: { therapist_id, kind, cal_username: calUsername },
          });
        }
      }
    }

    // If both methods failed, return error
    if (slots === null) {
      return NextResponse.json(
        { data: null, error: 'Failed to fetch availability' } satisfies CalSlotsResponse,
        { status: 502 }
      );
    }

    // Cache result
    slotsCache.set(cacheKey, {
      data: slots,
      expires: Date.now() + CACHE_TTL_MS,
    });

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'cal_slots_fetched',
      source: 'api.public.cal.slots',
      props: {
        therapist_id,
        kind,
        cal_username: calUsername,
        slot_count: slots.length,
        fetch_source: source,
      },
    });

    const normalizedSlots = slots;

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
