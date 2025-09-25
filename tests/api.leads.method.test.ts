import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => {
  return {
    track: vi.fn(async () => {}),
    logError: vi.fn(async () => {}),
  } as any;
});
// Prevent supabase client initialization during import of the route
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: {} as any }));

describe('/api/public/leads GET (wrong method)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs warn and returns 405 with cache headers', async () => {
    const { GET } = await import('@/app/api/public/leads/route');
    const { track } = await import('@/lib/logger');

    const req = new Request('http://localhost/api/public/leads', { method: 'GET' });
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(405);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(json).toEqual({ data: null, error: 'Use POST' });

    // Ensure a diagnostic event was attempted
    expect((track as any).mock.calls.length).toBeGreaterThan(0);
    const [firstCallArgs] = (track as any).mock.calls;
    expect(firstCallArgs[0]).toMatchObject({ type: 'leads_wrong_method' });
  });
});
