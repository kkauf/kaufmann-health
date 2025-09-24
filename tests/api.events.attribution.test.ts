import { describe, it, expect, vi, afterEach } from 'vitest';
import { POST as eventsPOST } from '@/app/api/public/events/route';
import * as logger from '@/lib/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeReq(body: any, headers?: Record<string, string>) {
  return new Request('http://localhost/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  });
}

describe('/api/events attribution merging', () => {
  it('merges session_id, referrer header, UTM params, and properties', async () => {
    const spy = vi.spyOn(logger, 'track').mockResolvedValue(undefined);
    const referer = 'https://ref.example/path?utm_source=google&utm_medium=cpc&utm_campaign=brand';

    const res = await eventsPOST(
      makeReq(
        {
          type: 'cta_click',
          id: 'btn-1',
          title: 'Hero CTA',
          session_id: 'sid-123',
          properties: { foo: 'bar' },
        },
        {
          referer,
          'user-agent': 'vitest-UA',
          'x-forwarded-for': '1.2.3.4',
        },
      ),
    );

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0] as Parameters<typeof logger.track>[0];
    expect(arg.type).toBe('cta_click');
    expect(arg.source).toBe('api.events');
    expect(arg.props).toMatchObject({
      id: 'btn-1',
      title: 'Hero CTA',
      path: '/api/events',
      session_id: 'sid-123',
      referrer: referer,
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'brand',
      foo: 'bar',
    });
  });
});
