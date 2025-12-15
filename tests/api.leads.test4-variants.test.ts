import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/public/leads/route';

/**
 * Unit Tests: Test 4 - Concierge vs Self-Service Variant Gating
 * 
 * Tests that:
 * - Concierge variant skips auto-matching
 * - Self-service variant gets instant matches
 * - Campaign variant is stored correctly
 */

// Mocks - track campaign_variant passed to API
let lastCampaignVariant: string | null = null;

vi.mock('@/lib/server-analytics', () => ({
  ServerAnalytics: {
    trackEventFromRequest: vi.fn(),
  },
  parseAttributionFromRequest: vi.fn(() => ({ source: null, variant: null })),
  parseCampaignFromRequest: vi.fn(() => {
    // Returns the variant that was set in the test
    return { 
      campaign_source: 'test', 
      campaign_variant: lastCampaignVariant || undefined,
      landing_page: undefined,
    };
  }),
}));
vi.mock('@/lib/logger', () => ({ logError: vi.fn(), track: vi.fn() }));
vi.mock('@/lib/email/client', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/email/internalNotification', () => ({ buildInternalLeadNotification: vi.fn(() => ({ subject: 'x', html: '<p>x</p>' })) }));
vi.mock('@/lib/email/templates/emailConfirmation', () => ({ renderEmailConfirmation: vi.fn(() => ({ subject: 'x', html: '<p>x</p>' })) }));
vi.mock('@/lib/test-mode', () => ({ isTestRequest: () => true }));
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: { from: vi.fn() } }));
vi.mock('@/features/leads/lib/rateLimit', () => ({ isIpRateLimited: vi.fn(async () => false) }));

// Track whether createInstantMatchesForPatient was called
let matchFnCalled = false;
let matchFnVariant: string | undefined;
let mockMatchResult: { matchesUrl: string; matchQuality: 'exact' | 'partial' | 'none' } | null = null;

vi.mock('@/features/leads/lib/match', () => ({
  createInstantMatchesForPatient: vi.fn(async (_patientId: string, variant?: string) => {
    matchFnCalled = true;
    matchFnVariant = variant;
    return mockMatchResult;
  }),
  computeMismatches: vi.fn(() => ({ mismatches: {}, isPerfect: true, reasons: [] })),
}));

import { supabaseServer } from '@/lib/supabase-server';
import { ServerAnalytics } from '@/lib/server-analytics';

function makeReq(body: Record<string, unknown>, headers?: Record<string, string>) {
  return new Request('http://localhost/api/public/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

function wireSupabase(campaignVariant?: string) {
  let storedMetadata: Record<string, unknown> = {};
  
  (supabaseServer.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table === 'people') {
      return {
        insert: (data: Record<string, unknown>) => {
          storedMetadata = (data as { metadata?: Record<string, unknown> }).metadata || {};
          return {
            select: () => ({
              single: async () => ({
                data: { id: 'p-test4', campaign_variant: campaignVariant },
                error: null,
              }),
            }),
          };
        },
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: 'p-test4',
                metadata: storedMetadata,
                campaign_variant: campaignVariant,
              },
              error: null,
            }),
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
      } as unknown;
    }
    if (table === 'therapists') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: async () => ({
                data: [{ id: 't1', status: 'verified', accepting_new: true }],
                error: null,
              }),
            }),
          }),
        }),
      } as unknown;
    }
    if (table === 'therapist_slots') {
      return {
        select: () => ({
          in: () => ({
            eq: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        }),
      } as unknown;
    }
    if (table === 'matches') {
      return {
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { secure_uuid: 'su-test4' }, error: null }),
          }),
        }),
      } as unknown;
    }
    return { select: () => ({}) } as unknown;
  });
}

