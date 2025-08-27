import { describe, it, expect } from 'vitest';
import { parseAttributionFromRequest } from '@/lib/server-analytics';

function makeReq(headers?: Record<string, string>) {
  return new Request('http://localhost/example', {
    method: 'GET',
    headers: headers ?? {},
  });
}

describe('server analytics: parseAttributionFromRequest', () => {
  it('returns empty object when no referer header present', () => {
    const req = makeReq();
    const attr = parseAttributionFromRequest(req);
    expect(attr).toEqual({});
  });

  it('extracts referrer and UTM parameters from referer header URL', () => {
    const ref = 'https://ref.example/path?utm_source=google&utm_medium=cpc&utm_campaign=brand';
    const req = makeReq({ referer: ref });
    const attr = parseAttributionFromRequest(req);
    expect(attr.referrer).toBe(ref);
    expect(attr.utm_source).toBe('google');
    expect(attr.utm_medium).toBe('cpc');
    expect(attr.utm_campaign).toBe('brand');
  });

  it('handles invalid referer gracefully', () => {
    const ref = '::not-a-valid-url';
    const req = makeReq({ referer: ref });
    const attr = parseAttributionFromRequest(req);
    expect(attr).toEqual({ referrer: ref });
  });
});
