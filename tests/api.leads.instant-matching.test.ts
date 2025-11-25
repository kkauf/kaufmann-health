import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/public/leads/route';

// Mocks
vi.mock('@/lib/server-analytics', () => ({ ServerAnalytics: { trackEventFromRequest: vi.fn() }, parseAttributionFromRequest: vi.fn(() => ({ source: null, variant: null })), parseCampaignFromRequest: vi.fn(() => ({ source: null, variant: null })) }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn(), track: vi.fn() }));
vi.mock('@/lib/email/client', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/email/internalNotification', () => ({ buildInternalLeadNotification: vi.fn(() => ({ subject: 'x', html: '<p>x</p>' })) }));
vi.mock('@/lib/email/templates/emailConfirmation', () => ({ renderEmailConfirmation: vi.fn(() => ({ subject: 'x', html: '<p>x</p>' })) }));
vi.mock('@/lib/test-mode', () => ({ isTestRequest: () => true }));
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: { from: vi.fn() } }));
vi.mock('@/features/leads/lib/rateLimit', () => ({ isIpRateLimited: vi.fn(async () => false) }));

import { supabaseServer } from '@/lib/supabase-server';

function makeReq(body: any, headers?: Record<string, string>) {
  return new Request('http://localhost/api/public/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

function wireSupabaseForInstantMatch({ patientMeta, therapists, slots, secureUuid = 'su-123' }: { patientMeta: any; therapists: any[]; slots: any[]; secureUuid?: string }) {
  (supabaseServer.from as unknown as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    if (table === 'people') {
      return {
        // insert patient
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'p-1' }, error: null }) }) }),
        // fetch patient meta after insert - chain: select().eq().single()
        select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'p-1', metadata: patientMeta }, error: null }) }) }),
        // update patient metadata - chain: update().eq()
        update: () => ({ eq: async () => ({ error: null }) }),
      } as any;
    }
    if (table === 'therapists') {
      // Chain: select().eq().eq().limit() - two eq() calls for status
      return { select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: therapists, error: null }) }) }) }) } as any;
    }
    if (table === 'therapist_slots') {
      // Chain: select().in().eq().limit()
      return { select: () => ({ in: () => ({ eq: () => ({ limit: async () => ({ data: slots, error: null }) }) }) }) } as any;
    }
    if (table === 'matches') {
      return {
        insert: () => ({ select: () => ({ single: async () => ({ data: { secure_uuid: secureUuid }, error: null }) }) }),
      } as any;
    }
    // default
    return { select: () => ({}) } as any;
  });
}

