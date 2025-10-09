import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/public/leads/confirm/route';
import { supabaseServer } from '@/lib/supabase-server';

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

vi.mock('@/lib/auth/clientSession', () => ({
  createClientSessionToken: vi.fn().mockResolvedValue('mock-token'),
  createClientSessionCookie: vi.fn().mockReturnValue('kh_client=mock-token; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000'),
}));

describe('EARTH-204: confirm endpoint redirect URL merging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly merges query params when redirect already contains ?', async () => {
    const personId = 'patient-123';
    const token = 'valid-token-abc';
    const therapistId = 'therapist-456';
    
    // Mock person lookup with valid token
    (supabaseServer.from as unknown as vi.Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: personId,
              email: 'test@example.com',
              name: 'Max Mustermann',
              status: 'pre_confirmation',
              metadata: {
                confirm_token: token,
                confirm_sent_at: new Date().toISOString(),
              },
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    // Construct URL with redirect containing query params (what ContactModal sends)
    const redirectPath = `/therapeuten?contact=compose&tid=${therapistId}&type=booking`;
    const url = `http://localhost:3000/api/public/leads/confirm?token=${token}&id=${personId}&redirect=${encodeURIComponent(redirectPath)}`;
    const req = new Request(url);

    const res = await GET(req);

    // Should redirect with properly merged query params
    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toBeTruthy();
    
    // Parse redirect URL
    const redirectUrl = new URL(location!);
    
    // Should be back to /therapeuten
    expect(redirectUrl.pathname).toBe('/therapeuten');
    
    // Should have all params without double ?
    expect(redirectUrl.searchParams.get('contact')).toBe('compose');
    expect(redirectUrl.searchParams.get('tid')).toBe(therapistId);
    expect(redirectUrl.searchParams.get('type')).toBe('booking');
    expect(redirectUrl.searchParams.get('confirm')).toBe('1');
    expect(redirectUrl.searchParams.get('id')).toBe(personId);
    
    // Should NOT have malformed URL with double ?
    expect(location).not.toContain('??');
    expect(location).not.toMatch(/\?[^?]*\?/); // no two ? chars with stuff in between
    
    // Should set session cookie
    const setCookie = res.headers.get('Set-Cookie');
    expect(setCookie).toContain('kh_client=');
  });

  it('uses ? separator when redirect has no query params (fragebogen default)', async () => {
    const personId = 'patient-789';
    const token = 'valid-token-xyz';
    
    (supabaseServer.from as unknown as vi.Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: personId,
              email: 'test2@example.com',
              name: 'Anna Schmidt',
              status: 'pre_confirmation',
              metadata: {
                confirm_token: token,
                confirm_sent_at: new Date().toISOString(),
              },
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    // No redirect param → should go to fragebogen
    const url = `http://localhost:3000/api/public/leads/confirm?token=${token}&id=${personId}`;
    const req = new Request(url);

    const res = await GET(req);

    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toBeTruthy();
    
    const redirectUrl = new URL(location!);
    expect(redirectUrl.pathname).toBe('/fragebogen');
    expect(redirectUrl.searchParams.get('confirm')).toBe('1');
    expect(redirectUrl.searchParams.get('id')).toBe(personId);
  });

  it('handles already-confirmed status with redirect containing query params', async () => {
    const personId = 'patient-confirmed';
    const token = 'any-token';
    const therapistId = 'therapist-999';
    
    (supabaseServer.from as unknown as vi.Mock).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: personId,
              email: 'confirmed@example.com',
              name: 'Already Confirmed',
              status: 'email_confirmed', // Already confirmed
              metadata: {
                confirm_token: token,
                confirm_sent_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 min ago
              },
            },
            error: null,
          }),
        }),
      }),
    });

    const redirectPath = `/therapeuten?contact=compose&tid=${therapistId}&type=consultation`;
    const url = `http://localhost:3000/api/public/leads/confirm?token=${token}&id=${personId}&redirect=${encodeURIComponent(redirectPath)}`;
    const req = new Request(url);

    const res = await GET(req);

    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toBeTruthy();
    
    const redirectUrl = new URL(location!);
    expect(redirectUrl.pathname).toBe('/therapeuten');
    expect(redirectUrl.searchParams.get('contact')).toBe('compose');
    expect(redirectUrl.searchParams.get('tid')).toBe(therapistId);
    expect(redirectUrl.searchParams.get('type')).toBe('consultation');
    
    // No double ?
    expect(location).not.toContain('??');
  });
});
