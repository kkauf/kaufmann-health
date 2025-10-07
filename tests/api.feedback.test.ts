import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let inserted: Array<{ match_id: string; reason: string }> = [];
let sentEmails: any[] = [];

vi.mock('@/lib/logger', () => ({
  track: vi.fn(async () => {}),
  logError: vi.fn(async () => {}),
}));

vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(async (params: any) => {
    sentEmails.push(params);
    return true;
  }),
}));

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'session_blockers') {
        return {
          insert: (row: any) => ({
            select: () => ({ limit: () => ({ maybeSingle: async () => {
              inserted.push({ match_id: row.match_id, reason: row.reason });
              return { data: { id: 'sb-1' }, error: null };
            } }) }),
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
  inserted = [];
  sentEmails = [];
});

afterEach(() => {
  delete (process.env as any).LEADS_NOTIFY_EMAIL;
});

describe('/api/feedback GET', () => {
  it('records blocker and redirects to thank-you', async () => {
    const { GET } = await import('@/app/api/public/feedback/route');
    const res = await GET(makeGet('http://localhost/api/feedback?match=m-1&reason=scheduling'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('location')).toMatch(/\/feedback-received\?ok=1$/);
    expect(inserted).toContainEqual({ match_id: 'm-1', reason: 'scheduling' });
    expect(sentEmails.length).toBe(0);
  });

  it('sends internal alert when reason=no_contact', async () => {
    (process.env as any).LEADS_NOTIFY_EMAIL = 'ops@example.com';
    const { GET } = await import('@/app/api/public/feedback/route');
    const res = await GET(makeGet('http://localhost/api/feedback?match=m-2&reason=no_contact'));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(inserted).toContainEqual({ match_id: 'm-2', reason: 'no_contact' });
    expect(sentEmails.length).toBe(1);
    const email = sentEmails[0];
    expect(email.to).toBe('ops@example.com');
    expect(email.subject).toMatch(/URGENT/i);
    expect(email.context).toMatchObject({ kind: 'session_blocker_alert', match_id: 'm-2', reason: 'no_contact' });
  });
});
