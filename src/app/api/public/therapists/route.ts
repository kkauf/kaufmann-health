import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { computeAvailability } from '@/lib/availability';
import {
  mapTherapistRow,
  getHiddenTherapistIds,
  isTherapistHidden,
  parseTherapistRows,
  THERAPIST_SELECT_COLUMNS,
} from '@/lib/therapist-mapper';

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

    // Validate rows with Zod schema - logs warnings for invalid rows in dev
    const rows = parseTherapistRows(data || []);

    // Build list of therapist ids for availability lookup
    const therapistIds = rows.map((r) => r.id);

    // Build fallback addresses map from therapist profiles
    const fallbackAddresses = new Map<string, string>();
    for (const row of rows) {
      const mdObj = row?.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {};
      const profile = mdObj['profile'] && typeof mdObj['profile'] === 'object' ? (mdObj['profile'] as Record<string, unknown>) : {};
      const practiceAddr = typeof profile['practice_address'] === 'string' ? profile['practice_address'] : '';
      if (practiceAddr) fallbackAddresses.set(row.id, practiceAddr);
    }

    // Compute availability using shared utility
    const availabilityMap = await computeAvailability(therapistIds, {
      maxDays: 21,
      maxSlots: 50,
      fallbackAddresses,
    });

    const therapists = rows
      .filter((row) => !isTherapistHidden(row, hideIds))
      .map((row) => {
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
