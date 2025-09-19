import { describe, it, expect } from 'vitest';
import { renderPatientSelectionEmail } from '@/lib/email/templates/patientSelection';

describe('patient selection email schema', () => {
  it('includes Gmail JSON-LD schema with ViewAction and target URL', () => {
    const selectUrl = 'https://kaufmann-health.de/api/match/uuid/select?choice=1';
    const { html, subject } = renderPatientSelectionEmail({
      patientName: 'Max Mustermann',
      items: [
        {
          id: 't1',
          first_name: 'Anna',
          last_name: 'Therapeutin',
          photo_url: null,
          modalities: ['narm'],
          approach_text: 'Test',
          accepting_new: true,
          city: 'Berlin',
          selectUrl,
          isBest: true,
        },
      ],
    });
    expect(subject).toContain('Deine persönlich kuratierte Auswahl');
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('ViewAction');
    expect(html).toContain(selectUrl);
  });
});
