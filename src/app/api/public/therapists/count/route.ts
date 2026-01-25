import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getHiddenTherapistIds } from '@/lib/therapist-mapper';
import { isEligible, normalizeSpec, type TherapistRowForMatch, type PatientMeta } from '@/features/leads/lib/match';
import { TherapistCountQuery, type TherapistCountOutput } from '@/contracts/therapist-count';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/public/therapists/count
 * 
 * Returns count of available therapists matching given filters.
 * Used for progressive filtering display in the questionnaire wizard.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const queryResult = TherapistCountQuery.safeParse({
      session_preference: searchParams.get('session_preference') || undefined,
      city: searchParams.get('city') || undefined,
      gender_preference: searchParams.get('gender_preference') || undefined,
      schwerpunkte: searchParams.get('schwerpunkte') || undefined,
      modality: searchParams.get('modality') || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const filters = queryResult.data;
    const hideIds = new Set(getHiddenTherapistIds());

    // Fetch all verified therapists (lightweight query - only fields needed for filtering)
    const { data, error } = await supabaseServer
      .from('therapists')
      .select('id, gender, city, session_preferences, modalities, schwerpunkte, accepting_new, metadata')
      .eq('status', 'verified')
      .limit(1000);

    if (error) {
      console.error('[api.public.therapists.count] Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch therapists' }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];

    // Build patient meta from filters for eligibility check
    const patientMeta: PatientMeta = {};
    
    if (filters.session_preference) {
      if (filters.session_preference === 'either') {
        patientMeta.session_preferences = ['online', 'in_person'];
      } else {
        patientMeta.session_preference = filters.session_preference;
      }
    }
    
    if (filters.city) {
      patientMeta.city = filters.city;
    }
    
    if (filters.gender_preference && filters.gender_preference !== 'no_preference') {
      patientMeta.gender_preference = filters.gender_preference;
    }
    
    if (filters.schwerpunkte) {
      patientMeta.schwerpunkte = filters.schwerpunkte.split(',').filter(Boolean);
    }
    
    if (filters.modality) {
      patientMeta.specializations = [filters.modality];
    }

    // Count therapists that pass filters
    let count = 0;
    const MAX_DISPLAY = 50; // Cap display at "50+"

    for (const row of rows) {
      // Skip hidden therapists
      if (hideIds.has(row.id)) continue;

      // Skip therapists hidden from directory or test accounts
      const metadata = row.metadata as Record<string, unknown> | null;
      if (metadata?.hide_from_directory === true) continue;
      if (metadata?.hidden === true) continue;
      if (metadata?.is_test === true) continue;

      // Build therapist row for eligibility check
      const tRow: TherapistRowForMatch = {
        id: row.id,
        gender: row.gender || undefined,
        city: row.city || undefined,
        session_preferences: row.session_preferences,
        modalities: row.modalities,
        schwerpunkte: row.schwerpunkte,
        accepting_new: row.accepting_new,
        metadata: metadata as TherapistRowForMatch['metadata'],
      };

      // Check eligibility (hard filters: accepting_new, gender, session format)
      if (!isEligible(tRow, patientMeta)) continue;

      // Additional soft filter: schwerpunkte overlap (at least 1 match if specified)
      if (patientMeta.schwerpunkte && patientMeta.schwerpunkte.length > 0) {
        const therapistSchwerpunkte = new Set(
          Array.isArray(row.schwerpunkte) ? (row.schwerpunkte as string[]) : []
        );
        const _hasOverlap = patientMeta.schwerpunkte.some(s => therapistSchwerpunkte.has(s));
        // Don't hard-filter on schwerpunkte - count all eligible, but this could be used for "exact match" count
      }

      // Additional soft filter: modality overlap
      if (patientMeta.specializations && patientMeta.specializations.length > 0) {
        const _therapistModalities = new Set(
          (Array.isArray(row.modalities) ? (row.modalities as string[]) : []).map(m => normalizeSpec(String(m)))
        );
        const _patientMods = patientMeta.specializations.map(s => normalizeSpec(String(s)));
        // Don't hard-filter on modality - count all eligible
      }

      count++;
      
      // Early exit if we've exceeded display cap
      if (count > MAX_DISPLAY) break;
    }

    const response: TherapistCountOutput = {
      count: Math.min(count, MAX_DISPLAY),
      hasMore: count > MAX_DISPLAY,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[api.public.therapists.count] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
