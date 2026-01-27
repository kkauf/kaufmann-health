import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Patient Behavior Classification for Day 10 Behavioral Email
// ============================================================================

export type PatientBehaviorSegment =
  | { segment: 'never_visited' }
  | { segment: 'visited_no_action'; visitCount: number }
  | { segment: 'rejected'; reasons: { reason: string; therapist_id: string; details?: string }[] }
  | { segment: 'almost_booked'; therapist_id: string }
  | { segment: 'contacted' };

// Priority order: contacted > almost_booked > rejected > visited_no_action > never_visited

const RELEVANT_EVENT_TYPES = [
  'match_page_view',
  'match_rejected',
  'contact_modal_opened',
  'contact_message_sent',
] as const;

type EventRow = {
  type: string;
  properties?: Record<string, unknown> | null;
};

/**
 * Batch-classify patients by their match page interactions.
 * Single query for all patients, grouped in JS.
 *
 * @param secureUuids - Map of secureUuid → patientId
 * @param sinceIso - ISO date to look back from (typically 11 days)
 */
export async function batchClassifyBehavior(
  supabase: SupabaseClient,
  secureUuids: Map<string, string>,
  sinceIso: string,
): Promise<Map<string, PatientBehaviorSegment>> {
  const result = new Map<string, PatientBehaviorSegment>();
  if (secureUuids.size === 0) return result;

  // Fetch all relevant events in one query
  const { data: events, error } = await supabase
    .from('events')
    .select('type, properties')
    .in('type', [...RELEVANT_EVENT_TYPES])
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error || !events) return result;

  // Group events by secure_uuid
  type GroupedEvents = {
    views: number;
    rejections: { reason: string; therapist_id: string; details?: string }[];
    modalOpened: string | null; // therapist_id
    messageSent: boolean;
  };

  const grouped = new Map<string, GroupedEvents>();

  for (const event of events as EventRow[]) {
    const props = event.properties;
    if (!props || typeof props !== 'object') continue;

    const uuid = typeof props['secure_uuid'] === 'string' ? props['secure_uuid'] : null;
    if (!uuid || !secureUuids.has(uuid)) continue;

    if (!grouped.has(uuid)) {
      grouped.set(uuid, { views: 0, rejections: [], modalOpened: null, messageSent: false });
    }
    const g = grouped.get(uuid)!;

    switch (event.type) {
      case 'match_page_view':
        g.views++;
        break;
      case 'match_rejected': {
        const reason = typeof props['reason'] === 'string' ? props['reason'] : 'unknown';
        const therapistId = typeof props['therapist_id'] === 'string' ? props['therapist_id'] : '';
        const details = typeof props['details'] === 'string' ? props['details'] : undefined;
        if (therapistId) {
          g.rejections.push({ reason, therapist_id: therapistId, details });
        }
        break;
      }
      case 'contact_modal_opened': {
        const tid = typeof props['therapist_id'] === 'string' ? props['therapist_id'] : null;
        if (tid && !g.modalOpened) g.modalOpened = tid;
        break;
      }
      case 'contact_message_sent':
        g.messageSent = true;
        break;
    }
  }

  // Classify each patient by priority
  for (const [uuid, patientId] of secureUuids) {
    const g = grouped.get(uuid);

    if (!g) {
      // No events at all for this secure_uuid
      result.set(patientId, { segment: 'never_visited' });
      continue;
    }

    // Priority 1: contacted (message sent)
    if (g.messageSent) {
      result.set(patientId, { segment: 'contacted' });
      continue;
    }

    // Priority 2: almost_booked (opened contact modal but didn't send)
    if (g.modalOpened) {
      result.set(patientId, { segment: 'almost_booked', therapist_id: g.modalOpened });
      continue;
    }

    // Priority 3: rejected (actively rejected a therapist)
    if (g.rejections.length > 0) {
      result.set(patientId, { segment: 'rejected', reasons: g.rejections });
      continue;
    }

    // Priority 4: visited but took no action
    if (g.views > 0) {
      result.set(patientId, { segment: 'visited_no_action', visitCount: g.views });
      continue;
    }

    // Fallback: never visited (events existed but none were page views)
    result.set(patientId, { segment: 'never_visited' });
  }

  return result;
}
