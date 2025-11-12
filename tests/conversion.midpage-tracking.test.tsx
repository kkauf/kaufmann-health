// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { FinalCtaSection } from '@/features/landing/components/FinalCtaSection';

function render(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, unmount: () => act(() => root.unmount()) };
}

describe('FinalCtaSection entry options (midpage analytics continuity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the CTA with correct heading and question', async () => {
    const { container, unmount } = render(<FinalCtaSection withEntryOptions />);
    
    try {
      expect(container.textContent).toMatch(/Bereit für den ersten Schritt\?/);
      expect(container.textContent).toContain('Wann möchtest du idealerweise beginnen?');
    } finally {
      unmount();
    }
  });

  it('renders all three timing answer buttons with correct labels', async () => {
    const { container, unmount } = render(<FinalCtaSection withEntryOptions />);
    
    try {
      expect(container.textContent).toContain('So schnell wie möglich');
      expect(container.textContent).toContain('In den nächsten 2-4 Wochen');
      expect(container.textContent).toContain('In 1-2 Monaten');
    } finally {
      unmount();
    }
  });

  it('answer buttons link to questionnaire with correct timing params', async () => {
    const { container, unmount } = render(<FinalCtaSection withEntryOptions />);
    
    try {
      const immediateLink = container.querySelector('[data-cta="midpage-conversion-immediate"]');
      const soonLink = container.querySelector('[data-cta="midpage-conversion-soon"]');
      const flexibleLink = container.querySelector('[data-cta="midpage-conversion-flexible"]');

      expect(immediateLink?.getAttribute('href')).toBe('/fragebogen?timing=immediate');
      expect(soonLink?.getAttribute('href')).toBe('/fragebogen?timing=soon');
      expect(flexibleLink?.getAttribute('href')).toBe('/fragebogen?timing=flexible');
    } finally {
      unmount();
    }
  });

  it('displays time indicator', async () => {
    const { container, unmount } = render(<FinalCtaSection withEntryOptions />);
    
    try {
      expect(container.textContent).toContain('3-Minuten Fragebogen');
    } finally {
      unmount();
    }
  });

  it('does not include directory link (questionnaire variant)', async () => {
    const { container, unmount } = render(<FinalCtaSection withEntryOptions />);
    
    try {
      const directoryLink = container.querySelector('[data-cta="midpage-conversion-directory"]');
      expect(directoryLink).toBeNull();
      expect(container.textContent).not.toContain('Alle Therapeut:innen ansehen');
    } finally {
      unmount();
    }
  });

  it('applies custom className when provided', async () => {
    const { container, unmount } = render(<FinalCtaSection withEntryOptions className="custom-test-class" />);
    
    try {
      const section = container.querySelector('section');
      expect(section?.className).toContain('custom-test-class');
    } finally {
      unmount();
    }
  });
});
