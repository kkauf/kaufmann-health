// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { EmailEntryForm } from '@/features/leads/components/EmailEntryForm';

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));

function render(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(ui);
  return { container, unmount: () => root.unmount() };
}

describe('EmailEntryForm handoff to Fragebogen', () => {
  it('stores consent + email in wizard localStorage and redirects to /fragebogen', async () => {
    const originalLocation = window.location;
    // Create a mock location object to allow spying on assign
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockLocation: any = { ...originalLocation, assign: vi.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.defineProperty(window, 'location', { value: mockLocation as any, writable: true });
    try {
      const { container, unmount } = render(<EmailEntryForm />);
      try {
        await new Promise((r) => setTimeout(r, 0));
        const name = container.querySelector<HTMLInputElement>('#name')!;
        const email = container.querySelector<HTMLInputElement>('#email')!;
        const form = container.querySelector('form')!;

        name.value = 'Konsti';
        name.dispatchEvent(new Event('input', { bubbles: true }));
        email.value = 'konsti@example.com';
        email.dispatchEvent(new Event('input', { bubbles: true }));

        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await Promise.resolve();

        const raw = window.localStorage.getItem('kh_wizard_data');
        expect(raw).toBeTruthy();
        const data = raw ? JSON.parse(raw) : {};
        expect(data.email).toBe('konsti@example.com');
        expect(data.name).toBe('Konsti');
        expect(data.consent_share_with_therapists).toBe(true);

        expect(mockLocation.assign).toHaveBeenCalledTimes(1);
        const [dest] = (mockLocation.assign as any).mock.calls[0] as [string];
        expect(String(dest)).toContain('/fragebogen');
      } finally {
        unmount();
      }
    } finally {
      // Restore original location
      Object.defineProperty(window, 'location', { value: originalLocation });
    }
  });
});
