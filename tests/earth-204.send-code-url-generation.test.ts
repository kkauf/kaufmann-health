import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/public/verification/send-code/route';
import { supabaseServer } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email/client';

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: { from: vi.fn() },
}));

vi.mock('@/lib/server-analytics', () => ({
  ServerAnalytics: { trackEventFromRequest: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/verification/config', () => ({
  getVerificationMode: vi.fn().mockReturnValue('email'),
}));

describe('EARTH-204: send-code URL generation (the actual bug)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes both token AND id in confirmation URL when person exists', async () => {
    const email = 'test@example.com';
    const existingPersonId = 'existing-person-123';
    const therapistId = 'therapist-456';
    
    // Mock existing person lookup
    (supabaseServer.from as unknown as vi.Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: existingPersonId, metadata: {} }],
            error: null,
          }),
        }),
        single: vi.fn(),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const redirectPath = `/therapeuten?contact=compose&tid=${therapistId}&type=booking`;
    const body = {
      contact: email,
      contact_type: 'email',
      redirect: redirectPath,
    };

    const req = new Request('http://localhost:3000/api/public/verification/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    // Verify sendEmail was called
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailCall = (sendEmail as any).mock.calls[0][0];
    const htmlContent = emailCall.html as string;

    // Extract the confirmation URL from email HTML
    const hrefMatch = htmlContent.match(/href="([^"]+)"/);
    expect(hrefMatch).toBeTruthy();
    
    const confirmUrl = hrefMatch![1];
    const url = new URL(confirmUrl);

    // THIS IS THE CRITICAL TEST: Both token AND id must be present
    const token = url.searchParams.get('token');
    const id = url.searchParams.get('id');
    
    expect(token).toBeTruthy();
    expect(token).toHaveLength(64); // hex token
    expect(id).toBe(existingPersonId);

    // Also verify redirect is included
    const redirect = url.searchParams.get('redirect');
    expect(redirect).toBe(redirectPath);
  });

  it('includes both token AND id when creating new person', async () => {
    const email = 'new@example.com';
    const newPersonId = 'new-person-789';
    const therapistId = 'therapist-999';

    // Mock no existing person, then successful insert
    let fromCallCount = 0;
    (supabaseServer.from as unknown as vi.Mock).mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        // First call: select returns empty (no existing)
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      } else {
        // Second call: insert succeeds
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: newPersonId },
                error: null,
              }),
            }),
          }),
        };
      }
    });

    const redirectPath = `/therapeuten?contact=compose&tid=${therapistId}&type=consultation`;
    const body = {
      contact: email,
      contact_type: 'email',
      redirect: redirectPath,
    };

    const req = new Request('http://localhost:3000/api/public/verification/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailCall = (sendEmail as any).mock.calls[0][0];
    const htmlContent = emailCall.html as string;

    const hrefMatch = htmlContent.match(/href="([^"]+)"/);
    expect(hrefMatch).toBeTruthy();
    
    const confirmUrl = hrefMatch![1];
    const url = new URL(confirmUrl);

    // Both must be present
    expect(url.searchParams.get('token')).toBeTruthy();
    expect(url.searchParams.get('id')).toBe(newPersonId);
    expect(url.searchParams.get('redirect')).toBe(redirectPath);
  });

  it('returns 500 and does NOT send email if person insert fails', async () => {
    const email = 'fail@example.com';

    // Mock no existing person, then failed insert
    let fromCallCount = 0;
    (supabaseServer.from as unknown as vi.Mock).mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      } else {
        // Insert fails
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Insert failed' },
              }),
            }),
          }),
        };
      }
    });

    const body = {
      contact: email,
      contact_type: 'email',
      redirect: '/therapeuten?contact=compose&tid=123&type=booking',
    };

    const req = new Request('http://localhost:3000/api/public/verification/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req as any);
    
    // Should return 500
    expect(res.status).toBe(500);
    
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('Failed to prepare verification');

    // CRITICAL: Should NOT send email with broken link
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns 500 if person update fails', async () => {
    const email = 'update-fail@example.com';
    const existingPersonId = 'existing-999';

    (supabaseServer.from as unknown as vi.Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: existingPersonId, metadata: {} }],
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: { message: 'Update failed' },
        }),
      }),
    });

    const body = {
      contact: email,
      contact_type: 'email',
      redirect: '/therapeuten?contact=compose&tid=456&type=booking',
    };

    const req = new Request('http://localhost:3000/api/public/verification/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req as any);
    
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);

    // Should NOT send email
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('handles provided lead_id and includes it in URL', async () => {
    const email = 'with-lead-id@example.com';
    const providedLeadId = 'provided-lead-123';

    (supabaseServer.from as unknown as vi.Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { metadata: {} },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const body = {
      contact: email,
      contact_type: 'email',
      lead_id: providedLeadId,
      redirect: '/therapeuten?contact=compose&tid=789&type=booking',
    };

    const req = new Request('http://localhost:3000/api/public/verification/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailCall = (sendEmail as any).mock.calls[0][0];
    const htmlContent = emailCall.html as string;

    const hrefMatch = htmlContent.match(/href="([^"]+)"/);
    const confirmUrl = hrefMatch![1];
    const url = new URL(confirmUrl);

    // Should use the provided lead_id
    expect(url.searchParams.get('id')).toBe(providedLeadId);
    expect(url.searchParams.get('token')).toBeTruthy();
  });
});
