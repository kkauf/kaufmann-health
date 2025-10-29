import { describe, it, expect, beforeAll } from 'vitest';

describe('SE page metadata', () => {
  beforeAll(() => {
    // Mock Supabase env vars to prevent import errors
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('has canonical and <160 char description', async () => {
    const { metadata } = await import('@/app/therapie/somatic-experiencing/page');
    const m = await metadata({ searchParams: {} });
    expect(m.alternates?.canonical).toContain('/therapie/somatic-experiencing');
    const desc = String(m.description || '');
    expect(desc.length).toBeLessThanOrEqual(160);
  });
});
