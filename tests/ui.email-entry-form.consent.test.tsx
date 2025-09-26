// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { EmailEntryForm } from '@/components/EmailEntryForm';
import { PRIVACY_VERSION } from '@/lib/privacy';

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));

function render(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(ui);
  return { container, unmount: () => root.unmount() };
}

describe('EmailEntryForm consent payload', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => {
      return new Response(JSON.stringify({ data: { id: 'lead-1', requiresConfirmation: true }, error: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    // Override global fetch for this test environment
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  it('includes privacy_version and consent_share_with_therapists on submit', async () => {
    const { container, unmount } = render(<EmailEntryForm />);
    try {
      const name = container.querySelector<HTMLInputElement>('#name')!;
      const email = container.querySelector<HTMLInputElement>('#email')!;
      const form = container.querySelector('form')!;

      name.value = 'Konsti';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      email.value = 'konsti@example.com';
      email.dispatchEvent(new Event('input', { bubbles: true }));

      // Submit
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      // Let React/handlers flush
      await Promise.resolve();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [_url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init?.method).toBe('POST');
      const body = typeof init!.body === 'string' ? JSON.parse(init!.body) : {};
      expect(body.consent_share_with_therapists).toBe(true);
      expect(body.privacy_version).toBe(PRIVACY_VERSION);
    } finally {
      unmount();
    }
  });
});
