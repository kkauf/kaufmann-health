// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LandingHero } from '@/features/landing/components/LandingHero';

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));

function render(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(ui);
  return { container, unmount: () => root.unmount() };
}

describe('LandingHero forwards form data-cta', () => {
  it('renders EmailEntryForm with data-cta attribute', async () => {
    const { container, unmount } = render(
      <LandingHero title="Test" formDataCta="se-page-signup" />
    );
    try {
      await new Promise((r) => setTimeout(r, 0));
      const form = container.querySelector('form');
      expect(form).toBeTruthy();
      expect(form?.getAttribute('data-cta')).toBe('se-page-signup');
    } finally {
      unmount();
    }
  });
});
