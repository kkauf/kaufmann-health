import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/public/matches/[uuid]/contact/route';

vi.mock('@/lib/logger', () => ({ logError: vi.fn(), track: vi.fn() }));
vi.mock('@/lib/email/client', () => ({ sendEmail: vi.fn() }));
vi.mock('@/lib/email/templates/therapistNotification', () => ({
  renderTherapistNotification: vi.fn().mockReturnValue({ subject: 'x', html: '<p>x</p>' }),
}));

// Mockable supabase module
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: { from: vi.fn() } }));
// Client session module to control verification outcomes per test
vi.mock('@/lib/auth/clientSession', () => ({ getClientSession: vi.fn() }));

import { supabaseServer } from '@/lib/supabase-server';
import { getClientSession } from '@/lib/auth/clientSession';

function makeReq(uuid: string, body: any, headers?: Record<string, string>) {
  return new Request(`http://localhost:3000/api/public/matches/${uuid}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

function mockRef({ createdAt, patientId }: { createdAt: string; patientId: string }) {
  (supabaseServer.from as any).mockImplementationOnce(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'ref', created_at: createdAt, patient_id: patientId }, error: null }),
  }));
}

describe('Matches Contact API - Verification Enforcement (EARTH-231)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unverified users with 401', async () => {
    (getClientSession as any).mockResolvedValueOnce(null);
    mockRef({ createdAt: new Date().toISOString(), patientId: 'p-1' });

    const res = await POST(makeReq('uuid', {
      therapist_id: 't1', contact_type: 'booking', session_format: 'online', patient_reason: 'x', patient_message: 'y',
    }));
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.error).toContain('Verification required');
  });

  it('validates session patient_id matches UUID patient_id', async () => {
    (getClientSession as any).mockResolvedValueOnce({ patient_id: 'different' });
    mockRef({ createdAt: new Date().toISOString(), patientId: 'p-1' });

    const res = await POST(makeReq('uuid', {
      therapist_id: 't1', contact_type: 'booking', session_format: 'online', patient_reason: 'x', patient_message: 'y',
    }));
    expect(res.status).toBe(401);
  });

  it('returns 410 for expired links', async () => {
    (getClientSession as any).mockResolvedValueOnce({ patient_id: 'p-1' });
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    mockRef({ createdAt: old, patientId: 'p-1' });

    const res = await POST(makeReq('uuid', {
      therapist_id: 't1', contact_type: 'booking', session_format: 'online', patient_reason: 'x', patient_message: 'y',
    }));
    expect(res.status).toBe(410);
  });

  it('validates required fields before processing', async () => {
    (getClientSession as any).mockResolvedValueOnce({ patient_id: 'p-1' });
    mockRef({ createdAt: new Date().toISOString(), patientId: 'p-1' });

    const res = await POST(makeReq('uuid', { contact_type: 'booking' }));
    expect([400]).toContain(res.status);
  });
});
