import { describe, it, expect } from 'vitest';

// These imports should succeed and the modules should export `dynamic = 'force-dynamic'`

describe('admin routes are dynamic', () => {
  it('layout enforces dynamic rendering', async () => {
    const mod = await import('@/app/admin/layout');
    expect(mod.dynamic).toBe('force-dynamic');
  });

  it('admin index page enforces dynamic rendering', async () => {
    const mod = await import('@/app/admin/page');
    expect(mod.dynamic).toBe('force-dynamic');
  });

  it('admin login page enforces dynamic rendering', async () => {
    const mod = await import('@/app/admin/login/page');
    expect(mod.dynamic).toBe('force-dynamic');
  });
});
