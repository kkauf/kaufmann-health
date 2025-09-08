import { vi } from 'vitest';

// Mock Vercel Analytics in tests to avoid resolving Next-specific modules
vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@vercel/analytics/next', () => ({
  Analytics: (_props: any) => null,
}));
