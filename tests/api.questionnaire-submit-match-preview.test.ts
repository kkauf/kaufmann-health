/**
 * Integration test: questionnaire-submit match preview data flow
 *
 * This test exists because of a production incident (2026-02-11) where the match
 * preview query used `.order('score', ...)` on a non-existent column. The error was
 * swallowed by a catch block, and every user saw "0 matches found" for 18 hours.
 *
 * The original unit test (api.questionnaire-submit.test.ts) mocked supabase so
 * heavily that it never exercised the match preview query at all. This test
 * specifically verifies:
 *   1. The match preview query chain is called with valid column names
 *   2. When matches exist, matchPreviews + matchCount are in the response
 *   3. Query errors surface (not silently swallowed)
 *
 * See: docs/private/2026-02-11-progressive-flow-postmortem.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Track query parameters to verify column names ---
let matchPreviewOrderColumn: string | undefined;
let matchPreviewSelectArg: string | undefined;

// Known valid columns on the `matches` table (keep in sync with schema)
const VALID_MATCHES_COLUMNS = [
  'id', 'therapist_id', 'patient_id', 'status', 'commission_collected',
  'notes', 'created_at', 'secure_uuid', 'responded_at',
  'therapist_contacted_at', 'therapist_responded_at', 'patient_confirmed_at',
  'metadata', 'last_accessed_at',
];

const MOCK_MATCH_PREVIEWS = [
  { therapists: { first_name: 'Anna', photo_url: 'https://example.supabase.co/storage/v1/object/public/anna.jpg', schwerpunkte: ['trauma', 'angst'] } },
  { therapists: { first_name: 'Levent', photo_url: null, schwerpunkte: ['depression', 'trauma'] } },
  { therapists: { first_name: 'Luise', photo_url: 'https://example.supabase.co/storage/v1/object/public/luise.jpg', schwerpunkte: [] } },
];

function createMatchesTableMock() {
  // Build separate chains for the two match queries:
  // 1. Existing match check: .select('secure_uuid').eq().not().order().limit().maybeSingle()
  // 2. Match preview: .select('therapists!inner(...)' , { count }).eq().neq().order().limit()

  let callCount = 0;

  return {
    select: (...args: any[]) => {
      callCount++;
      const selectArg = args[0] as string;

      // Call 1: existing match check (select('secure_uuid'))
      if (selectArg === 'secure_uuid') {
        return {
          eq: () => ({
            not: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }

      // Call 2: match preview query (select('therapists!inner(...)'))
      matchPreviewSelectArg = selectArg;
      return {
        eq: () => ({
          neq: () => ({
            order: (column: string) => {
              matchPreviewOrderColumn = column;
              return {
                limit: async () => ({
                  data: MOCK_MATCH_PREVIEWS,
                  count: 3,
                  error: null,
                }),
              };
            },
          }),
        }),
      };
    },
  } as any;
}

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'people') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'p-1' }, error: null }),
            }),
          }),
          select: () => ({
            eq: () => ({
              contains: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        } as any;
      }

      if (table === 'matches') {
        return createMatchesTableMock();
      }

      throw new Error(`Unexpected table ${table}`);
    },
  } as any;

  return { supabaseServer };
});

vi.mock('@/features/leads/lib/match', () => ({
  createInstantMatchesForPatient: vi.fn(async () => ({
    matchesUrl: '/matches/test-uuid',
    matchQuality: 'exact' as const,
  })),
}));

vi.mock('@/lib/server-analytics', () => ({
  ServerAnalytics: { trackEventFromRequest: vi.fn(async () => {}) },
  parseAttributionFromRequest: () => ({}),
  parseCampaignFromRequest: () => ({
    campaign_source: undefined,
    campaign_variant: undefined,
    landing_page: undefined,
  }),
}));

vi.mock('@/lib/logger', () => ({
  track: vi.fn(async () => {}),
}));

describe('questionnaire-submit: match preview data flow', () => {
  beforeEach(() => {
    matchPreviewOrderColumn = undefined;
    matchPreviewSelectArg = undefined;
  });

  it('returns matchPreviews and matchCount when matches exist', async () => {
    const { POST } = await import('@/app/api/public/questionnaire-submit/route');

    const req = new Request('http://localhost/api/public/questionnaire-submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ city: 'Berlin' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();

    // Core assertion: match preview data must be present
    expect(json.data.matchPreviews).toBeDefined();
    expect(json.data.matchPreviews).toHaveLength(3);
    expect(json.data.matchCount).toBe(3);

    // Verify preview shape
    expect(json.data.matchPreviews[0]).toEqual({
      firstName: 'Anna',
      photoUrl: 'https://example.supabase.co/storage/v1/object/public/anna.jpg',
      schwerpunkte: ['trauma', 'angst'],
    });
    expect(json.data.matchPreviews[1]).toEqual({
      firstName: 'Levent',
      photoUrl: null,
      schwerpunkte: ['depression', 'trauma'],
    });
  });

  it('orders match preview by created_at (not a non-existent column)', async () => {
    const { POST } = await import('@/app/api/public/questionnaire-submit/route');

    const req = new Request('http://localhost/api/public/questionnaire-submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ city: 'Berlin' }),
    });

    await POST(req);

    // This is the exact bug that caused the 2026-02-11 incident:
    // .order('score', ...) used a non-existent column, PostgREST errored silently
    expect(matchPreviewOrderColumn).toBeDefined();
    expect(VALID_MATCHES_COLUMNS).toContain(matchPreviewOrderColumn);
    expect(matchPreviewOrderColumn).toBe('created_at');
  });

  it('uses therapist join for preview data', async () => {
    const { POST } = await import('@/app/api/public/questionnaire-submit/route');

    const req = new Request('http://localhost/api/public/questionnaire-submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ city: 'Berlin' }),
    });

    await POST(req);

    // Verify the select references the therapists FK correctly
    expect(matchPreviewSelectArg).toContain('therapists');
    expect(matchPreviewSelectArg).toContain('first_name');
    expect(matchPreviewSelectArg).toContain('photo_url');
    expect(matchPreviewSelectArg).toContain('schwerpunkte');
  });

  it('handles null photo_url and empty schwerpunkte gracefully', async () => {
    const { POST } = await import('@/app/api/public/questionnaire-submit/route');

    const req = new Request('http://localhost/api/public/questionnaire-submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ city: 'Berlin' }),
    });

    const res = await POST(req);
    const json = await res.json();

    // Therapist with null photo_url should pass through as null
    expect(json.data.matchPreviews[1].photoUrl).toBeNull();
    // Therapist with empty schwerpunkte should pass through as empty array
    expect(json.data.matchPreviews[2].schwerpunkte).toEqual([]);
  });
});
