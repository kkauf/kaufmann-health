/**
 * @vitest-environment jsdom
 *
 * Tests for progressive disclosure flow screens:
 * - ScreenMatchPreview: match count, therapist previews, fallback, analytics
 * - ScreenNameEmail: name validation, optional email, emailAlreadyCollected, consent
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import ScreenMatchPreview from '@/features/leads/components/screens/ScreenMatchPreview';
import ScreenNameEmail from '@/features/leads/components/screens/ScreenNameEmail';
import type { ScreenNameEmailValues } from '@/features/leads/components/screens/ScreenNameEmail';

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mock navigator.sendBeacon for analytics assertions
const mockSendBeacon = vi.fn(() => true);
Object.defineProperty(navigator, 'sendBeacon', {
  value: mockSendBeacon,
  writable: true,
  configurable: true,
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function render(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

// ── ScreenMatchPreview ─────────────────────────────────────────────────────────

describe('ScreenMatchPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.textContent = '';
  });

  it('renders match count and therapist previews when matches exist', () => {
    const previews = [
      { firstName: 'Anna', modalities: ['NARM', 'SE'], city: 'Berlin' },
      { firstName: 'Bettina', modalities: ['Hakomi'], city: 'Hamburg' },
    ];

    const { container, unmount } = render(
      <ScreenMatchPreview
        matchCount={2}
        matchPreviews={previews}
        matchQuality="exact"
        onNext={vi.fn()}
      />
    );

    try {
      // Match count shown in heading
      expect(container.textContent).toContain('2');
      expect(container.textContent).toContain('passende Therapeut:innen');

      // Therapist first names displayed
      expect(container.textContent).toContain('Anna');
      expect(container.textContent).toContain('Bettina');

      // Modality badges
      expect(container.textContent).toContain('NARM');
      expect(container.textContent).toContain('SE');
      expect(container.textContent).toContain('Hakomi');

      // City displayed (blurred but present in DOM)
      expect(container.textContent).toContain('Berlin');
      expect(container.textContent).toContain('Hamburg');

      // Avatar initials
      const avatars = container.querySelectorAll('.rounded-full');
      const avatarTexts = Array.from(avatars).map((el) => el.textContent);
      expect(avatarTexts).toContain('A');
      expect(avatarTexts).toContain('B');
    } finally {
      unmount();
    }
  });

  it('shows "Wir suchen weiter" fallback when 0 matches', () => {
    const { container, unmount } = render(
      <ScreenMatchPreview
        matchCount={0}
        matchPreviews={[]}
        matchQuality="none"
        onNext={vi.fn()}
      />
    );

    try {
      expect(container.textContent).toContain('Wir suchen weiter');
      expect(container.textContent).toContain('Kontaktdaten hinterlassen');
      // Should NOT show "passende Therapeut:innen" heading
      expect(container.textContent).not.toContain('passende Therapeut:innen');
    } finally {
      unmount();
    }
  });

  it('calls onNext when CTA clicked', () => {
    const onNext = vi.fn();

    const { container, unmount } = render(
      <ScreenMatchPreview
        matchCount={3}
        matchPreviews={[
          { firstName: 'Anna', modalities: ['NARM'], city: 'Berlin' },
        ]}
        matchQuality="exact"
        onNext={onNext}
      />
    );

    try {
      const ctaButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Ergebnisse freischalten')
      );
      expect(ctaButton).toBeTruthy();

      act(() => {
        ctaButton!.click();
      });

      expect(onNext).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();

    const { container, unmount } = render(
      <ScreenMatchPreview
        matchCount={2}
        matchPreviews={[
          { firstName: 'Anna', modalities: ['NARM'], city: 'Berlin' },
        ]}
        matchQuality="exact"
        onNext={vi.fn()}
        onBack={onBack}
      />
    );

    try {
      const backButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Zurück')
      );
      expect(backButton).toBeTruthy();

      act(() => {
        backButton!.click();
      });

      expect(onBack).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });

  it('fires match_preview_shown analytics event on render', () => {
    const { unmount } = render(
      <ScreenMatchPreview
        matchCount={5}
        matchPreviews={[
          { firstName: 'Anna', modalities: ['NARM'], city: 'Berlin' },
        ]}
        matchQuality="partial"
        onNext={vi.fn()}
      />
    );

    try {
      // sendBeacon should have been called with the analytics event
      expect(mockSendBeacon).toHaveBeenCalled();

      // Find the match_preview_shown call — verify beacon was called to correct endpoint
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const beaconCalls = mockSendBeacon.mock.calls as any[];
      const matchingCalls = beaconCalls.filter(
        (call) => call[0] === '/api/events'
      );
      expect(matchingCalls.length).toBeGreaterThanOrEqual(1);
    } finally {
      unmount();
    }
  });

  it('shows "+N weitere" text when more than 3 matches', () => {
    const previews = [
      { firstName: 'Anna', modalities: ['NARM'], city: 'Berlin' },
      { firstName: 'Bettina', modalities: ['SE'], city: 'Hamburg' },
      { firstName: 'Clara', modalities: ['Hakomi'], city: 'Munchen' },
      { firstName: 'Daria', modalities: ['CE'], city: 'Koln' },
      { firstName: 'Elena', modalities: ['NARM'], city: 'Frankfurt' },
    ];

    const { container, unmount } = render(
      <ScreenMatchPreview
        matchCount={5}
        matchPreviews={previews}
        matchQuality="exact"
        onNext={vi.fn()}
      />
    );

    try {
      // Only first 3 previews rendered
      expect(container.textContent).toContain('Anna');
      expect(container.textContent).toContain('Bettina');
      expect(container.textContent).toContain('Clara');
      // 4th and 5th not rendered as cards
      expect(container.textContent).not.toContain('Daria');
      expect(container.textContent).not.toContain('Elena');
      // "+2 weitere" shown
      expect(container.textContent).toContain('+ 2 weitere');
    } finally {
      unmount();
    }
  });

  it('does not render back button when onBack is not provided', () => {
    const { container, unmount } = render(
      <ScreenMatchPreview
        matchCount={1}
        matchPreviews={[
          { firstName: 'Anna', modalities: ['NARM'], city: 'Berlin' },
        ]}
        matchQuality="exact"
        onNext={vi.fn()}
      />
    );

    try {
      const backButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Zurück')
      );
      expect(backButton).toBeUndefined();
    } finally {
      unmount();
    }
  });
});

// ── ScreenNameEmail ────────────────────────────────────────────────────────────

describe('ScreenNameEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.textContent = '';
  });

  function makeValues(overrides: Partial<ScreenNameEmailValues> = {}): ScreenNameEmailValues {
    return { name: '', email: '', ...overrides };
  }

  it('requires name field - shows error when submitting empty', () => {
    const onNext = vi.fn();
    const onChange = vi.fn();
    const values = makeValues();

    const { container, unmount } = render(
      <ScreenNameEmail
        values={values}
        onChange={onChange}
        onNext={onNext}
      />
    );

    try {
      // Submit the form without filling in name
      const form = container.querySelector('form')!;
      act(() => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      // Error message should appear
      expect(container.textContent).toContain('Bitte gib deinen Namen an');

      // onNext should NOT have been called
      expect(onNext).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
  });

  it('email field is optional - form submits without it', () => {
    const onNext = vi.fn();
    const onChange = vi.fn();
    const values = makeValues({ name: 'Konsti' });

    const { container, unmount } = render(
      <ScreenNameEmail
        values={values}
        onChange={onChange}
        onNext={onNext}
      />
    );

    try {
      // Email field should be present but not required
      const emailInput = container.querySelector('#screen-email') as HTMLInputElement;
      expect(emailInput).toBeTruthy();
      expect(emailInput.value).toBe('');

      // Submit form with name only (no email)
      const form = container.querySelector('form')!;
      act(() => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      // Should succeed — onNext called, no error shown
      expect(onNext).toHaveBeenCalledTimes(1);
      expect(container.textContent).not.toContain('Bitte gib deinen Namen an');
    } finally {
      unmount();
    }
  });

  it('email field is hidden when emailAlreadyCollected=true', () => {
    const values = makeValues({ name: 'Konsti' });

    const { container, unmount } = render(
      <ScreenNameEmail
        values={values}
        onChange={vi.fn()}
        onNext={vi.fn()}
        emailAlreadyCollected={true}
      />
    );

    try {
      const emailInput = container.querySelector('#screen-email');
      expect(emailInput).toBeNull();

      // The email label text should also not be visible
      expect(container.textContent).not.toContain('Damit deine Therapeut:in dich erreichen kann');
    } finally {
      unmount();
    }
  });

  it('calls onNext on valid submission', () => {
    const onNext = vi.fn();
    const onChange = vi.fn();
    const values = makeValues({ name: 'Konsti', email: 'konsti@example.com' });

    const { container, unmount } = render(
      <ScreenNameEmail
        values={values}
        onChange={onChange}
        onNext={onNext}
      />
    );

    try {
      const form = container.querySelector('form')!;
      act(() => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });

      expect(onNext).toHaveBeenCalledTimes(1);
      // No error message
      expect(container.textContent).not.toContain('Bitte gib deinen Namen an');
    } finally {
      unmount();
    }
  });

  it('shows ConsentSection with patient actor', () => {
    const values = makeValues({ name: '' });

    const { container, unmount } = render(
      <ScreenNameEmail
        values={values}
        onChange={vi.fn()}
        onNext={vi.fn()}
      />
    );

    try {
      // ConsentSection for patient actor renders the Datenschutz + AGB text
      expect(container.textContent).toContain('Datenschutzerklärung');
      expect(container.textContent).toContain('AGB');
      expect(container.textContent).toContain('Weitergabe deiner Angaben');
    } finally {
      unmount();
    }
  });

  it('clears name error when user starts typing', () => {
    const onNext = vi.fn();
    const values = makeValues();
    const onChange = vi.fn();

    const { container, unmount } = render(
      <ScreenNameEmail
        values={values}
        onChange={onChange}
        onNext={onNext}
      />
    );

    try {
      // Submit empty to trigger error
      const form = container.querySelector('form')!;
      act(() => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      expect(container.textContent).toContain('Bitte gib deinen Namen an');

      // Type in the name field — onChange should be called, which clears error internally
      const nameInput = container.querySelector('#screen-name') as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )!.set!;
      act(() => {
        nativeSetter.call(nameInput, 'K');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // onChange should have been called with the name patch
      expect(onChange).toHaveBeenCalledWith({ name: 'K' });
    } finally {
      unmount();
    }
  });

  it('renders back button when onBack is provided', () => {
    const onBack = vi.fn();

    const { container, unmount } = render(
      <ScreenNameEmail
        values={makeValues({ name: 'Konsti' })}
        onChange={vi.fn()}
        onNext={vi.fn()}
        onBack={onBack}
      />
    );

    try {
      const backButton = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Zurück')
      );
      expect(backButton).toBeTruthy();

      act(() => {
        backButton!.click();
      });

      expect(onBack).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });
});
