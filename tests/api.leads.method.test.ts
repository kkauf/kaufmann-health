import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => {
  return {
    track: vi.fn(async () => {}),
    logError: vi.fn(async () => {}),
  } as any;
});
// Prevent supabase client initialization during import of the route
vi.mock('@/lib/supabase-server', () => {
  return {
    supabaseServer: {} as any,
  };
});

describe('/api/leads GET (wrong method)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 405 with no-store and tracks a diagnostic event', async () => {
    const { GET } = await import('@/app/api/public/leads/route');
    const { track } = await import('@/lib/logger');

    const req = new Request('http://localhost/api/leads', { method: 'GET' });
    const res = await GET(req);

    expect(res.status).toBe(405);
    expect(res.headers.get('cache-control')).toBe('no-store');

    const body = await res.json();
    expect(body).toEqual({ data: null, error: 'Use POST' });

    // Ensure a diagnostic event was attempted
    expect((track as any).mock.calls.length).toBeGreaterThan(0);
    const [firstCallArgs] = (track as any).mock.calls;
    expect(firstCallArgs[0]).toMatchObject({ type: 'leads_wrong_method' });
  });
});
