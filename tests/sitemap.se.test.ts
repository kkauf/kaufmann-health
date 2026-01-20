import { describe, it, expect, vi } from 'vitest';

// Mock supabase-server to avoid requiring env vars in tests
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: () => ({
      select: () => ({
        eq: () => ({
          not: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

describe('Sitemap includes SE page', () => {
  it('has /therapie/somatic-experiencing entry', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://www.kaufmann-health.de/therapie/somatic-experiencing');
  });
});
