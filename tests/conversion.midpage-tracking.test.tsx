// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { FinalCtaSection } from '@/features/landing/components/FinalCtaSection';

function render(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(ui);
  return { container, unmount: () => root.unmount() };
}

describe('FinalCtaSection entry options (midpage analytics continuity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the CTA with correct heading and question', async () => {
    const { container, unmount } = render(<FinalCtaSection withEntryOptions />);
    
    try {
      await new Promise((r) => setTimeout(r, 0));
      expect(container.textContent).toMatch(/Bereit für den ersten Schritt\?/);
      expect(container.textContent).toContain('Hast du bereits Therapie gemacht');
    } finally {
      unmount();
    }
  });

  it('renders all three experience answer buttons with correct labels', async () => {
    const { container, unmount } = render(<FinalCtaSection withEntryOptions />);
    
    try {
      await new Promise((r) => setTimeout(r, 0));
      expect(container.textContent).toContain('Ja, bereits Erfahrung');
      expect(container.textContent).toContain('Nein, erste Therapie');
      expect(container.textContent).toContain('Bin mir unsicher');
    } finally {
      unmount();
    }
  });

  it('answer buttons link to questionnaire with correct experience params', async () => {
    const { container, unmount } = render(<FinalCtaSection withEntryOptions />);
    
    try {
      await new Promise((r) => setTimeout(r, 0));
      const yesLink = container.querySelector('[data-cta="midpage-conversion-yes"]');
      const noLink = container.querySelector('[data-cta="midpage-conversion-no"]');
      const unsureLink = container.querySelector('[data-cta="midpage-conversion-unsure"]');

      expect(yesLink?.getAttribute('href')).toBe('/fragebogen?experience=yes');
      expect(noLink?.getAttribute('href')).toBe('/fragebogen?experience=no');
      expect(unsureLink?.getAttribute('href')).toBe('/fragebogen?experience=unsure');
    } finally {
      unmount();
    }
  });

  it('displays time indicator', async () => {
    const { container, unmount } = render(<FinalCtaSection withEntryOptions />);
    
    try {
      await new Promise((r) => setTimeout(r, 0));
      expect(container.textContent).toContain('5-Minuten Fragebogen');
    } finally {
      unmount();
    }
  });

  it('does not include directory link (questionnaire variant)', async () => {
    const { container, unmount } = render(<FinalCtaSection withEntryOptions />);
    
    try {
      await new Promise((r) => setTimeout(r, 0));
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
      await new Promise((r) => setTimeout(r, 0));
      const section = container.querySelector('section');
      expect(section?.className).toContain('custom-test-class');
    } finally {
      unmount();
    }
  });
});
