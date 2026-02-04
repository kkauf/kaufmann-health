import { supabaseServer } from '@/lib/supabase-server';

/**
 * Returns the set of patient IDs that have at least one non-stale match.
 *
 * A match is "stale" when the patient is a returning concierge user
 * (`metadata.returning_concierge_at`) and the match was created before that
 * timestamp. Stale matches don't count — the patient needs fresh matching.
 *
 * This is the single source of truth for "has non-stale matches" logic.
 * The admin UI (`/admin/leads`) uses a client-side mirror of this check
 * inside `loadPatientMatchFlags`.
 */
export async function getPatientIdsWithNonStaleMatches(
  patientIds: string[],
  metadataByPatientId: Map<string, Record<string, unknown>>,
): Promise<Set<string>> {
  if (patientIds.length === 0) return new Set();

  const { data } = await supabaseServer
    .from('matches')
    .select('patient_id, created_at')
    .in('patient_id', patientIds);

  const result = new Set<string>();

  for (const m of data || []) {
    const pid = m.patient_id as string;
    const meta = metadataByPatientId.get(pid);
    const returningAt = meta?.returning_concierge_at;

    if (
      typeof returningAt === 'string' &&
      typeof m.created_at === 'string' &&
      m.created_at < returningAt
    ) {
      // Stale match — skip
      continue;
    }

    result.add(pid);
  }

  return result;
}
