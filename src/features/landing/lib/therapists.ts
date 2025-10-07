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

  return {
    id: row.id,
    first_name: String(row.first_name || ''),
    last_name: String(row.last_name || ''),
    city: String(row.city || ''),
    modalities: Array.isArray(row.modalities) ? (row.modalities as string[]) : [],
    accepting_new: Boolean(row.accepting_new),
    photo_url: row.photo_url || undefined,
    approach_text,
  };
}

export async function getTherapistsByIds(ids: string[]): Promise<AppTherapist[]> {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await supabaseServer
    .from('therapists')
    .select('id, first_name, last_name, city, modalities, accepting_new, photo_url, status, metadata')
    .in('id', ids)
    .eq('status', 'verified')
    .not('photo_url', 'is', null);

  if (error) {
    console.error('[landing/lib/therapists] getTherapistsByIds error:', error);
    return [];
  }
  const rows = (data as TherapistRow[] | null) || [];
  return rows.map(mapTherapistRow);
}

export async function getTherapistsForLanding(options?: {
  city?: string;
  accepting_new?: boolean;
  limit?: number;
}): Promise<AppTherapist[]> {
  let query = supabaseServer
    .from('therapists')
    .select('id, first_name, last_name, city, modalities, accepting_new, photo_url, status, metadata')
    .eq('status', 'verified')
    .not('photo_url', 'is', null);

  if (options?.city) {
    query = query.eq('city', options.city);
  }
  if (typeof options?.accepting_new === 'boolean') {
    query = query.eq('accepting_new', options.accepting_new);
  }
  if (options?.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[landing/lib/therapists] getTherapistsForLanding error:', error);
    return [];
  }
  const rows = (data as TherapistRow[] | null) || [];
  return rows.map(mapTherapistRow);
}
