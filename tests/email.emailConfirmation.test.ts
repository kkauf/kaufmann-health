import { describe, it, expect } from 'vitest';
import { renderEmailConfirmation } from '@/lib/email/templates/emailConfirmation';

describe('emailConfirmation template', () => {
  it('renders subject and CTA with internal link only', () => {
    const html = renderEmailConfirmation({ confirmUrl: 'http://localhost/api/leads/confirm?token=t&id=1' });
    expect(html.subject).toContain('Bestätigen');
    expect(html.html).toContain('/api/leads/confirm?token=');
    // No known external marketing domains
    const forbidden = ['http://narmtraining.com', 'https://narmtraining.com', 'traumahealing.org', 'hakomi.de', 'coreenergetics.nl'];
    for (const domain of forbidden) {
      expect(html.html).not.toContain(domain);
    }
  });
});
