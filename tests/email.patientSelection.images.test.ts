import { describe, it, expect } from 'vitest';
import { renderPatientSelectionEmail } from '@/lib/email/templates/patientSelection';

describe('email: patientSelection therapist images are proxied', () => {
  it('replaces Supabase public URLs with our domain proxy', () => {
    const items = [
      {
        id: 't1',
        first_name: 'Anna',
        last_name: 'Beispiel',
        // Typical Supabase public URL
        photo_url: 'https://lvglocnygvmgwzdayqlc.supabase.co/storage/v1/object/public/therapist-profiles/t1.jpg',
        modalities: ['narm'],
        approach_text: 'Kurzbeschreibung.',
        accepting_new: true,
        city: 'Berlin',
        selectUrl: 'https://kaufmann-health.de/api/match/abc/select?therapist=t1',
      },
    ];

    const { html } = renderPatientSelectionEmail({ patientName: 'Test', items });

    // Should not include the Supabase storage host
    expect(html).not.toContain('supabase.co/storage/v1/object/public/therapist-profiles/');
    // Should include our proxy prefix
    expect(html).toContain('https://www.kaufmann-health.de/api/images/therapist-profiles/t1.jpg');
  });
});
