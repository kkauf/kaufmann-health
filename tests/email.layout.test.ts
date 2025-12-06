import { describe, it, expect } from 'vitest';
import { renderLayout, renderButton } from '@/lib/email/layout';

describe('email layout', () => {
  it('wraps content with brand header and footer link', () => {
    const html = renderLayout({ title: 'Test', contentHtml: '<p>Hello</p>' });
    expect(html).toContain('Kaufmann Health');
    expect(html).toContain('<p>Hello</p>');
    expect(html).toContain('kaufmann-health.de');
  });

  it('renderButton produces clickable table-based button for email clients', () => {
    const html = renderButton('https://example.com/test', 'Click Me');
    // Should use table-based layout for maximum email client compatibility
    expect(html).toContain('<table');
    expect(html).toContain('href="https://example.com/test"');
    expect(html).toContain('Click Me');
    expect(html).toContain('target="_blank"');
    // Should have solid background color (not gradient) for compatibility
    expect(html).toContain('background-color:#10b981');
  });

  it('renderButton escapes HTML in href and label', () => {
    const html = renderButton('https://example.com/?a=1&b=2', 'Test <script>');
    expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
