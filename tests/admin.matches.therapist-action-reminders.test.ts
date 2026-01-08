import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mail tracking
const sentEmails: Array<{ to?: string | string[]; subject: string; html?: string }> = [];

// In-memory data for mocks
let eventsRows: Array<{ id: string; created_at?: string | null; props?: Record<string, unknown> | null }> = [];
let matchById: Record<string, { id: string; patient_id: string; therapist_id: string; status?: string | null; therapist_contacted_at?: string | null; secure_uuid?: string | null }> = {};
let peopleById: Record<string, { id: string; name?: string | null; email?: string | null; phone?: string | null; metadata?: { city?: string; issue?: string; session_preference?: 'online' | 'in_person' } | null }> = {};
let therapistsById: Record<string, { id: string; first_name?: string | null; last_name?: string | null; email?: string | null; city?: string | null }> = {};

vi.mock('@/lib/email/client', () => {
  return {
    sendEmail: vi.fn(async (params: any) => {
      sentEmails.push({ to: params?.to, subject: params?.subject, html: params?.html });
      return { sent: true }; // Indicate successful send
    }),
  };
});

vi.mock('@/lib/supabase-server', () => {
  const supabaseServer = {
    from: (table: string) => {
      if (table === 'events') {
        const api = {
          select: (_cols?: string) => api,
          eq: (_col: string, _val: string) => api,
          gte: (_col: string, _iso: string) => api,
          lt: (_col: string, _iso: string) => api,
          limit: async (_n: number) => ({ data: eventsRows, error: null as any }),
        } as any;
        return api;
      }
      if (table === 'matches') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: matchById[id] || null, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'people') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, id: string) => ({
              single: async () => ({ data: peopleById[id] || null, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'therapists') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, id: string) => ({
              single: async () => ({ data: therapistsById[id] || null, error: null }),
            }),
          }),
        } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as any;
  return { supabaseServer };
});

function makeGet(url: string, headers?: Record<string, string>) {
  return new Request(url, { method: 'GET', headers });
}

beforeEach(() => {
  eventsRows = [];
  matchById = {};
  peopleById = {};
  therapistsById = {};
  sentEmails.length = 0;
  vi.clearAllMocks();
});

describe('/api/admin/matches/therapist-action-reminders GET', () => {
  it('sends reminder email with CTA for patient_selected match without therapist_contacted_at', async () => {
    const { GET } = await import('@/app/api/admin/matches/therapist-action-reminders/route');

    // Setup data
    eventsRows = [
      { id: 'e1', created_at: new Date().toISOString(), props: { match_id: 'm1' } },
    ];
    matchById['m1'] = { id: 'm1', patient_id: 'p1', therapist_id: 't1', status: 'patient_selected', therapist_contacted_at: null, secure_uuid: 'secure-abc' };
    peopleById['p1'] = { id: 'p1', name: 'Paula Patient', email: 'p@example.com', phone: '123', metadata: { city: 'Berlin', issue: 'Anxiety', session_preference: 'online' } };
    therapistsById['t1'] = { id: 't1', first_name: 'Thera', last_name: 'Pist', email: 't@example.com', city: 'Berlin' };

    const res = await GET(makeGet('http://localhost/api/admin/matches/therapist-action-reminders?stage=20h', { 'x-vercel-cron': '1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json?.data?.processed).toBeGreaterThanOrEqual(1);
    expect(json?.data?.sent).toBe(1);

    expect(sentEmails.length).toBe(1);
    expect(sentEmails[0].to).toBe('t@example.com');
    expect(sentEmails[0].subject).toMatch(/Erinnerung/);
    // Email should link to magic acceptance page, not mailto
    expect(sentEmails[0].html).toContain('/match/');
    expect(sentEmails[0].html).not.toMatch(/mailto(%3A|:)/);
  });

  it('skips email when therapist already contacted', async () => {
    const { GET } = await import('@/app/api/admin/matches/therapist-action-reminders/route');

    eventsRows = [{ id: 'e1', props: { match_id: 'm1' } }];
    matchById['m1'] = { id: 'm1', patient_id: 'p1', therapist_id: 't1', status: 'patient_selected', therapist_contacted_at: new Date().toISOString() };
    peopleById['p1'] = { id: 'p1', email: 'p@example.com' };
    therapistsById['t1'] = { id: 't1', email: 't@example.com' };

    const res = await GET(makeGet('http://localhost/api/admin/matches/therapist-action-reminders?stage=20h', { 'x-vercel-cron': '1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json?.data?.sent).toBe(0);
    expect(sentEmails.length).toBe(0);
  });
});
