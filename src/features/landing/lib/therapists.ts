import { supabaseServer } from '@/lib/supabase-server';
import {
  type TherapistData,
  mapTherapistRow,
  getHiddenTherapistIds,
  isTherapistHidden,
  parseTherapistRows,
  THERAPIST_SELECT_COLUMNS,
} from '@/lib/therapist-mapper';

// Server-side helpers to fetch therapists for landing pages.
// Uses shared mapper from @/lib/therapist-mapper for consistency.

export async function getTherapistsByIds(ids: string[]): Promise<TherapistData[]> {
  if (!ids || ids.length === 0) return [];
  const hideIds = getHiddenTherapistIds();

  const { data, error } = await supabaseServer
    .from('therapists')
    .select(THERAPIST_SELECT_COLUMNS)
    .in('id', ids)
    .eq('status', 'verified')
    .not('photo_url', 'is', null);

  if (error) {
    console.error('[landing/lib/therapists] getTherapistsByIds error:', error);
    return [];
  }

  // Validate with Zod schema
  return parseTherapistRows(data || [])
    .filter((row) => !isTherapistHidden(row, hideIds))
    .map((row) => mapTherapistRow(row));
}

export async function getTherapistsForLanding(options?: {
  city?: string;
  accepting_new?: boolean;
  modalities?: string[];
  limit?: number;
}): Promise<TherapistData[]> {
  const hideIds = getHiddenTherapistIds();

  let query = supabaseServer
    .from('therapists')
    .select(THERAPIST_SELECT_COLUMNS)
    .eq('status', 'verified')
    .not('photo_url', 'is', null);

  if (options?.city) {
    query = query.eq('city', options.city);
  }
  if (typeof options?.accepting_new === 'boolean') {
    query = query.eq('accepting_new', options.accepting_new);
  }

  const limit = options?.limit && options.limit > 0 ? options.limit : 3;
  const hasModalityFilter = Array.isArray(options?.modalities) && options.modalities.length > 0;
  const poolLimit = hasModalityFilter ? Math.max(limit * 5, 20) : Math.max(limit * 3, 10);
  query = query.limit(poolLimit);

  const { data, error } = await query;
  if (error) {
    console.error('[landing/lib/therapists] getTherapistsForLanding error:', error);
    return [];
  }

  // Validate with Zod schema
  const mapped = parseTherapistRows(data || [])
    .filter((row) => !isTherapistHidden(row, hideIds))
    .map((row) => mapTherapistRow(row));

  if (options?.modalities && options.modalities.length > 0) {
    const wanted = new Set(options.modalities.map(m => String(m).toLowerCase().replace(/\s+/g, '-')));
    const filtered = mapped.filter(t => 
      Array.isArray(t.modalities) && 
      t.modalities.some(m => wanted.has(String(m).toLowerCase().replace(/\s+/g, '-')))
    );
    return filtered.slice(0, limit);
  }

  return mapped.slice(0, limit);
}
