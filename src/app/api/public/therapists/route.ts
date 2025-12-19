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

    // Compute availability using shared logic (handles one-time vs recurring correctly)
    const availabilityMap = await computeAvailability(therapistIds, {
      maxDays: 21,
      maxSlots: 9, // Directory view needs fewer slots
      fallbackAddresses,
    });

    const therapists = visibleRows.map((row) => {
      const availability = availabilityMap.get(row.id) || [];
      return mapTherapistRow(row, { availability });
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
