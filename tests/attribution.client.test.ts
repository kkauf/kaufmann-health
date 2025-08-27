/* @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreateSessionId, getAttribution } from '@/lib/attribution';

function setReferrer(value: string) {
  Object.defineProperty(document, 'referrer', {
    value,
    configurable: true,
  });
}

function setSearch(search: string) {
  // Ensure leading ?
  const s = search.startsWith('?') ? search : `?${search}`;
  window.history.pushState({}, '', s);
}

beforeEach(() => {
  sessionStorage.clear();
  // reset URL
  window.history.replaceState({}, '', '/');
  setReferrer('');
});

describe('client attribution', () => {
  it('getOrCreateSessionId persists within session', () => {
    const a = getOrCreateSessionId();
    const b = getOrCreateSessionId();
    expect(a).toBeDefined();
    expect(a).toBe(b);
    expect(sessionStorage.getItem('kh.sid')).toBe(a);
  });

  it('getAttribution captures session_id, referrer, and UTM from URL and stores UTM', () => {
    setReferrer('https://ref.example/path');
    setSearch('?utm_source=google&utm_medium=cpc&utm_campaign=brand');

    const attr = getAttribution();
    expect(attr.session_id).toBeDefined();
    expect(attr.referrer).toBe('https://ref.example/path');
    expect(attr.utm_source).toBe('google');
    expect(attr.utm_medium).toBe('cpc');
    expect(attr.utm_campaign).toBe('brand');

    const utmStoredRaw = sessionStorage.getItem('kh.utm');
    expect(utmStoredRaw).toBeTruthy();
    const utmStored = JSON.parse(utmStoredRaw || '{}');
    expect(utmStored).toMatchObject({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'brand' });
  });

  it('getAttribution prefers stored UTM over URL params', () => {
    // Pre-store UTM
    sessionStorage.setItem('kh.utm', JSON.stringify({ utm_source: 'news', utm_medium: 'email', utm_campaign: 'aug' }));
    // URL has different values, should be ignored in favor of stored
    setSearch('?utm_source=google&utm_medium=cpc&utm_campaign=brand');
    const attr = getAttribution();
    expect(attr.utm_source).toBe('news');
    expect(attr.utm_medium).toBe('email');
    expect(attr.utm_campaign).toBe('aug');
  });
});
