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
    expect(subject).toBe('Willkommen! Vervollständige dein Profil');
    expect(html).toContain(`https://kaufmann-health.de/therapist-terms?version=${encodeURIComponent(version)}`);
    expect(html).toContain(version);
  });

  it('renders city-specific copy for inactive city (online available, in-person pending)', () => {
    const { html } = renderTherapistWelcome({
      name: 'Test',
      city: 'Hamburg',
      isActiveCity: false,
      termsVersion: 'v1',
    });
    expect(html).toContain('Online‑Sitzungen sind sofort möglich');
    expect(html).toContain('Für Vor‑Ort‑Termine in Hamburg melden wir uns');
  });

  it('includes Gmail JSON-LD schema when uploadUrl is provided', () => {
    const uploadUrl = 'https://kaufmann-health.de/therapists/upload-documents/123';
    const { html } = renderTherapistWelcome({
      name: 'Test',
      city: 'Berlin',
      isActiveCity: true,
      termsVersion: 'v1',
      uploadUrl,
    });
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('ViewAction');
    expect(html).toContain(uploadUrl);
  });
});
