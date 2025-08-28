import { describe, it, expect, vi, beforeEach } from 'vitest';

let secureUUID: string | null = 'su-123';
let therapistEmail: string | null = 'thera@example.com';
let therapistName: string | null = 'Dr. T';
let insertedMatchId = 'm-123';
let lastInsert: any = null;
let sentEmails: any[] = [];

vi.mock('@/lib/auth/adminSession', () => {
  return {
    ADMIN_SESSION_COOKIE: 'kh_admin',
    verifySessionToken: vi.fn(async () => true),
  } as any;
});

vi.mock('@/lib/email/client', () => {
  return {
    sendEmail: vi.fn(async (params: any) => {
      sentEmails.push(params);
    }),
  } as any;
});

vi.mock('@/lib/email/templates/therapistOutreach', () => {
  return {
    renderTherapistOutreach: vi.fn(() => ({ subject: 'x', html: '<p>x</p>' })),
  } as any;
});

// Capture analytics events (fire-and-forget); no-op implementation
vi.mock('@/lib/server-analytics', () => {
  return {
    ServerAnalytics: {
      trackEventFromRequest: vi.fn(async () => {}),
    },
  } as any;
});

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'people') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, id: string) => ({
              single: async () => {
                if (id === 'p-1') {
                  return {
                    data: { id: 'p-1', type: 'patient', metadata: { city: 'Berlin', issue: 'Trauma' } },
                    error: null,
                  };
                }
                if (id === 't-1') {
                  return {
                    data: { id: 't-1', type: 'therapist', email: therapistEmail, name: therapistName },
                    error: null,
                  };
                }
                return { data: null, error: { message: 'not found' } };
              },
            }),
          }),
        } as any;
      }
      if (table === 'matches') {
        return {
          insert: (payload: any) => {
            lastInsert = payload;
            return {
              select: () => ({
                single: async () => ({ data: { id: insertedMatchId }, error: null }),
              }),
            };
          },
          select: (_cols?: string) => ({
            eq: (_col: string, id: string) => ({
              single: async () => ({
                data: { secure_uuid: secureUUID, created_at: new Date().toISOString(), id },
                error: null,
              }),
            }),
          }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;
  return { supabaseServer };
});

function makePost(body: any, headers?: Record<string, string>) {
  return new Request('http://localhost/admin/api/matches', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'kh_admin=token', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  secureUUID = 'su-123';
  therapistEmail = 'thera@example.com';
  therapistName = 'Dr. T';
  insertedMatchId = 'm-123';
  lastInsert = null;
  sentEmails = [];
});

describe('/admin/api/matches POST outreach', () => {
  it('enqueues outreach email when secure_uuid and therapist email exist', async () => {
    const { POST } = await import('@/app/admin/api/matches/route');
    const res = await POST(
      makePost({ patient_id: 'p-1', therapist_id: 't-1', notes: 'hi' })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { id: 'm-123' }, error: null });
    expect(lastInsert).toEqual({ patient_id: 'p-1', therapist_id: 't-1', status: 'proposed', notes: 'hi' });

    // Email sent once
    expect(sentEmails.length).toBe(1);
    const email = sentEmails[0];
    expect(email.to).toBe('thera@example.com');
    expect(email.subject).toBe('x');
    expect(email.html).toBe('<p>x</p>');
    expect(email.context).toMatchObject({ kind: 'therapist_outreach', match_id: 'm-123', patient_id: 'p-1', therapist_id: 't-1' });
  });

  it('skips outreach when secure_uuid is missing', async () => {
    secureUUID = null; // simulate pre-migration or missing
    const { POST } = await import('@/app/admin/api/matches/route');
    const res = await POST(
      makePost({ patient_id: 'p-1', therapist_id: 't-1' })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { id: 'm-123' }, error: null });
    expect(sentEmails.length).toBe(0);
  });
});
