import { describe, it, expect, vi, beforeEach } from 'vitest';

let matchByUuid: Record<string, any> = {};
let allMatches: any[] = [];
let therapistById: Record<string, any> = {};
let patientById: Record<string, any> = {};
let updateCalls: Array<{ id: string; payload: Record<string, unknown> }> = [];

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomUUID: () => 'uuid-new',
  };
});

vi.mock('@/lib/logger', () => {
  return {
    logError: vi.fn(async () => {}),
  };
});

vi.mock('@/lib/server-analytics', () => {
  return {
    ServerAnalytics: {
      trackEventFromRequest: vi.fn(),
    },
  };
});

const sendEmailMock = vi.fn<(params: any) => Promise<{ id: string }>>(async (_params) => ({ id: 'email-1' }));
vi.mock('@/lib/email/client', () => {
  return {
    sendEmail: sendEmailMock,
  };
});

vi.mock('@/lib/email/templates/therapistNotification', () => {
  return {
    renderTherapistNotification: () => ({ subject: 'subject', html: '<p>html</p>' }),
  };
});

vi.mock('@/lib/constants', () => {
  return {
    BASE_URL: 'https://example.test',
  };
});

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'matches') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, value: string) => ({
              single: async () => {
                const row = matchByUuid[value];
                return row ? { data: row, error: null } : { data: null, error: { message: 'not found' } };
              },
              order: (_c: string, _opts?: any) => ({
                limit: async (_n: number) => {
                  const row = matchByUuid[value];
                  return row ? { data: [row], error: null } : { data: [], error: null };
                },
              }),
              limit: async (_n: number) => {
                const row = matchByUuid[value];
                return row ? { data: [row], error: null } : { data: [], error: null };
              },
            }),
            filter: (_col: string, _op: string, value: string) => {
              let needle: string | null = null;
              try {
                const parsed = JSON.parse(value);
                needle = parsed?.previous_secure_uuids?.[0] ? String(parsed.previous_secure_uuids[0]) : null;
              } catch {}

              const found = needle
                ? allMatches.find((m) => Array.isArray(m?.metadata?.previous_secure_uuids) && m.metadata.previous_secure_uuids.includes(needle))
                : null;

              return {
                order: (_c: string, _opts?: any) => ({
                  limit: async (_n: number) => ({ data: found ? [found] : [], error: null }),
                }),
                limit: async (_n: number) => ({ data: found ? [found] : [], error: null }),
              };
            },
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              updateCalls.push({ id, payload });
              return { error: null } as const;
            },
          }),
        } as any;
      }

      if (table === 'therapists') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, id: string) => ({
              single: async () => {
                const row = therapistById[id];
                return row ? { data: row, error: null } : { data: null, error: { message: 'not found' } };
              },
            }),
          }),
        } as any;
      }

      if (table === 'people') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, id: string) => ({
              single: async () => {
                const row = patientById[id];
                return row ? { data: row, error: null } : { data: null, error: { message: 'not found' } };
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

function makePost(url: string, body?: any) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

beforeEach(() => {
  matchByUuid = {};
  allMatches = [];
  therapistById = {};
  patientById = {};
  updateCalls = [];
  sendEmailMock.mockClear();
});

describe('/api/match/[uuid]/resend POST', () => {
  it('resends and rotates secure_uuid', async () => {
    const nowIso = new Date().toISOString();
    matchByUuid['u-1'] = {
      id: 'm-1',
      secure_uuid: 'u-1',
      created_at: nowIso,
      patient_id: 'p-1',
      therapist_id: 't-1',
      status: 'proposed',
      metadata: {},
    };
    therapistById['t-1'] = { id: 't-1', first_name: 'T', last_name: 'One', email: 't1@example.test' };
    patientById['p-1'] = { metadata: { city: 'Berlin', issue: 'Stress', session_preference: 'online' } };

    const { POST } = await import('@/app/api/public/match/[uuid]/resend/route');

    const res = await POST(makePost('http://localhost/api/match/u-1/resend', {}));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { ok: true }, error: null });

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0]).toEqual({
      id: 'm-1',
      payload: expect.objectContaining({
        secure_uuid: 'uuid-new',
        metadata: expect.objectContaining({
          previous_secure_uuids: ['u-1'],
        }),
      }),
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const firstArgs = sendEmailMock.mock.calls[0] as unknown as [any];
    expect(firstArgs[0]).toEqual(
      expect.objectContaining({
        to: 't1@example.test',
        context: expect.objectContaining({
          match_id: 'm-1',
          therapist_id: 't-1',
          email_token: 'uuid-new',
          stage: 'resend',
        }),
      })
    );
  });

  it('rate limits resends within 10 minutes', async () => {
    const nowIso = new Date().toISOString();
    matchByUuid['u-2'] = {
      id: 'm-2',
      secure_uuid: 'u-2',
      created_at: nowIso,
      patient_id: 'p-2',
      therapist_id: 't-2',
      status: 'proposed',
      metadata: {
        magic_link_issued_at: new Date().toISOString(),
      },
    };

    const { POST } = await import('@/app/api/public/match/[uuid]/resend/route');

    const res = await POST(makePost('http://localhost/api/match/u-2/resend', {}));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Bitte warte kurz und versuche es erneut.' });

    expect(updateCalls.length).toBe(0);
    expect(sendEmailMock).toHaveBeenCalledTimes(0);
  });

  it('finds match by previous secure uuid and rotates again', async () => {
    const nowIso = new Date().toISOString();
    const match = {
      id: 'm-3',
      secure_uuid: 'u-cur',
      created_at: nowIso,
      patient_id: 'p-3',
      therapist_id: 't-3',
      status: 'proposed',
      metadata: {
        previous_secure_uuids: ['u-old'],
      },
    };
    matchByUuid['u-cur'] = match;
    allMatches = [match];

    therapistById['t-3'] = { id: 't-3', first_name: 'T', last_name: 'Three', email: 't3@example.test' };
    patientById['p-3'] = { metadata: { city: 'Berlin', issue: 'Stress', session_preference: 'online' } };

    const { POST } = await import('@/app/api/public/match/[uuid]/resend/route');

    const res = await POST(makePost('http://localhost/api/match/u-old/resend', {}));
    expect(res.status).toBe(200);

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].id).toBe('m-3');
    expect(updateCalls[0].payload).toEqual(
      expect.objectContaining({
        secure_uuid: 'uuid-new',
        metadata: expect.objectContaining({
          previous_secure_uuids: expect.arrayContaining(['u-old', 'u-cur']),
        }),
      })
    );
  });
});
