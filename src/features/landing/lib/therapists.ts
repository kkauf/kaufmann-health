import { supabaseServer } from '@/lib/supabase-server';
import type { Therapist as AppTherapist } from '@/components/TherapistPreview';

// Server-side helpers to fetch and map therapists for landing pages
// Keep mapping centralized to avoid duplication across pages.

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
  metadata?: unknown;
};

export function mapTherapistRow(row: TherapistRow): AppTherapist {
  const mdObj: Record<string, unknown> = row?.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {};
  const profileUnknown = mdObj['profile'];
  const profile: Record<string, unknown> = profileUnknown && typeof profileUnknown === 'object' ? (profileUnknown as Record<string, unknown>) : {};
  const approach_text = typeof profile['approach_text'] === 'string' ? (profile['approach_text'] as string) : '';
  const who_comes_to_me = typeof profile['who_comes_to_me'] === 'string' ? profile['who_comes_to_me'] : undefined;
  const session_focus = typeof profile['session_focus'] === 'string' ? profile['session_focus'] : undefined;

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
    metadata: (who_comes_to_me || session_focus) ? {
      profile: {
        ...(who_comes_to_me ? { who_comes_to_me } : {}),
        ...(session_focus ? { session_focus } : {}),
      },
    } : undefined,
  };
}

export async function getTherapistsByIds(ids: string[]): Promise<AppTherapist[]> {
  if (!ids || ids.length === 0) return [];
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
    .select('id, first_name, last_name, city, modalities, schwerpunkte, session_preferences, accepting_new, photo_url, status, metadata')
    .in('id', ids)
    .eq('status', 'verified')
    .not('photo_url', 'is', null);

  if (error) {
    console.error('[landing/lib/therapists] getTherapistsByIds error:', error);
    return [];
  }
  const rows = ((data as TherapistRow[] | null) || []).filter((row) => {
    if (hideIds.has(row.id)) return false;
    try {
      const md = (row.metadata || {}) as Record<string, unknown>;
      const hiddenVal: unknown = md ? (md as Record<string, unknown>)['hidden'] : undefined;
      const hidden = hiddenVal === true || String(hiddenVal).toLowerCase() === 'true';
      return !hidden;
    } catch {
      return true;
    }
  });
  return rows.map(mapTherapistRow);
}

export async function getTherapistsForLanding(options?: {
  city?: string;
  accepting_new?: boolean;
  modalities?: string[];
  limit?: number;
}): Promise<AppTherapist[]> {
  const hideIdsEnv = (process.env.HIDE_THERAPIST_IDS || '').trim();
  const hideIds = new Set(
    hideIdsEnv
      ? hideIdsEnv
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
  );
  let query = supabaseServer
    .from('therapists')
    .select('id, first_name, last_name, city, modalities, schwerpunkte, session_preferences, accepting_new, photo_url, status, metadata')
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
  const rows = ((data as TherapistRow[] | null) || []).filter((row) => {
    if (hideIds.has(row.id)) return false;
    try {
      const md = (row.metadata || {}) as Record<string, unknown>;
      const hiddenVal: unknown = md ? (md as Record<string, unknown>)['hidden'] : undefined;
      const hidden = hiddenVal === true || String(hiddenVal).toLowerCase() === 'true';
      return !hidden;
    } catch {
      return true;
    }
  });
  const mapped = rows.map(mapTherapistRow);
  if (options?.modalities && options.modalities.length > 0) {
    const wanted = new Set(options.modalities.map(m => String(m).toLowerCase().replace(/\s+/g, '-')));
    const filtered = mapped.filter(t => Array.isArray(t.modalities) && t.modalities.some(m => wanted.has(String(m).toLowerCase().replace(/\s+/g, '-'))));
    return filtered.slice(0, limit);
  }
  return mapped.slice(0, limit);
}
