// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import SignupWizard from '@/features/leads/components/SignupWizard';

function render(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, unmount: () => act(() => root.unmount()) };
}

// Mock next/navigation
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

describe.skip('EARTH-209: SignupWizard Experience Param Integration (feature removed)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockSearchParams.delete('experience');
    // Clear localStorage
    window.localStorage.clear();
    // Mock fetch for autosave
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      } as Response)
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pre-fills therapy_experience=has_experience when experience=yes param is present', async () => {
    mockSearchParams.set('experience', 'yes');
    
    const { container, unmount } = render(<SignupWizard />);
    
    try {
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      // Find the selected button (has emerald background)
      const selectedButton = container.querySelector('.bg-emerald-50');
      expect(selectedButton).toBeTruthy();
      expect(selectedButton?.textContent).toContain('Ja, ich habe bereits Therapieerfahrung');
    } finally {
      unmount();
    }
  });

  it('pre-fills therapy_experience=first_time when experience=no param is present', async () => {
    mockSearchParams.set('experience', 'no');
    
    const { container, unmount } = render(<SignupWizard />);
    
    try {
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      const selectedButton = container.querySelector('.bg-emerald-50');
      expect(selectedButton).toBeTruthy();
      expect(selectedButton?.textContent).toContain('Nein, dies wäre meine erste Therapie');
    } finally {
      unmount();
    }
  });

  it('pre-fills therapy_experience=unsure when experience=unsure param is present', async () => {
    mockSearchParams.set('experience', 'unsure');
    
    const { container, unmount } = render(<SignupWizard />);
    
    try {
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      const selectedButton = container.querySelector('.bg-emerald-50');
      expect(selectedButton).toBeTruthy();
      expect(selectedButton?.textContent).toContain('Bin mir nicht sicher');
    } finally {
      unmount();
    }
  });

  it('does not pre-fill when experience param has invalid value', async () => {
    mockSearchParams.set('experience', 'invalid');
    
    const { container, unmount } = render(<SignupWizard />);
    
    try {
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      // No button should be selected
      const selectedButton = container.querySelector('.bg-emerald-50');
      expect(selectedButton).toBeNull();
    } finally {
      unmount();
    }
  });

  it('does not pre-fill when no experience param is present', async () => {
    // No param set
    
    const { container, unmount } = render(<SignupWizard />);
    
    try {
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      // No button should be selected initially
      const selectedButton = container.querySelector('.bg-emerald-50');
      expect(selectedButton).toBeNull();
    } finally {
      unmount();
    }
  });

  it('auto-advances to step 2 when experience=no (no follow-up questions)', async () => {
    mockSearchParams.set('experience', 'no');
    
    const { container, unmount } = render(<SignupWizard />);
    
    try {
      // Wait for component to mount and prefill (100ms), then auto-advance (800ms + buffer)
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      // Should be on step 2 (Timeline) - check for unique step 2 text
      expect(container.textContent).toContain('Wann möchtest du idealerweise beginnen');
      expect(container.textContent).toContain('Innerhalb der nächsten Woche');
    } finally {
      unmount();
    }
  });

  it('auto-advances to step 2 when experience=unsure (no follow-up questions)', async () => {
    mockSearchParams.set('experience', 'unsure');
    
    const { container, unmount } = render(<SignupWizard />);
    
    try {
      // Wait for component to mount and prefill (100ms), then auto-advance (800ms + buffer)
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      // Should be on step 2 (Timeline) - check for unique step 2 text
      expect(container.textContent).toContain('Wann möchtest du idealerweise beginnen');
      expect(container.textContent).toContain('Innerhalb der nächsten Woche');
    } finally {
      unmount();
    }
  });

  it('does NOT auto-advance when experience=yes (needs therapy_type answer)', async () => {
    mockSearchParams.set('experience', 'yes');
    
    const { container, unmount } = render(<SignupWizard />);
    
    try {
      // Wait same duration
      await act(async () => {
        vi.advanceTimersByTime(800);
      });
      // Should still be on step 1, showing therapy_type question
      expect(container.textContent).toContain('Welche Art von Therapie war/ist es');
    } finally {
      unmount();
    }
  });
});
