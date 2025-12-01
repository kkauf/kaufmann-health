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

  it('rejects invalid stage', async () => {
    const res = await GET(makeRequest('invalid', 'test-secret'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid stage');
  });

  it('accepts valid stages', async () => {
    for (const stage of ['day2', 'day5', 'day10']) {
      const res = await GET(makeRequest(stage, 'test-secret'));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.stage).toBe(stage);
    }
  });

  it('returns processing stats', async () => {
    const res = await GET(makeRequest('day2', 'test-secret'));
    const json = await res.json();
    
    expect(json.data).toHaveProperty('processed');
    expect(json.data).toHaveProperty('sent');
    expect(json.data).toHaveProperty('skipped');
    expect(json.data.skipped).toHaveProperty('no_matches');
    expect(json.data.skipped).toHaveProperty('already_selected');
    expect(json.data.skipped).toHaveProperty('already_sent');
  });
});
