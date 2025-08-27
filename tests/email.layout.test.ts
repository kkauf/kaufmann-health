import { describe, it, expect } from 'vitest';
import { renderLayout } from '@/lib/email/layout';

describe('email layout', () => {
  it('wraps content with brand header and footer link', () => {
    const html = renderLayout({ title: 'Test', contentHtml: '<p>Hello</p>' });
    expect(html).toContain('Kaufmann Health');
    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('kaufmann-health.de');
  });
});
