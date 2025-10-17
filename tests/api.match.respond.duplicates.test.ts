import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('@/lib/server-analytics', () => ({ ServerAnalytics: { trackEventFromRequest: vi.fn() } }));

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: { from: vi.fn() },
}));

import { supabaseServer } from '@/lib/supabase-server';

function makePost(url: string, body?: any) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/match/[uuid]/respond fallback on duplicate secure_uuid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses latest row when .single() fails to coerce and proceeds to accept', async () => {
    const uuid = 'dup-uuid-resp';
    const now = new Date().toISOString();
    const match = { id: 'm-dup', status: 'proposed', created_at: now, patient_id: 'p1', therapist_id: 't1', metadata: {} };

    let call = 0;
    (supabaseServer.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'matches') {
        call++;
        if (call === 1) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Cannot coerce the result to a single JSON object' } }),
          } as any;
        }
        if (call === 2) {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [match], error: null }),
          } as any;
        }
        // Update call
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { secure_uuid: uuid }, error: null }),
        } as any;
      }
      if (table === 'people') {
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnThis(),
          eq2: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'p1', name: 'Max', email: 'max@example.com', phone_number: '+49123' }, error: null }),
        } as any;
      }
      if (table === 'therapists') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 't1', first_name: 'Anna', last_name: 'S', email: 'anna@example.com' }, error: null }),
        } as any;
      }
      throw new Error('Unexpected table ' + table);
    });

    const { POST } = await import('@/app/api/public/match/[uuid]/respond/route');
    const res = await POST(makePost(`http://localhost/api/match/${uuid}/respond`, { action: 'accept' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { status: 'accepted' }, error: null });
  });
});
