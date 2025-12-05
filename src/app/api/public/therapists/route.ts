import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { computeAvailability } from '@/lib/availability';

type TherapistRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  modalities: unknown;
  schwerpunkte: unknown;
  session_preferences: unknown;
  accepting_new: boolean | null;
  photo_url: string | null;
  status: string | null;
  metadata: unknown;
  typical_rate: number | null;
};

export async function GET() {
  try {
    const hideIdsEnv = (process.env.HIDE_THERAPIST_IDS || '').trim();
    const hideIds = new Set(
      hideIdsEnv
        ? hideIdsEnv
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        : []
    );

    const { data, error } = await supabaseServer
      .from('therapists')
      .select('id, first_name, last_name, city, modalities, schwerpunkte, session_preferences, accepting_new, photo_url, status, metadata, typical_rate')
      .eq('status', 'verified')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[api.public.therapists] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch therapists' },
        { status: 500 }
      );
    }

    const rows = (data as TherapistRow[] | null) || [];

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
      .filter((row) => {
        if (hideIds.has(row.id)) return false;
        try {
          const md = (row.metadata || {}) as Record<string, unknown>;
          const hiddenVal: unknown = md ? (md as Record<string, unknown>)['hidden'] : undefined;
          const hidden = hiddenVal === true || String(hiddenVal).toLowerCase() === 'true';
          return !hidden;
        } catch {
          return true;
        }
      })
      .map((row) => {
        const mdObj: Record<string, unknown> =
          row?.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {};

        const profileUnknown = mdObj['profile'];
        const profile: Record<string, unknown> =
          profileUnknown && typeof profileUnknown === 'object'
            ? (profileUnknown as Record<string, unknown>)
            : {};

        // Legacy approach_text (fallback)
        const approach_text =
          typeof profile['approach_text'] === 'string'
            ? (profile['approach_text'] as string)
            : '';

        // New structured profile fields
        const who_comes_to_me = typeof profile['who_comes_to_me'] === 'string' ? profile['who_comes_to_me'] : undefined;
        const session_focus = typeof profile['session_focus'] === 'string' ? profile['session_focus'] : undefined;
        const first_session = typeof profile['first_session'] === 'string' ? profile['first_session'] : undefined;
        const about_me = typeof profile['about_me'] === 'string' ? profile['about_me'] : undefined;

        const languages = Array.isArray(profile['languages'])
          ? (profile['languages'] as string[])
          : [];
        const years_experience =
          typeof profile['years_experience'] === 'number'
            ? (profile['years_experience'] as number)
            : undefined;
        const practice_address = typeof profile['practice_address'] === 'string' ? profile['practice_address'] : undefined;
        
        // Get pre-computed availability from shared utility
        const availability = availabilityMap.get(row.id) || [];

        return {
          id: row.id,
          first_name: String(row.first_name || ''),
          last_name: String(row.last_name || ''),
          city: String(row.city || ''),
          modalities: Array.isArray(row.modalities) ? (row.modalities as string[]) : [],
          schwerpunkte: Array.isArray(row.schwerpunkte) ? (row.schwerpunkte as string[]) : [],
          session_preferences: Array.isArray(row.session_preferences) ? (row.session_preferences as string[]) : [],
          accepting_new: Boolean(row.accepting_new),
          photo_url: row.photo_url || undefined,
          approach_text,
          typical_rate: row.typical_rate,
          metadata: {
            profile: {
              // New structured fields
              ...(who_comes_to_me ? { who_comes_to_me } : {}),
              ...(session_focus ? { session_focus } : {}),
              ...(first_session ? { first_session } : {}),
              ...(about_me ? { about_me } : {}),
              // Existing fields
              ...(languages.length > 0 ? { languages } : {}),
              ...(typeof years_experience === 'number' ? { years_experience } : {}),
              ...(typeof profile['qualification'] === 'string' ? { qualification: profile['qualification'] } : {}),
              ...(practice_address ? { practice_address } : {}),
            },
          },
          availability,
        };
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
