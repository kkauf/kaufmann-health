import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  },
}));

vi.mock('@/lib/logger', () => ({
  track: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('twilio', () => ({
  default: {
    validateRequest: vi.fn().mockReturnValue(true),
  },
}));

import { POST } from '@/app/api/internal/sms/incoming/route';
import { sendEmail } from '@/lib/email/client';
import { track } from '@/lib/logger';

describe('POST /api/internal/sms/incoming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.LEADS_NOTIFY_EMAIL = 'admin@test.com';
  });

  function makeRequest(body: string) {
    return new Request('https://kaufmann-health.de/api/internal/sms/incoming', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'test-sig',
      },
      body,
    });
  }

  it('forwards incoming SMS to admin email', async () => {
    const body = 'From=%2B4917612345678&To=%2B4930123456&Body=Hallo%20Test&MessageSid=SM123';
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/xml');

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@test.com',
        subject: expect.stringContaining('SMS-Antwort'),
      })
    );
  });

  it('detects callback request with "Hilfe" keyword', async () => {
    const body = 'From=%2B4917612345678&To=%2B4930123456&Body=Hilfe%20bitte&MessageSid=SM456';
    const res = await POST(makeRequest(body));

    expect(res.status).toBe(200);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Rückruf gewünscht'),
      })
    );

    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sms_incoming',
        props: expect.objectContaining({
          contains_hilfe: true,
        }),
      })
    );
  });

  it('returns empty TwiML response (no auto-reply)', async () => {
    const body = 'From=%2B4917612345678&Body=Test';
    const res = await POST(makeRequest(body));

    const text = await res.text();
    expect(text).toContain('<Response></Response>');
  });
});
