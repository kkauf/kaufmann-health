/**
 * Cal.com Slots Cache (EARTH-248)
 *
 * Server-side caching of Cal.com availability to avoid slow DB queries on page load.
 * Cache is warmed by a cron job and stored in Supabase for fast reads.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { fetchCalSlotsFromDb, isCalDbEnabled } from './slots-db';

export interface CachedCalSlot {
  therapist_id: string;
  next_intro_date_iso: string | null;
  next_intro_time_label: string | null;
  next_intro_time_utc: string | null;
  slots_count: number;
  cached_at: string;
  last_error: string | null;
}

/**
 * Fetch cached slots for multiple therapists
 */
export async function getCachedCalSlots(
  therapistIds: string[]
): Promise<Map<string, CachedCalSlot>> {
  const result = new Map<string, CachedCalSlot>();
  if (therapistIds.length === 0) return result;

  try {
    const { data, error } = await supabaseServer
      .from('cal_slots_cache')
      .select('*')
      .in('therapist_id', therapistIds);

    if (error) {
      console.error('[cal/slots-cache] Failed to fetch cache:', error.message);
      return result;
    }

    for (const row of data || []) {
      result.set(row.therapist_id, row as CachedCalSlot);
    }
  } catch (err) {
    console.error('[cal/slots-cache] Error fetching cache:', err);
  }

  return result;
}

/**
 * Warm cache for a single therapist
 */
export async function warmCacheForTherapist(
  therapistId: string,
  calUsername: string
): Promise<{ success: boolean; error?: string; slotsCount?: number }> {
  if (!isCalDbEnabled()) {
    return { success: false, error: 'Cal DB not configured' };
  }

  try {
    const today = new Date();
    const start = today.toISOString().split('T')[0];
    // Fetch 14 days of slots
    const end = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const slots = await fetchCalSlotsFromDb(calUsername, 'intro', start, end, 'Europe/Berlin');

    if (slots === null) {
      // Update cache with error
      await supabaseServer.from('cal_slots_cache').upsert({
        therapist_id: therapistId,
        next_intro_date_iso: null,
        next_intro_time_label: null,
        next_intro_time_utc: null,
        slots_count: 0,
        cached_at: new Date().toISOString(),
        last_error: 'Failed to fetch slots from Cal DB',
      });
      return { success: false, error: 'Failed to fetch slots' };
    }

    // Find first available slot
    const firstSlot = slots[0] || null;

    // Upsert cache entry
    const { error: upsertError } = await supabaseServer.from('cal_slots_cache').upsert({
      therapist_id: therapistId,
      next_intro_date_iso: firstSlot?.date_iso || null,
      next_intro_time_label: firstSlot?.time_label || null,
      next_intro_time_utc: firstSlot?.time_utc || null,
      slots_count: slots.length,
      cached_at: new Date().toISOString(),
      last_error: null,
    });

    if (upsertError) {
      console.error('[cal/slots-cache] Upsert failed:', upsertError.message);
      return { success: false, error: upsertError.message };
    }

    return { success: true, slotsCount: slots.length };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cal/slots-cache] Error warming cache:', errMsg);

    // Try to record error in cache
    try {
      await supabaseServer.from('cal_slots_cache').upsert({
        therapist_id: therapistId,
        next_intro_date_iso: null,
        next_intro_time_label: null,
        next_intro_time_utc: null,
        slots_count: 0,
        cached_at: new Date().toISOString(),
        last_error: errMsg,
      });
    } catch {
      // Ignore secondary error
    }

    return { success: false, error: errMsg };
  }
}

/**
 * Warm cache for all Cal-enabled therapists
 * Returns summary of results
 */
export async function warmCacheForAllTherapists(): Promise<{
  total: number;
  success: number;
  failed: number;
  errors: Array<{ therapistId: string; error: string }>;
}> {
  // Fetch all Cal-enabled therapists with cal_bookings_live=true
  // Must match isCalBookingEnabled() check: cal_enabled && cal_username && cal_bookings_live
  const { data: therapists, error } = await supabaseServer
    .from('therapists')
    .select('id, cal_username')
    .eq('status', 'verified')
    .eq('cal_enabled', true)
    .eq('cal_bookings_live', true)
    .not('cal_username', 'is', null);

  if (error || !therapists) {
    console.error('[cal/slots-cache] Failed to fetch therapists:', error?.message);
    return { total: 0, success: 0, failed: 0, errors: [] };
  }

  const results = {
    total: therapists.length,
    success: 0,
    failed: 0,
    errors: [] as Array<{ therapistId: string; error: string }>,
  };

  // Process sequentially to avoid overwhelming Cal DB
  for (const t of therapists) {
    if (!t.cal_username) continue;

    const result = await warmCacheForTherapist(t.id, t.cal_username);
    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push({ therapistId: t.id, error: result.error || 'Unknown' });
    }

    // Small delay between therapists to be gentle on Cal DB
    await new Promise((r) => setTimeout(r, 100));
  }

  return results;
}

/**
 * Check if cache is stale (older than threshold)
 */
export function isCacheStale(cachedAt: string, maxAgeMinutes: number = 30): boolean {
  const cachedTime = new Date(cachedAt).getTime();
  const now = Date.now();
  return now - cachedTime > maxAgeMinutes * 60 * 1000;
}
