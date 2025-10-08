/**
 * Tests for EARTH-203: Patient-initiated contact flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/public/contact/route';
import { supabaseServer } from '@/lib/supabase-server';

// Mock dependencies
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/lib/auth/clientSession', () => ({
  getClientSession: vi.fn().mockResolvedValue(null),
  createClientSessionToken: vi.fn().mockResolvedValue('mock-token'),
  createClientSessionCookie: vi.fn().mockReturnValue('kh_client=mock-token; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax'),
}));

describe('POST /api/public/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new patient and match for first-time contact', async () => {
    const mockPatientId = 'patient-123';
    const mockTherapistId = 'therapist-456';
    const mockMatchId = 'match-789';
    const mockSecureUuid = 'secure-uuid-abc';

    (supabaseServer.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'people') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: mockPatientId },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'therapists') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: mockTherapistId,
                    first_name: 'Anna',
                    last_name: 'Schmidt',
                    email: 'anna@example.com',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: mockMatchId, secure_uuid: mockSecureUuid },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    const request = new Request('http://localhost:3000/api/public/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify({
        therapist_id: mockTherapistId,
        contact_type: 'booking',
        patient_name: 'Max Mustermann',
        patient_email: 'max@example.com',
        contact_method: 'email',
        patient_reason: 'Panikattacken',
        patient_message: 'Guten Tag Anna, ich möchte gerne einen Termin vereinbaren...',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toBeDefined();
    expect(data.data.match_id).toBe(mockMatchId);
    expect(data.data.success).toBe(true);
  });

  it('enforces rate limit of 3 contacts per day', async () => {
    const mockPatientId = 'patient-123';
    const mockTherapistId = 'therapist-456';

    const { getClientSession } = await import('@/lib/auth/clientSession');
    (getClientSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      patient_id: mockPatientId,
      contact_method: 'email',
      contact_value: 'max@example.com',
      name: 'Max Mustermann',
    });

    // Mock rate limit check: 3 matches already exist
    (supabaseServer.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'people') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockPatientId },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({
                data: [{ id: '1' }, { id: '2' }, { id: '3' }],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    const request = new Request('http://localhost:3000/api/public/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify({
        therapist_id: mockTherapistId,
        contact_type: 'booking',
        patient_name: 'Max Mustermann',
        patient_email: 'max@example.com',
        contact_method: 'email',
        patient_reason: 'Panikattacken',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('bereits 3 Therapeuten kontaktiert');
    expect(data.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('validates required fields', async () => {
    const request = new Request('http://localhost:3000/api/public/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        therapist_id: 'therapist-123',
        // Missing required fields
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it('returns 404 for non-existent therapist', async () => {
    (supabaseServer.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'people') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'patient-123' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'therapists') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Not found' },
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    const request = new Request('http://localhost:3000/api/public/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        therapist_id: 'non-existent',
        contact_type: 'booking',
        patient_name: 'Max Mustermann',
        patient_email: 'max@example.com',
        contact_method: 'email',
        patient_reason: 'Panikattacken',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('nicht gefunden');
  });
});
