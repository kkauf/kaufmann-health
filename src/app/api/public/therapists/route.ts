import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import {
  type TherapistRow,
  getHiddenTherapistIds,
  isTherapistHidden,
  mapTherapistRow,
  parseTherapistRows,
  THERAPIST_SELECT_COLUMNS,
} from '@/lib/therapist-mapper';
import { computeAvailability } from '@/lib/availability';
import { 
  isEligible, 
  calculatePlatformScore, 
  type TherapistRowForMatch 
} from '@/features/leads/lib/match';
import { getCachedCalSlots, type CachedCalSlot } from '@/lib/cal/slots-cache';
import type { NextIntroSlot } from '@/contracts/therapist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const hideIds = getHiddenTherapistIds();

    const { data, error } = await supabaseServer
      .from('therapists')
      .select(THERAPIST_SELECT_COLUMNS)
      .eq('status', 'verified')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api.public.therapists] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch therapists' },
        { status: 500 }
      );
    }

    const raw = Array.isArray(data) ? data : [];
    const rows = parseTherapistRows(raw);
    const visibleRows = rows.filter((row) => !isTherapistHidden(row, hideIds));

    // Build list of therapist ids for availability lookup
    const therapistIds = visibleRows.map((r) => r.id);

    // EARTH-248: Fetch cached Cal slots in parallel with availability
    const calEnabledIds = visibleRows
      .filter((r) => r.cal_enabled && r.cal_username)
      .map((r) => r.id);

    // Helpers to extract practice address for fallback
    function getPracticeAddress(row: TherapistRow): string {
      try {
        const mdObj: Record<string, unknown> =
          row?.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {};
        const profileUnknown = mdObj['profile'];
        const profile: Record<string, unknown> =
          profileUnknown && typeof profileUnknown === 'object'
            ? (profileUnknown as Record<string, unknown>)
            : {};
        const v = profile['practice_address'];
        return typeof v === 'string' ? v : '';
      } catch {
        return '';
      }
    }

    // Prepare fallback addresses
    const fallbackAddresses = new Map<string, string>();
    for (const row of visibleRows) {
      const addr = getPracticeAddress(row);
      if (addr) fallbackAddresses.set(row.id, addr);
    }

    // Compute availability and fetch Cal cache in parallel
    const [availabilityMap, calSlotsCache] = await Promise.all([
      computeAvailability(therapistIds, {
        maxDays: 21,
        maxSlots: 9, // Directory view needs fewer slots
        fallbackAddresses,
      }),
      getCachedCalSlots(calEnabledIds),
    ]);

    // EARTH-248: Helper to convert cached slot to NextIntroSlot
    function toNextIntroSlot(cached: CachedCalSlot | undefined): NextIntroSlot | undefined {
      if (!cached?.next_intro_date_iso || !cached?.next_intro_time_label || !cached?.next_intro_time_utc) {
        return undefined;
      }
      return {
        date_iso: cached.next_intro_date_iso,
        time_label: cached.next_intro_time_label,
        time_utc: cached.next_intro_time_utc,
      };
    }

    // Helper: count slots within day windows for Platform Score
    function countSlotsInDays(availability: { date_iso: string }[], days: number): number {
      const now = new Date();
      const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      return availability.filter(a => new Date(a.date_iso) <= cutoff).length;
    }

    // Calculate Platform Score for each therapist and sort (per spec)
    const scoredRows = visibleRows.map((row) => {
      const availability = availabilityMap.get(row.id) || [];
      
      // Build TherapistRowForMatch for scoring
      const mdObj = (row.metadata && typeof row.metadata === 'object') 
        ? row.metadata as Record<string, unknown> 
        : {};
      const profile = (mdObj['profile'] && typeof mdObj['profile'] === 'object')
        ? mdObj['profile'] as Record<string, unknown>
        : {};
      
      const tRow: TherapistRowForMatch = {
        id: row.id,
        gender: row.gender || undefined,
        city: row.city || undefined,
        session_preferences: row.session_preferences,
        modalities: row.modalities,
        schwerpunkte: row.schwerpunkte,
        accepting_new: row.accepting_new,
        photo_url: row.photo_url,
        approach_text: typeof profile['approach_text'] === 'string' ? profile['approach_text'] : undefined,
        who_comes_to_me: typeof profile['who_comes_to_me'] === 'string' ? profile['who_comes_to_me'] : undefined,
        cal_bookings_live: (row as Record<string, unknown>).cal_bookings_live === true,
        metadata: {
          hide_from_directory: mdObj['hide_from_directory'] === true,
          cal_username: typeof mdObj['cal_username'] === 'string' ? mdObj['cal_username'] : undefined,
          cal_event_types: Array.isArray(mdObj['cal_event_types']) ? mdObj['cal_event_types'] as string[] : undefined,
          profile: profile as TherapistRowForMatch['metadata'] extends { profile?: infer P } ? P : never,
        },
      };
      
      const intakeSlots7Days = countSlotsInDays(availability, 7);
      const intakeSlots14Days = countSlotsInDays(availability, 14);
      const platformScore = calculatePlatformScore(tRow, intakeSlots7Days, intakeSlots14Days);
      
      return { row, availability, platformScore };
    });

    // Filter: only show therapists accepting new patients (DB flag)
    // Note: availability is used for sorting/scoring, not visibility
    const eligibleRows = scoredRows.filter(({ row }) => {
      return row.accepting_new !== false;
    });

    // Sort by Platform Score descending (per spec: directory uses Platform Score only)
    eligibleRows.sort((a, b) => b.platformScore - a.platformScore);

    const therapists = eligibleRows.map(({ row, availability }) => {
      // EARTH-248: Include cached next intro slot for Cal-enabled therapists
      const cachedSlot = calSlotsCache.get(row.id);
      const nextIntroSlot = toNextIntroSlot(cachedSlot);
      return mapTherapistRow(row, { availability, nextIntroSlot });
    });

    return NextResponse.json(
      { therapists },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (err) {
    console.error('[api.public.therapists] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