describe('Leads API - Instant Matching (EARTH-229)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Feature Flag Gating', () => {
    it('returns matchesUrl when NEXT_PUBLIC_DIRECT_BOOKING_FLOW=true', async () => {
      process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW = 'true';
      wireSupabaseForInstantMatch({
        patientMeta: { time_slots: ['Morgens (8-12 Uhr)'] },
        therapists: [
          { id: 't1', status: 'verified', accepting_new: true, session_preferences: ['online', 'in_person'], modalities: ['NARM'] },
        ],
        slots: [{ therapist_id: 't1', day_of_week: new Date().getUTCDay(), time_local: '09:00', format: 'online', address: null, active: true }],
      });
      const res = await POST(makeReq({ type: 'patient', email: 'patient@example.com', contact_method: 'email', consent_share_with_therapists: true, privacy_version: '2024-10-01' })) as Response;
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.matchesUrl).toMatch(/^\/matches\//);
    });

    it('does not return matchesUrl when flag is false', async () => {
      process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW = 'false';
      wireSupabaseForInstantMatch({ patientMeta: {}, therapists: [], slots: [] });
      const res = await POST(makeReq({ type: 'patient', email: 'patient@example.com', contact_method: 'email', consent_share_with_therapists: true, privacy_version: '2024-10-01' })) as Response;
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.matchesUrl).toBeUndefined();
    });

    it('does not return matchesUrl when flag is missing', async () => {
      delete process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW;
      wireSupabaseForInstantMatch({ patientMeta: {}, therapists: [], slots: [] });
      const res = (await POST(
        makeReq({ type: 'patient', email: 'patient@example.com', contact_method: 'email', consent_share_with_therapists: true, privacy_version: '2024-10-01' })
      )) as Response;
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.matchesUrl).toBeUndefined();
    });
  });

  describe('Match Creation', () => {
    beforeEach(() => { process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW = 'true'; });

    it('creates up to 3 match rows for matching therapists', async () => {
      wireSupabaseForInstantMatch({
        patientMeta: { time_slots: ['Morgens (8-12 Uhr)'] },
        therapists: [
          { id: 't1', status: 'verified', accepting_new: true, session_preferences: ['online', 'in_person'], modalities: ['NARM'] },
          { id: 't2', status: 'verified', accepting_new: true, session_preferences: ['online'], modalities: ['Hakomi'] },
          { id: 't3', status: 'verified', accepting_new: false, session_preferences: ['in_person'], modalities: [] },
        ],
        slots: [ { therapist_id: 't1', day_of_week: new Date().getUTCDay(), time_local: '09:30', format: 'online', address: null, active: true } ],
      });
      const res = await POST(makeReq({ type: 'patient', email: 'patient@example.com', contact_method: 'email', consent_share_with_therapists: true, privacy_version: '2024-10-01' })) as Response;
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.matchesUrl).toBeDefined();
    });

    it('creates empty match when no therapists available', async () => {
      // Test scenario where no therapists match criteria
      wireSupabaseForInstantMatch({ patientMeta: {}, therapists: [], slots: [] });
      const res = await POST(makeReq({ type: 'patient', email: 'niche@test.com', contact_method: 'email', consent_share_with_therapists: true, privacy_version: '2024-10-01' })) as Response;
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.matchesUrl).toBeDefined();
    });
  });

  describe('Time-of-Day Matching', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW = 'true';
    });

    it('considers morning availability preference', async () => {
      wireSupabaseForInstantMatch({
        patientMeta: { time_slots: ['Morgens (8-12 Uhr)'] },
        therapists: [{ id: 't1', status: 'verified', accepting_new: true, session_preferences: ['online'], modalities: [] }],
        slots: [{ therapist_id: 't1', day_of_week: new Date().getUTCDay(), time_local: '08:30', format: 'online', address: null, active: true }],
      });
      const res = await POST(makeReq({ type: 'patient', email: 'morning@test.com', contact_method: 'email', consent_share_with_therapists: true, privacy_version: '2024-10-01' })) as Response;
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.matchesUrl).toBeDefined();
    });

    it('handles flexible time preference', async () => {
      wireSupabaseForInstantMatch({
        patientMeta: { time_slots: ['Bin flexibel'] },
        therapists: [{ id: 't1', status: 'verified', accepting_new: true, session_preferences: ['online'], modalities: [] }],
        slots: [{ therapist_id: 't1', day_of_week: new Date().getUTCDay(), time_local: '18:00', format: 'online', address: null, active: true }],
      });
      const res = await POST(makeReq({ type: 'patient', email: 'flexible@test.com', contact_method: 'email', consent_share_with_therapists: true, privacy_version: '2024-10-01' })) as Response;
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.matchesUrl).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW = 'true';
    });

    it('handles missing form_session_id gracefully', async () => {
      wireSupabaseForInstantMatch({ patientMeta: {}, therapists: [], slots: [] });
      const res = await POST(makeReq({ type: 'patient', email: 'nosession@test.com', contact_method: 'email', consent_share_with_therapists: true, privacy_version: '2024-10-01' })) as Response;
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.matchesUrl).toBeDefined();
    });

    it('works with phone contact method', async () => {
      wireSupabaseForInstantMatch({ patientMeta: {}, therapists: [{ id: 't1', status: 'verified', accepting_new: true, session_preferences: ['online'], modalities: [] }], slots: [] });
      const res = await POST(makeReq({ type: 'patient', phone_number: '+491234567890', contact_method: 'phone', consent_share_with_therapists: true, privacy_version: '2024-10-01' })) as Response;
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.data.matchesUrl).toBeDefined();
    });
  });
});
