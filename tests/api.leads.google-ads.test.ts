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
  sendEmail: vi.fn(async () => {}),
}));

// Spy on google ads tracker
const trackConversion = vi.fn(async (_d: any) => {});
vi.mock('@/lib/google-ads', () => ({
  googleAdsTracker: { trackConversion },
}));

function makeReq(body: any, headers?: Record<string, string>) {
  return new Request('http://localhost/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  rateLimited = false;
  insertError = null;
  insertResultId = 'lead-xyz';
  trackConversion.mockClear();
});

describe('/api/leads Google Ads conversions', () => {
  it('fires client_registration conversion with value 10 on patient lead', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const res = await POST(
      makeReq(
        { email: 'patient@example.com', type: 'patient', consent_share_with_therapists: true, privacy_version: 'test-v1' },
        { 'x-forwarded-for': '1.2.3.4' },
      ),
    );
    expect(res.status).toBe(200);

    // fire-and-forget; allow microtask flush
    await Promise.resolve();
    expect(trackConversion).toHaveBeenCalledTimes(1);
    const call = trackConversion.mock.calls[0][0];
    expect(call.conversionAction).toBe('client_registration');
    expect(call.conversionValue).toBe(10);
    expect(call.orderId).toBe('lead-xyz');
    expect(call.email).toBe('patient@example.com');
  });

  it('fires client_registration conversion with value 10 on patient lead', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const res = await POST(
      makeReq(
        { email: 'patient@example.com', type: 'patient', consent_share_with_therapists: true },
        { 'x-forwarded-for': '1.2.3.4' },
      ),
    );
    expect(res.status).toBe(200);

    await Promise.resolve();
    expect(trackConversion).toHaveBeenCalledTimes(1);
    const call = trackConversion.mock.calls[0][0];
    expect(call.conversionAction).toBe('client_registration');
    expect(call.conversionValue).toBe(10);
    expect(call.orderId).toBe('lead-xyz');
    expect(call.email).toBe('patient@example.com');
  });

  it('does NOT fire therapist_registration conversion on therapist lead (fires on documents upload)', async () => {
    const { POST } = await import('@/app/api/public/leads/route');
    const res = await POST(makeReq({ email: 'therapist@example.com', type: 'therapist', specializations: ['narm'] }));
    expect(res.status).toBe(200);

    await Promise.resolve();
    expect(trackConversion).not.toHaveBeenCalled();
  });
});
