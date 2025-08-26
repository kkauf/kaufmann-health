import { describe, it, expect } from 'vitest';
import { POST as eventsPOST } from '@/app/api/events/route';

function makeReq(body: any) {
  return new Request('http://localhost/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/events POST', () => {
  it('400 when type is missing', async () => {
    const res = await eventsPOST(makeReq({ id: 'x' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Missing type' });
  });

  it('200 on minimal valid payload', async () => {
    const res = await eventsPOST(makeReq({ type: 'click', id: 'abc', title: 'CTA' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { received: true }, error: null });
  });
});
