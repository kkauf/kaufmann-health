/**
 * Test email client handling of Resend 409 (idempotent success)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Email client 409 handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
  });

  it('treats 409 Conflict as idempotent success (no retry)', async () => {
    const okJson = new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      if (typeof url === 'string' && url.includes('resend.com/emails')) {
        return {
          ok: false,
          status: 409,
          statusText: 'Conflict',
          text: async () => JSON.stringify({ message: 'Email already sent' }),
        } as unknown as Response;
      }
      return okJson.clone(); // Ignore non-Resend calls (e.g., logger events)
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { sendEmail } = await import('@/lib/email/client');

    // Call should not throw, should treat as success
    await expect(sendEmail({
      to: 'test@example.com',
      subject: 'Test 409',
      html: '<p>Test</p>',
    })).resolves.not.toThrow();

    // Count only Resend calls
    const resendCallsCount = mockFetch.mock.calls.reduce((acc, call) => {
      const u = call[0];
      const url = typeof u === 'string' ? u : u instanceof URL ? u.href : (u as Request).url;
      return acc + (typeof url === 'string' && url.includes('resend.com/emails') ? 1 : 0);
    }, 0);
    expect(resendCallsCount).toBe(1);
  });

  it('retries on 500 but treats subsequent 409 as success', async () => {
    const okJson = new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    let resendCallCount = 0;
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      if (typeof url === 'string' && url.includes('resend.com/emails')) {
        resendCallCount++;
        if (resendCallCount === 1) {
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            text: async () => 'Server error',
          } as unknown as Response;
        }
        return {
          ok: false,
          status: 409,
          statusText: 'Conflict',
          text: async () => JSON.stringify({ message: 'Email already sent' }),
        } as unknown as Response;
      }
      return okJson.clone();
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { sendEmail } = await import('@/lib/email/client');

    await expect(sendEmail({
      to: 'test@example.com',
      subject: 'Test Retry then 409',
      html: '<p>Test</p>',
    })).resolves.not.toThrow();

    // Should call Resend twice: 500 then 409
    expect(resendCallCount).toBe(2);
  });

  it('does not retry 409 (unlike 500)', async () => {
    const okJson = new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      if (typeof url === 'string' && url.includes('resend.com/emails')) {
        return {
          ok: false,
          status: 409,
          statusText: 'Conflict',
          text: async () => JSON.stringify({ message: 'Email already sent' }),
        } as unknown as Response;
      }
      return okJson.clone();
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const { sendEmail } = await import('@/lib/email/client');

    await sendEmail({
      to: 'test@example.com',
      subject: 'Test 409 no retry',
      html: '<p>Test</p>',
    });

    // 409 should NOT trigger retry logic - count only Resend calls
    const resendCallsCount = mockFetch.mock.calls.reduce((acc, call) => {
      const u = call[0];
      const url = typeof u === 'string' ? u : u instanceof URL ? u.href : (u as Request).url;
      return acc + (typeof url === 'string' && url.includes('resend.com/emails') ? 1 : 0);
    }, 0);
    expect(resendCallsCount).toBe(1);
  });
});
