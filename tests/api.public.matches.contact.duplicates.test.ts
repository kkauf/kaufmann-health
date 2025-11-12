import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email/templates/therapistNotification', () => ({
  renderTherapistNotification: vi.fn().mockReturnValue({ subject: 'Subject', html: '<p>Body</p>' }),
}));

vi.mock('@/lib/auth/clientSession', () => ({
  getClientSession: vi.fn(async () => ({ patient_id: 'patient-xyz' })),
}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from '@/lib/supabase-server';

describe('POST /api/public/matches/:uuid/contact duplicate secure_uuid fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to latest ref when .single() fails to coerce and proceeds successfully', async () => {
    const uuid = 'dup-uuid';
    const patientId = 'patient-xyz';
    const therapistId = 'therapist-abc';

    const ref = { id: 'ref-1', created_at: new Date().toISOString(), patient_id: patientId };

    let matchesCall = 0;

    (supabaseServer.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'matches') {
        matchesCall++;
        if (matchesCall === 1) {
          // First ref: .single() error
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Cannot coerce the result to a single JSON object' } }),
          } as any;
        }
        if (matchesCall === 2) {
          // Fallback ref: order().limit(1)
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [ref], error: null }),
          } as any;
        }
        if (matchesCall === 3) {
          // Rate limit check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            contains: vi.fn().mockReturnThis(),
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          } as any;
        }
        if (matchesCall === 4) {
          // Existing match check
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        }
        // Insert new match
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'new-match-id', secure_uuid: 'new-su' }, error: null }),
        } as any;
      }

      if (table === 'therapists') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: therapistId, first_name: 'Anna', last_name: 'S', email: 'anna@example.com' }, error: null }),
        } as any;
      }

      if (table === 'people') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { email: 'p@example.com', phone_number: '+491234' }, error: null }),
        } as any;
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const req = new Request(`http://localhost:3000/api/public/matches/${uuid}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapist_id: therapistId,
        contact_type: 'booking',
        session_format: 'online',
        patient_reason: 'Issue',
        patient_message: 'Hello',
      }),
    });

    const { POST } = await import('@/app/api/public/matches/[uuid]/contact/route');
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json?.data?.ok).toBe(true);
    expect(json?.data?.match_id).toBe('new-match-id');
  });
});
