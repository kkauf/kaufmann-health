import { describe, it, expect } from 'vitest';
import { buildEventId } from '@/lib/analytics';

describe('buildEventId', () => {
  it('creates a stable id from page/location/action', () => {
    expect(buildEventId('/fuer-therapeuten', 'hero', 'apply')).toBe(
      'fuer-therapeuten-hero-apply',
    );
  });

  it('normalizes whitespace, underscores, slashes, and symbols', () => {
    expect(buildEventId('/Foo Bar', 'hero_section', 'Click!')).toBe(
      'foo-bar-hero-section-click',
    );
  });

  it('handles duplicate separators and trims ends; includes optional qualifier', () => {
    expect(buildEventId('/a//b', ' x  y ', 'go', '-qual-')).toBe('a-b-x-y-go-qual');
  });

  it('omits empty segments and works when page is empty', () => {
    expect(buildEventId('', 'header', 'cta')).toBe('header-cta');
  });

  it('drops non-ascii-only inputs to empty safely', () => {
    expect(buildEventId('/äöü', 'ß', '—')).toBe('');
  });

  it('handles undefined qualifier', () => {
    expect(buildEventId('/x', undefined as unknown as string, 'act')).toBe(
      'x-act',
    );
  });
});
