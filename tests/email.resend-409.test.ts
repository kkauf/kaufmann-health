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
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () => JSON.stringify({ message: 'Email already sent' }),
    });
    global.fetch = mockFetch;

    const { sendEmail } = await import('@/lib/email/client');

    // Call should not throw, should treat as success
    await expect(sendEmail({
      to: 'test@example.com',
      subject: 'Test 409',
      html: '<p>Test</p>',
    })).resolves.not.toThrow();

    // Should only call once (no retry on 409)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('retries on 500 but treats subsequent 409 as success', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call: server error (retry)
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Server error',
        };
      }
      // Second call: 409 (already sent)
      return {
        ok: false,
        status: 409,
        statusText: 'Conflict',
        text: async () => JSON.stringify({ message: 'Email already sent' }),
      };
    });
    global.fetch = mockFetch;

    const { sendEmail } = await import('@/lib/email/client');

    await expect(sendEmail({
      to: 'test@example.com',
      subject: 'Test Retry then 409',
      html: '<p>Test</p>',
    })).resolves.not.toThrow();

    // Should call twice: once for 500 (retry), once for 409 (success)
    expect(callCount).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry 409 (unlike 500)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () => JSON.stringify({ message: 'Email already sent' }),
    });
    global.fetch = mockFetch;

    const { sendEmail } = await import('@/lib/email/client');

    await sendEmail({
      to: 'test@example.com',
      subject: 'Test 409 no retry',
      html: '<p>Test</p>',
    });

    // 409 should NOT trigger retry logic - just returns immediately
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
