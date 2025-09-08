import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// High-ROI health check: verify required storage buckets exist in the target project.
// Skips gracefully if env vars are not provided.

describe('storage health', () => {
  it('required buckets exist (therapist-applications, therapist-profiles, therapist-documents)', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      // Skipped locally/CI if env not set. This test is intended for environments
      // where we can talk to the real project (e.g., after migrations).
      return;
    }

    const supabase = createClient(url, serviceKey);

    const { data, error } = await supabase.storage.listBuckets();
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const ids = (data || []).map((b: any) => b.id);

    // Existing from EARTH-69
    expect(ids).toContain('therapist-documents');
    // Added in EARTH-116
    expect(ids).toContain('therapist-applications');
    expect(ids).toContain('therapist-profiles');
  });
});
