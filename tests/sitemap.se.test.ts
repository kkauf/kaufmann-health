import { describe, it, expect } from 'vitest';

describe('Sitemap includes SE page', () => {
  it('has /therapie/somatic-experiencing entry', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://www.kaufmann-health.de/therapie/somatic-experiencing');
  });
});
