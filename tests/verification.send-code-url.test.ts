/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
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
  sendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock('@/lib/verification/config', () => ({
  getVerificationMode: vi.fn().mockReturnValue('email'),
}));

// Helper to decode HTML entities in URLs extracted from email HTML
function decodeHtmlEntities(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

describe('EARTH-204: send-code email verification code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends 6-digit code email and stores code in metadata when person exists', async () => {
    const email = 'test@example.com';
    const existingPersonId = 'existing-person-123';
    const therapistId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({
      eq: updateEqMock,
    });
    
    // Mock existing person lookup
    (supabaseServer.from as unknown as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ id: existingPersonId, metadata: {} }],
            error: null,
          }),
        }),
        single: vi.fn(),
      }),
      update: updateMock,
    });

    const redirectPath = `/therapeuten?contact=compose&tid=${therapistId}&type=booking`;
    const body = {
      contact: email,
      contact_type: 'email',
      name: 'Test User',
      redirect: redirectPath,
      draft_contact: {
        therapist_id: therapistId,
        contact_type: 'booking',
        patient_reason: 'Test reason',
        patient_message: 'Test message',
      },
    };

    const req = new Request('http://localhost:3000/api/public/verification/send-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Campaign-Source-Override': '/therapie-finden',
        'X-Campaign-Variant-Override': 'concierge',
        'X-Gclid': 'test-gclid-123',
      },
      body: JSON.stringify(body),
    });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    expect(updateMock).toHaveBeenCalled();
    const updateArg = (updateMock as unknown as Mock).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg.campaign_source).toBe('/therapie-finden');
    expect(updateArg.campaign_variant).toBe('concierge');
    const meta = updateArg.metadata as Record<string, unknown>;
    expect(meta.gclid).toBe('test-gclid-123');
    expect(meta.landing_page).toBe('/therapie-finden');
    expect(meta.conversion_path).toBe('directory_contact');
    
    // Verify 6-digit code is stored in metadata
    expect(meta.email_code).toBeTruthy();
    expect(typeof meta.email_code).toBe('string');
    expect((meta.email_code as string).length).toBe(6);
    expect(meta.email_code_expires_at).toBeTruthy();

    // Verify sendEmail was called with code-based template
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailCall = (sendEmail as any).mock.calls[0][0];
    expect(emailCall.context.template).toBe('email_verification_code');
    
    // Verify the email contains the 6-digit code
    const htmlContent = emailCall.html as string;
    expect(htmlContent).toContain(meta.email_code);
    
    // Verify subject contains the code for Apple Mail auto-fill
    expect(emailCall.subject).toContain(meta.email_code as string);
  });

  it('sends 6-digit code email when creating new person', async () => {
    const email = 'new@example.com';
    const newPersonId = 'new-person-789';
    const therapistId = 'therapist-999';
    let insertedMetadata: Record<string, unknown> | null = null;

    // Mock no existing person, then successful insert
    let fromCallCount = 0;
    (supabaseServer.from as unknown as Mock).mockImplementation(() => {
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
          insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
            insertedMetadata = data.metadata as Record<string, unknown>;
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: newPersonId },
                  error: null,
                }),
              }),
            };
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

    // Verify 6-digit code is stored in metadata
    expect(insertedMetadata).toBeTruthy();
    expect(insertedMetadata!.email_code).toBeTruthy();
    expect(typeof insertedMetadata!.email_code).toBe('string');
    expect((insertedMetadata!.email_code as string).length).toBe(6);
    expect(insertedMetadata!.email_code_expires_at).toBeTruthy();

    // Verify sendEmail was called with code-based template
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailCall = (sendEmail as any).mock.calls[0][0];
    expect(emailCall.context.template).toBe('email_verification_code');
    
    // Verify the email contains the 6-digit code
    const htmlContent = emailCall.html as string;
    expect(htmlContent).toContain(insertedMetadata!.email_code);
  });

  it('returns 500 and does NOT send email if person insert fails', async () => {
    const email = 'fail@example.com';

    // Mock no existing person, then failed insert
    let fromCallCount = 0;
    (supabaseServer.from as unknown as Mock).mockImplementation(() => {
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

    (supabaseServer.from as unknown as Mock).mockReturnValue({
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

  it('handles provided lead_id and stores code in metadata', async () => {
    const email = 'with-lead-id@example.com';
    const providedLeadId = 'provided-lead-123';
    let updatedMetadata: Record<string, unknown> | null = null;

    (supabaseServer.from as unknown as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { metadata: {} },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        updatedMetadata = data.metadata as Record<string, unknown>;
        return {
          eq: vi.fn().mockResolvedValue({ error: null }),
        };
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

    // Verify 6-digit code is stored in metadata
    expect(updatedMetadata).toBeTruthy();
    expect(updatedMetadata!.email_code).toBeTruthy();
    expect(typeof updatedMetadata!.email_code).toBe('string');
    expect((updatedMetadata!.email_code as string).length).toBe(6);
    expect(updatedMetadata!.email_code_expires_at).toBeTruthy();

    // Verify sendEmail was called with code-based template
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailCall = (sendEmail as any).mock.calls[0][0];
    expect(emailCall.context.template).toBe('email_verification_code');
    expect(emailCall.context.lead_id).toBe(providedLeadId);
    
    // Verify the email contains the 6-digit code
    const htmlContent = emailCall.html as string;
    expect(htmlContent).toContain(updatedMetadata!.email_code);
  });
});
