import { describe, it, expect } from 'vitest';

describe('SE page metadata', () => {
  it('has canonical and <160 char description', async () => {
    const { metadata } = await import('@/app/therapie/somatic-experiencing/page');
    const m = await metadata({ searchParams: {} });
    expect(m.alternates?.canonical).toContain('/therapie/somatic-experiencing');
    const desc = String(m.description || '');
    expect(desc.length).toBeLessThanOrEqual(160);
  });
});
