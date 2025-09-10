import { describe, it, expect, vi, beforeEach } from 'vitest';

let updateCalls: Array<{ id: string; payload: Record<string, unknown> }> = [];

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'matches') {
        return {
          update: (payload: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              updateCalls.push({ id, payload });
              return { error: null } as const;
            },
          }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;
  return { supabaseServer };
});

function makeGet(url: string) {
  return new Request(url, { method: 'GET' });
}

beforeEach(() => {
  updateCalls = [];
  vi.clearAllMocks();
});

describe('/api/track/therapist-action GET', () => {
  it('302-redirects to mailto and updates therapist_contacted_at', async () => {
    const { GET } = await import('@/app/api/track/therapist-action/route');
    const mailto = 'mailto:client@example.com?subject=Hi&body=Test';
    const url = `http://localhost/api/track/therapist-action?action=email_clicked&match_id=m-1&redirect=${encodeURIComponent(mailto)}`;

    const res = await GET(makeGet(url));
    expect(res.status).toBe(302);
    const loc = res.headers.get('Location');
    expect(loc).toBe(mailto);

    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0]).toEqual({ id: 'm-1', payload: expect.objectContaining({ therapist_contacted_at: expect.any(String) }) });
  });

  it('returns 400 on invalid redirect scheme', async () => {
    const { GET } = await import('@/app/api/track/therapist-action/route');
    const bad = 'https://example.com/anything';
    const url = `http://localhost/api/track/therapist-action?action=email_clicked&match_id=m-1&redirect=${encodeURIComponent(bad)}`;
    const res = await GET(makeGet(url));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Invalid redirect' });
  });
});
