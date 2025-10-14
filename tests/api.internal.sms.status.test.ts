import { describe, it, expect, vi, beforeEach } from 'vitest';

let events: any[] = [];

vi.mock('@/lib/logger', () => ({
  track: vi.fn(async (p: any) => { events.push(p); }),
  logError: vi.fn(async () => {}),
}));

function makePost(body: string, headers?: Record<string, string>) {
  return new Request('http://localhost/api/internal/sms/status', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...(headers || {}) },
    body,
  });
}

beforeEach(() => {
  events = [];
});

describe('/api/internal/sms/status POST', () => {
  it('accepts form-encoded payload without signature and tracks masked status', async () => {
    const { POST } = await import('@/app/api/internal/sms/status/route');
    const body = new URLSearchParams({
      MessageSid: 'SM123',
      MessageStatus: 'delivered',
      To: '+491234567890',
      From: 'Kaufmann',
    }).toString();

    const res = await POST(makePost(body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { ok: true }, error: null });

    const e = events.find((ev) => ev?.type === 'sms_status');
    expect(e).toBeTruthy();
    expect(e.props.status).toBe('delivered');
    expect(e.props.to).toMatch(/^\*\*\*\d{6}$/); // tail masked
    expect(e.props.from).toMatch(/^\*\*\*[A-Za-z0-9]{6}$/); // tail masked
  });
});
