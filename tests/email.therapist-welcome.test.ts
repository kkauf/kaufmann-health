import { describe, it, expect } from 'vitest';
import { renderTherapistWelcome } from '@/lib/email/templates/therapistWelcome';

// Note: BASE_URL defaults to https://kaufmann-health.de (see constants.ts)

describe('therapist welcome email', () => {
  it('includes absolute T&C link with version', () => {
    const version = 'v1.2.3';
    const { html, subject } = renderTherapistWelcome({
      name: 'Test',
      city: 'Berlin',
      isActiveCity: true,
      termsVersion: version,
    });
    expect(subject).toBe('Willkommen bei Kaufmann Health');
    expect(html).toContain(`https://kaufmann-health.de/therapist-terms?version=${encodeURIComponent(version)}`);
    expect(html).toContain(version);
  });

  it('renders city-specific copy for inactive city', () => {
    const { html } = renderTherapistWelcome({
      name: 'Test',
      city: 'Hamburg',
      isActiveCity: false,
      termsVersion: 'v1',
    });
    expect(html).toContain('Kaufmann Health startet bald in Hamburg');
  });
});
