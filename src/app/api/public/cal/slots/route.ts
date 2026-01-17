/**
 * GET /api/public/cal/slots
 *
 * Fetch Cal.com availability from pre-warmed cache (instant, ~10ms)
 *
 * Strategy (PERF optimization):
 * - Always use cal_slots_cache table which is warmed by scheduled cron
 * - No external HTTP calls to Cal.com tRPC API (eliminates 1-8s latency)
 * - Cache is refreshed every 15 minutes by /api/admin/cal/warm-slots cron
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

    const { therapist_id, kind } = parsed.data;
    const eventSlug = kindToEventSlug(kind);

    // Fetch therapist info + cached slots in parallel (PERF: single round-trip)
    const [therapistResult, cacheResult] = await Promise.all([
      supabaseServer
        .from('therapists')
        .select('id, cal_username, cal_enabled')
        .eq('id', therapist_id)
        .single(),
      supabaseServer
        .from('cal_slots_cache')
        .select('intro_slots, full_slots, cached_at, last_error')
        .eq('therapist_id', therapist_id)
        .single(),
    ]);

    const { data: therapist, error: therapistErr } = therapistResult;

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
    const cache = cacheResult.data;

    // Check if cache exists and is recent (within 30 minutes)
    const cacheAge = cache?.cached_at 
      ? (Date.now() - new Date(cache.cached_at).getTime()) / 1000 / 60 
      : Infinity;
    const isCacheStale = cacheAge > 30; // 30 minutes

    if (!cache || isCacheStale) {
      void ServerAnalytics.trackEventFromRequest(req, {
        type: 'cal_slots_cache_miss',
        source: 'api.public.cal.slots',
        props: { therapist_id, kind, cache_age_min: Math.round(cacheAge) },
      });

      // Return empty slots if cache is missing/stale
      // The cron job will refresh it shortly
      return NextResponse.json({
        data: {
          slots: [],
          therapist_id,
          kind,
          cal_username: calUsername,
          event_type_slug: eventSlug,
        },
        error: null,
      } satisfies CalSlotsResponse);
    }

    // Get slots from cache based on kind
    const rawSlots = kind === 'intro' ? cache.intro_slots : cache.full_slots;
    const slots: CalNormalizedSlot[] = Array.isArray(rawSlots) ? rawSlots : [];

    void ServerAnalytics.trackEventFromRequest(req, {
      type: 'cal_slots_cache_hit',
      source: 'api.public.cal.slots',
      props: { 
        therapist_id, 
        kind, 
        slot_count: slots.length,
        cache_age_min: Math.round(cacheAge),
      },
    });

    return NextResponse.json({
      data: {
        slots,
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
