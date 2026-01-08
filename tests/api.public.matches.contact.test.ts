import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/public/matches/[uuid]/contact/route';

// Mock dependencies
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock('@/lib/email/templates/therapistNotification', () => ({
  renderTherapistNotification: vi.fn().mockReturnValue({
    subject: 'Test Subject',
    html: '<p>Test</p>',
  }),
}));

// Mock client session to satisfy verification gating
vi.mock('@/lib/auth/clientSession', () => ({
  getClientSession: vi.fn().mockResolvedValue({ patient_id: 'patient-123' }),
}));

import { supabaseServer } from '@/lib/supabase-server';

describe('POST /api/public/matches/:uuid/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new match and sends notification when valid', async () => {
    let callCount = 0;
    (supabaseServer.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First: resolve reference match
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'match-ref-id', created_at: new Date().toISOString(), patient_id: 'patient-123' },
            error: null,
          }),
        };
      } else if (callCount === 2) {
        // Second: rate limit check (0 matches)
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      } else if (callCount === 3) {
        // Third: therapist lookup
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'therapist-456', first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
            error: null,
          }),
        };
      } else if (callCount === 4) {
        // Fourth: check for existing match
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      } else {
        // Fifth: insert new match
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-match-id', secure_uuid: 'new-uuid' },
            error: null,
          }),
        };
      }
    });

    const req = new Request('http://localhost:3000/api/public/matches/test-uuid/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapist_id: 'therapist-456',
        contact_type: 'booking',
        session_format: 'online',
        patient_reason: 'Need help with anxiety',
        patient_message: 'Looking forward to working with you',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveProperty('ok', true);
    expect(json.data).toHaveProperty('match_id');
  });

  it('returns 400 when required fields are missing', async () => {
    const req = new Request('http://localhost:3000/api/public/matches/test-uuid/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapist_id: 'therapist-456',
        // missing contact_type and patient_reason
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Fehlende Pflichtfelder');
  });

  it('returns 429 when rate limit exceeded (3 patient-initiated contacts in 24h)', async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    let callCount = 0;
    (supabaseServer.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: resolve reference match
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'match-ref-id', created_at: new Date().toISOString(), patient_id: 'patient-123' },
            error: null,
          }),
        };
      } else {
        // Second call: rate limit check returns 3 matches
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({
            data: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
            error: null,
          }),
        };
      }
    });

    const req = new Request('http://localhost:3000/api/public/matches/test-uuid/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapist_id: 'therapist-456',
        contact_type: 'booking',
        session_format: 'online',
        patient_reason: 'Need help',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(json.error).toContain('bereits 3 Therapeuten kontaktiert');
  });

  it('returns 404 when therapist not found or not verified', async () => {
    (supabaseServer.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({
          data: { id: 'match-ref-id', created_at: new Date().toISOString(), patient_id: 'patient-123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Not found' },
        }),
    });

    const req = new Request('http://localhost:3000/api/public/matches/test-uuid/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapist_id: 'nonexistent-therapist',
        contact_type: 'booking',
        session_format: 'online',
        patient_reason: 'Need help',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('Therapeut nicht gefunden');
  });

  it('returns 410 when link expired (>30 days)', async () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    
    (supabaseServer.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({
        data: { id: 'match-ref-id', created_at: oldDate, patient_id: 'patient-123' },
        error: null,
      }),
    });

    const req = new Request('http://localhost:3000/api/public/matches/test-uuid/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapist_id: 'therapist-456',
        contact_type: 'booking',
        session_format: 'online',
        patient_reason: 'Need help',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(410);
    expect(json.error).toBe('Link expired');
  });

  it('reuses existing match and updates metadata when match exists', async () => {
    const mockUpdate = vi.fn().mockReturnThis();
    
    (supabaseServer.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: mockUpdate,
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'existing-match-id', secure_uuid: 'existing-uuid', metadata: {} },
        error: null,
      }),
      single: vi.fn()
        .mockResolvedValueOnce({
          data: { id: 'match-ref-id', created_at: new Date().toISOString(), patient_id: 'patient-123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'therapist-456', first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
          error: null,
        }),
    });

    const req = new Request('http://localhost:3000/api/public/matches/test-uuid/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapist_id: 'therapist-456',
        contact_type: 'consultation',
        patient_reason: 'Initial consultation',
        patient_message: 'Looking forward',
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.match_id).toBe('existing-match-id');
    expect(mockUpdate).toHaveBeenCalled();
  });
});
