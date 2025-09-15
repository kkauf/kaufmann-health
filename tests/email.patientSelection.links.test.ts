import { describe, it, expect } from 'vitest';
import { renderPatientSelectionEmail } from '@/lib/email/templates/patientSelection';

describe('email: patientSelection external links', () => {
  it('does not include flagged external domains', () => {
    const items = [
      {
        id: 't1',
        first_name: 'Anna',
        last_name: 'Beispiel',
        photo_url: 'https://cdn.example.com/photo.jpg',
        modalities: ['narm', 'hakomi'],
        approach_text: 'Kurzbeschreibung zur Arbeitsweise. Ruhig und professionell.',
        accepting_new: true,
        city: 'Berlin',
        selectUrl: 'https://kaufmann-health.de/api/match/abc/select?therapist=t1',
      },
      {
        id: 't2',
        first_name: 'Max',
        last_name: 'Mustermann',
        modalities: ['somatic-experiencing', 'core-energetics'],
        approach_text: 'Fokus auf Körper und Nervensystem.',
        accepting_new: false,
        city: 'Berlin',
        selectUrl: 'https://kaufmann-health.de/api/match/abc/select?therapist=t2',
      }
    ];

    const { html, subject } = renderPatientSelectionEmail({
      patientName: 'Test',
      items,
      subjectOverride: 'Test Subject',
    });

    expect(typeof html).toBe('string');
    expect(typeof subject).toBe('string');

    const flagged = [
      'narmtraining.com',
      'traumahealing.org',
      'hakomi.de',
      'coreenergetics.nl',
    ];

    for (const domain of flagged) {
      expect(html).not.toContain(domain);
    }
  });
});
