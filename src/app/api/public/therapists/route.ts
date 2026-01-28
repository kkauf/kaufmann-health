import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import {
  getHiddenTherapistIds,
  hasCompleteProfile,
  isTherapistHidden,
  mapTherapistRow,
  parseTherapistRows,
  THERAPIST_SELECT_COLUMNS,
} from '@/lib/therapist-mapper';
import { 
  calculatePlatformScore, 
  type TherapistRowForMatch 
} from '@/features/leads/lib/match';
import { getCachedCalSlots, type CachedCalSlot } from '@/lib/cal/slots-cache';
import type { NextIntroSlot, NextFullSlot } from '@/contracts/therapist';

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

    // EARTH-248: Fetch cached Cal slots for Cal-enabled therapists
    const calEnabledIds = visibleRows
      .filter((r) => r.cal_enabled && r.cal_username)
      .map((r) => r.id);

    const calSlotsCache = await getCachedCalSlots(calEnabledIds);

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

    // Helper to convert cached slot to NextFullSlot
    function toNextFullSlot(cached: CachedCalSlot | undefined): NextFullSlot | undefined {
      if (!cached?.next_full_date_iso || !cached?.next_full_time_label || !cached?.next_full_time_utc) {
        return undefined;
      }
      return {
        date_iso: cached.next_full_date_iso,
        time_label: cached.next_full_time_label,
        time_utc: cached.next_full_time_utc,
      };
    }

    // Calculate Platform Score for each therapist and sort (per spec)
    // Use cached Cal.com slot counts for ranking - therapists with available slots rank higher
    const scoredRows = visibleRows.map((row) => {
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
        metadata: {
          hide_from_directory: mdObj['hide_from_directory'] === true,
          cal_username: typeof mdObj['cal_username'] === 'string' ? mdObj['cal_username'] : undefined,
          cal_event_types: Array.isArray(mdObj['cal_event_types']) ? mdObj['cal_event_types'] as string[] : undefined,
          profile: profile as TherapistRowForMatch['metadata'] extends { profile?: infer P } ? P : never,
        },
      };
      
      // Use cached Cal.com slot counts for platform score
      // This ensures therapists with available slots rank higher
      const cachedSlot = calSlotsCache.get(row.id);
      const introSlotsCount = cachedSlot?.slots_count ?? 0;
      const fullSlotsCount = cachedSlot?.full_slots_count ?? 0;
      // For 7-day window, use slots_count directly (cache is refreshed with 14-day window)
      // Approximate: if slots_count >= 3, assume at least some are within 7 days
      const intakeSlots7Days = introSlotsCount >= 3 ? 3 : introSlotsCount;
      const intakeSlots14Days = introSlotsCount;
      
      // Generate daily shuffle seed for fair rotation
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const dailyShuffleSeed = `${row.id}-${today}`;
      
      const platformScore = calculatePlatformScore(tRow, intakeSlots7Days, intakeSlots14Days, {
        fullSlotsCount,
        createdAt: (row as Record<string, unknown>).created_at as string | undefined,
        dailyShuffleSeed,
      });
      
      return { row, platformScore };
    });

    // Filter: only show therapists who are accepting new patients AND have a complete profile.
    // The portal UI enforces completeness before enabling accepting_new, but the onboarding
    // form allows it without full validation — so we enforce server-side as defense-in-depth.
    const eligibleRows = scoredRows.filter(({ row }) => {
      return row.accepting_new !== false && hasCompleteProfile(row);
    });

    // Sort by Platform Score descending (per spec: directory uses Platform Score only)
    eligibleRows.sort((a, b) => b.platformScore - a.platformScore);

    const therapists = eligibleRows.map(({ row }) => {
      // EARTH-248: Include cached next intro and full slots for Cal-enabled therapists
      const cachedSlot = calSlotsCache.get(row.id);
      const nextIntroSlot = toNextIntroSlot(cachedSlot);
      const nextFullSlot = toNextFullSlot(cachedSlot);
      return mapTherapistRow(row, { nextIntroSlot, nextFullSlot });
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