describe('Test 4: Concierge vs Self-Service Variant Gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    matchFnCalled = false;
    matchFnVariant = undefined;
    mockMatchResult = null;
    lastCampaignVariant = null;
    process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW = 'true';
  });

  describe('Concierge Variant', () => {
    it('skips auto-matching for concierge variant', async () => {
      lastCampaignVariant = 'concierge';
      wireSupabase('concierge');
      
      const res = await POST(makeReq({
        type: 'patient',
        email: 'concierge@example.com',
        contact_method: 'email',
        consent_share_with_therapists: true,
        privacy_version: '2024-10-01',
      })) as Response;
      
      const json = await res.json();
      expect(res.status).toBe(200);
      
      // Should NOT have called createInstantMatchesForPatient
      expect(matchFnCalled).toBe(false);
      
      // Should NOT return matchesUrl
      expect(json.data.matchesUrl).toBeUndefined();
    });

    it('tracks concierge_lead_created event', async () => {
      lastCampaignVariant = 'concierge';
      wireSupabase('concierge');
      
      await POST(makeReq({
        type: 'patient',
        email: 'concierge@example.com',
        contact_method: 'email',
        consent_share_with_therapists: true,
        privacy_version: '2024-10-01',
      }));
      
      // Check that the analytics was called with concierge_lead_created
      expect(ServerAnalytics.trackEventFromRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'concierge_lead_created',
          props: expect.objectContaining({
            requires_manual_matching: true,
          }),
        })
      );
    });
  });

  describe('Self-Service Variant', () => {
    it('calls auto-matching for self-service variant', async () => {
      lastCampaignVariant = 'self-service';
      wireSupabase('self-service');
      mockMatchResult = { matchesUrl: '/matches/test-uuid', matchQuality: 'exact' };
      
      const res = await POST(makeReq({
        type: 'patient',
        email: 'selfservice@example.com',
        contact_method: 'email',
        consent_share_with_therapists: true,
        privacy_version: '2024-10-01',
      })) as Response;
      
      const json = await res.json();
      expect(res.status).toBe(200);
      
      // Should have called createInstantMatchesForPatient
      expect(matchFnCalled).toBe(true);
      expect(matchFnVariant).toBe('self-service');
      
      // Flow A: matchesUrl is not returned before verification
      expect(json.data.matchesUrl).toBeUndefined();
    });

    it('tracks instant_match_created event', async () => {
      lastCampaignVariant = 'self-service';
      wireSupabase('self-service');
      mockMatchResult = { matchesUrl: '/matches/test-uuid', matchQuality: 'exact' };
      
      await POST(makeReq({
        type: 'patient',
        email: 'selfservice@example.com',
        contact_method: 'email',
        consent_share_with_therapists: true,
        privacy_version: '2024-10-01',
      }));
      
      // Check that analytics was called with instant_match_created
      expect(ServerAnalytics.trackEventFromRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'instant_match_created',
          props: expect.objectContaining({
            match_quality: 'exact',
          }),
        })
      );
    });
  });

  describe('Marketplace Variant (backward compatibility)', () => {
    it('calls auto-matching for marketplace variant', async () => {
      lastCampaignVariant = 'marketplace';
      wireSupabase('marketplace');
      mockMatchResult = { matchesUrl: '/matches/test-uuid', matchQuality: 'partial' };
      
      const res = await POST(makeReq({
        type: 'patient',
        email: 'marketplace@example.com',
        contact_method: 'email',
        consent_share_with_therapists: true,
        privacy_version: '2024-10-01',
      })) as Response;
      
      const json = await res.json();
      expect(res.status).toBe(200);
      
      // Should have called createInstantMatchesForPatient
      expect(matchFnCalled).toBe(true);
      
      // Flow A: matchesUrl is not returned before verification
      expect(json.data.matchesUrl).toBeUndefined();
    });
  });

  describe('No Variant (default behavior)', () => {
    it('calls auto-matching when no variant specified', async () => {
      lastCampaignVariant = null;
      wireSupabase(undefined);
      mockMatchResult = { matchesUrl: '/matches/test-uuid', matchQuality: 'none' };
      
      const res = await POST(makeReq({
        type: 'patient',
        email: 'default@example.com',
        contact_method: 'email',
        consent_share_with_therapists: true,
        privacy_version: '2024-10-01',
      })) as Response;
      
      const json = await res.json();
      expect(res.status).toBe(200);
      
      // Should have called createInstantMatchesForPatient (backward compat)
      expect(matchFnCalled).toBe(true);
      
      // Flow A: matchesUrl is not returned before verification
      expect(json.data.matchesUrl).toBeUndefined();
    });
  });
});
