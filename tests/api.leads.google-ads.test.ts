import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable state for the supabase mock
let rateLimited = false;
let insertError: any = null;
let insertResultId = 'lead-xyz';

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'people') {
        return {
          select: (_cols?: string) => ({
            contains: (_col?: string, _val?: any) => ({
              gte: (_col?: string, _cutoff?: string) => ({
                limit: (_n?: number) => Promise.resolve({ data: rateLimited ? [{}] : [], error: null }),
              }),
            }),
          }),
          insert: (_payload: any) => ({
            select: () => ({
              single: () =>
                Promise.resolve(
                  insertError ? { data: null, error: insertError } : { data: { id: insertResultId }, error: null },
                ),
            }),
          }),
        } as any;
      }
      if (table === 'therapists') {
        return {
          select: () => ({
            like: () => Promise.resolve({ data: [], error: null }),
          }),
          insert: (_payload: any) => ({
            select: () => ({
              single: () =>
                Promise.resolve(
                  insertError ? { data: null, error: insertError } : { data: { id: insertResultId }, error: null },
                ),
            }),
          }),
        } as any;
      }
      if (table === 'therapist_contracts') {
        return {
          insert: (_payload: any) => Promise.resolve({ data: { id: 'contract-id' }, error: null }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;
  return { supabaseServer };
});

// Mock email client (not relevant here, but route calls it)
vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(async () => true),
  sendTherapistEmail: vi.fn(async () => ({ sent: true })),
}));

// Spy on google ads tracker
const trackConversion = vi.fn(async (_d: any) => {});
vi.mock('@/lib/google-ads', () => ({
  googleAdsTracker: { trackConversion },
}));

function makeReq(body: any, headers?: Record<string, string>) {
  return new Request('http://localhost/api/public/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  rateLimited = false;
  insertResultId = 'lead-xyz';
  trackConversion.mockClear();
});

describe('Google Ads conversions', () => {
  it('does NOT fire conversion on patient email-only submit (fires later on preferences)', async () => {
    const { POST } = await import("@/app/api/public/leads/route");
    const res: any = await POST(
      makeReq(
        { email: 'patient@example.com', type: 'patient', consent_share_with_therapists: true, privacy_version: 'test-v1' },
        { 'x-forwarded-for': '1.2.3.4' },
      ),
    );
    expect(res.status).toBe(200);
    await Promise.resolve();
    expect(trackConversion).not.toHaveBeenCalled();
  });

  it('does NOT fire lead_verified conversion server-side on form completion (now handled by client)', async () => {
    // Jan 2026 architecture change: Server-side conversion firing was moved to client-side
    // to ensure proper sequencing (gtag base conversion must fire BEFORE server enhancement).
    // The client now calls fireLeadVerifiedWithEnhancement() which:
    // 1. Fires gtag base conversion
    // 2. Calls /api/public/conversions/enhance to trigger server enhancement
    const leadId = '11111111-1111-4111-8111-111111111111';
    // Mock people row for preferences route to include email
    vi.doMock('@/lib/supabase-server', () => {
      const api: any = {
        from: (table: string) => {
          if (table === 'people') {
            return {
              select: (_sel?: string) => ({
                eq: (_col?: string, _val?: string) => ({ single: async () => ({ data: { id: leadId, email: 'patient@example.com', type: 'patient', status: 'email_confirmed', metadata: {} }, error: null }) }),
              }),
              update: (_payload: any) => ({ eq: (_col?: string, _val?: string) => ({ data: null, error: null }) }),
            };
          }
          return { from: () => ({}) } as any;
        },
      } as any;
      return { supabaseServer: api };
    });
    const { POST: FORM_COMPLETED } = await import('@/app/api/public/leads/[id]/form-completed/route');
    const prefRes: any = await FORM_COMPLETED(new Request(`http://localhost/api/public/leads/${leadId}/form-completed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }) as any);
    expect(prefRes.status).toBe(200);
    await Promise.resolve();
    // Server no longer fires conversion directly - it's now triggered by client
    expect(trackConversion).not.toHaveBeenCalled();
  });

  it('does NOT fire therapist_registration conversion on therapist lead (fires on documents upload)', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const res: any = await POST(makeReq({ email: 'therapist@example.com', type: 'therapist', specializations: ['narm'] }));
    expect(res.status).toBe(200);

    await Promise.resolve();
    expect(trackConversion).not.toHaveBeenCalled();
  });
});
