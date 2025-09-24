import { describe, it, expect, vi, beforeEach } from 'vitest';

let sentEmails: any[] = [];
let matchById: Record<string, { id: string; patient_id: string; therapist_id: string }> = {};
let peopleById: Record<string, { id: string; name?: string | null; email?: string | null; metadata?: any }> = {};
let therapistsById: Record<string, { id: string; first_name?: string | null; last_name?: string | null }> = {};

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

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(async () => {}),
}));

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'matches') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, id: string) => ({
              single: async () => {
                const m = matchById[id];
                return m ? { data: m, error: null } : { data: null, error: { message: 'not found' } };
              },
            }),
          }),
        } as any;
      }
      if (table === 'people') {
        return {
          select: (_cols?: string) => ({
            in: (_col: string, ids: string[]) => {
              const arr = ids.map((id) => peopleById[id]).filter(Boolean);
              return Promise.resolve({ data: arr, error: null });
            },
            eq: (_col: string, id: string) => ({
              single: async () => {
                const p = peopleById[id];
                return p ? { data: p, error: null } : { data: null, error: { message: 'not found' } };
              },
            }),
          }),
        } as any;
      }
      if (table === 'therapists') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, id: string) => ({
              single: async () => {
                const t = therapistsById[id];
                return t ? { data: t, error: null } : { data: null, error: { message: 'not found' } };
              },
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
  return new Request('http://localhost/api/admin/matches/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'kh_admin=token', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sentEmails = [];
  matchById = {};
  peopleById = {};
  therapistsById = {};
});

describe('/api/admin/matches/email POST', () => {
  it('returns 401 without admin cookie', async () => {
    const { POST } = await import('@/app/api/admin/matches/email/route');
    const res = await POST(new Request('http://localhost/api/admin/matches/email', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 404 when match not found', async () => {
    const { POST } = await import('@/app/api/admin/matches/email/route');
    const res = await POST(makePost({ id: 'm-1', template: 'match_found' }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it('returns 400 when patient email missing', async () => {
    matchById['m-1'] = { id: 'm-1', patient_id: 'p-1', therapist_id: 't-1' };
    // patient has no email
    peopleById['p-1'] = { id: 'p-1', name: 'P X' } as any;
    therapistsById['t-1'] = { id: 't-1', first_name: 'T', last_name: 'Y' } as any;

    const { POST } = await import('@/app/api/admin/matches/email/route');
    const res = await POST(makePost({ id: 'm-1', template: 'match_found' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Patient email/);
  });

  it('sends match_found email', async () => {
    matchById['m-1'] = { id: 'm-1', patient_id: 'p-1', therapist_id: 't-1' };
    peopleById['p-1'] = { id: 'p-1', name: 'Patient X', email: 'patient@example.com' } as any;
    therapistsById['t-1'] = { id: 't-1', first_name: 'Thera', last_name: 'Y' } as any;

    const { POST } = await import('@/app/api/admin/matches/email/route');
    const res = await POST(makePost({ id: 'm-1', template: 'match_found' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { ok: true }, error: null });

    expect(sentEmails.length).toBe(1);
    const email = sentEmails[0];
    expect(email.to).toBe('patient@example.com');
    expect(email.subject).toContain('Dein:e Therapeut:in');
    expect(email.context).toMatchObject({ kind: 'patient_update', template: 'match_found', match_id: 'm-1' });
  });

  it('sends custom email with message', async () => {
    matchById['m-1'] = { id: 'm-1', patient_id: 'p-1', therapist_id: 't-1' };
    peopleById['p-1'] = { id: 'p-1', name: 'Patient X', email: 'patient@example.com' } as any;

    const { POST } = await import('@/app/api/admin/matches/email/route');
    const res = await POST(makePost({ id: 'm-1', template: 'custom', message: 'Hallo! Kurzes Update.' }));
    expect(res.status).toBe(200);
    expect(sentEmails.length).toBe(1);
    const email = sentEmails[0];
    expect(email.to).toBe('patient@example.com');
    expect(email.subject).toBe('Update zu deiner Therapeut:innensuche');
    expect(email.context).toMatchObject({ template: 'custom' });
  });
});
