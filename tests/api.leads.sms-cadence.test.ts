import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue({ data: [], error: null }),
  },
}));

vi.mock('@/lib/auth/adminSession', () => ({
  ADMIN_SESSION_COOKIE: 'kh_admin',
  verifySessionToken: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/logger', () => ({
  track: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/sms/client', () => ({
  sendTransactionalSms: vi.fn().mockResolvedValue(true),
}));

import { GET } from '@/app/api/admin/leads/sms-cadence/route';

describe('GET /api/admin/leads/sms-cadence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  function makeRequest(stage: string, token?: string) {
    const url = `https://kaufmann-health.de/api/admin/leads/sms-cadence?stage=${stage}${token ? `&token=${token}` : ''}`;
    return new Request(url, { method: 'GET' });
  }

  it('requires authentication', async () => {
    const res = await GET(makeRequest('day2'));
    expect(res.status).toBe(401);
  });

  it('accepts cron token', async () => {
    const res = await GET(makeRequest('day2', 'test-secret'));
    expect(res.status).toBe(200);
  });

  it('falls back to all stages for invalid stage', async () => {
    const res = await GET(makeRequest('invalid', 'test-secret'));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Invalid stage falls back to processing all stages
    expect(json.data.stages).toEqual(['day2', 'day5', 'day10']);
  });

  it('accepts valid stages', async () => {
    for (const stage of ['day2', 'day5', 'day10']) {
      const res = await GET(makeRequest(stage, 'test-secret'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.stages).toContain(stage);
      expect(json.data.stages).toHaveLength(1);
    }
  });

  it('returns processing stats with totals', async () => {
    const res = await GET(makeRequest('day2', 'test-secret'));
    const json = await res.json();
    
    // New response format has stages, results array, and totals
    expect(json.data).toHaveProperty('stages');
    expect(json.data).toHaveProperty('results');
    expect(json.data).toHaveProperty('totals');
    expect(json.data.totals).toHaveProperty('processed');
    expect(json.data.totals).toHaveProperty('sent');
    expect(json.data.totals).toHaveProperty('skipped_no_matches');
  });

  it('processes all stages when no stage specified', async () => {
    const url = `https://kaufmann-health.de/api/admin/leads/sms-cadence?token=test-secret`;
    const res = await GET(new Request(url, { method: 'GET' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.stages).toEqual(['day2', 'day5', 'day10']);
    expect(json.data.results).toHaveLength(3);
  });
});
