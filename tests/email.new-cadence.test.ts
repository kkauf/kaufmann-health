import { describe, it, expect } from 'vitest';
import { renderRichTherapistEmail } from '@/lib/email/templates/richTherapistEmail';
import { renderSelectionNudgeEmail } from '@/lib/email/templates/selectionNudge';
import { renderBehavioralFeedbackEmail } from '@/lib/email/templates/feedbackBehavioral';

describe('New Email Cadence Templates', () => {
  describe('Rich Therapist Email (Day 1)', () => {
    it('renders with therapist name in subject', () => {
      const result = renderRichTherapistEmail({
        patientName: 'Max',
        patientId: 'p-123',
        therapist: {
          id: 't-456',
          first_name: 'Anna',
          last_name: 'Müller',
          city: 'Berlin',
          modalities: ['narm', 'somatic-experiencing'],
          approach_text: 'Ich begleite Menschen auf ihrem Weg zur Heilung.',
          photo_url: null,
        },
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
      });

      // Subject includes therapist name with dynamic suffix (no slots = fallback)
      expect(result.subject).toContain('Anna M.');
      expect(result.subject).toContain('deine persönliche Empfehlung');
      expect(result.html).toContain('Hallo Max');
      expect(result.html).toContain('Anna M.');
      expect(result.html).toContain('Berlin');
      expect(result.html).toContain('NARM');
      expect(result.html).toContain('15 Min kostenlos');
      expect(result.html).toContain('Video-Gespräch');
      expect(result.html).toContain('Kostenlosen Termin buchen');
      expect(result.html).toContain('Andere Vorschläge ansehen');
      expect(result.html).toContain('Passt nicht zu mir');
      // Social proof testimonial
      expect(result.html).toContain('Nach 3 Sessions');
      expect(result.html).toContain('Patient:in aus Berlin');
    });

    it('includes tracking parameters in URLs', () => {
      const result = renderRichTherapistEmail({
        patientId: 'p-123',
        therapist: {
          id: 't-456',
          first_name: 'Anna',
          last_name: 'Müller',
        },
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
      });

      expect(result.html).toContain('utm_campaign=rich_therapist_d1');
      expect(result.html).toContain('utm_source=email');
    });

    it('renders feedback URL with patient and therapist IDs', () => {
      const result = renderRichTherapistEmail({
        patientId: 'p-123',
        therapist: {
          id: 't-456',
          first_name: 'Anna',
          last_name: 'Müller',
        },
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
      });

      expect(result.html).toContain('patient=p-123');
      expect(result.html).toContain('therapist=t-456');
      expect(result.html).toContain('reason=match_dissatisfied');
    });

    it('handles missing approach text gracefully', () => {
      const result = renderRichTherapistEmail({
        patientId: 'p-123',
        therapist: {
          id: 't-456',
          first_name: 'Anna',
          last_name: 'Müller',
          approach_text: '',
        },
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
      });

      expect(result.html).toBeDefined();
      expect(result.subject).toContain('Anna M.');
    });
  });

  describe('Selection Nudge Email (Day 5)', () => {
    it('renders with reassurance content', () => {
      const result = renderSelectionNudgeEmail({
        patientName: 'Max',
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
      });

      // New subject emphasizes free + unverbindlich
      expect(result.subject).toContain('kostenlos');
      expect(result.subject).toContain('unverbindlich');
      expect(result.html).toContain('Hallo Max');
      expect(result.html).toContain('Kennenlerngespräch');
      expect(result.html).toContain('Chemie');
      expect(result.html).toContain('jederzeit wechseln');
      expect(result.html).toContain('Kostenlosen Termin buchen');
      expect(result.html).toContain('Schreib uns');
    });

    it('includes tracking parameters', () => {
      const result = renderSelectionNudgeEmail({
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
      });

      expect(result.html).toContain('utm_campaign=selection_nudge_d5');
    });
  });

  describe('Behavioral Feedback Email (Day 10)', () => {
    it('renders visited_no_action variant with social proof', () => {
      const result = renderBehavioralFeedbackEmail({
        patientName: 'Max',
        patientId: 'p-123',
        segment: { segment: 'visited_no_action', visitCount: 3 },
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
        therapist: null,
      });

      expect(result.subject).toContain('85%');
      expect(result.html).toContain('Hallo Max');
      expect(result.html).toContain('Chemie');
      expect(result.html).toContain('kostenlos und unverbindlich');
    });

    it('renders almost_booked with therapist card and outline booking CTA', () => {
      const result = renderBehavioralFeedbackEmail({
        patientName: 'Max',
        patientId: 'p-123',
        segment: { segment: 'almost_booked', therapist_id: 't-456' },
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
        therapist: {
          id: 't-456',
          first_name: 'Anna',
          last_name: 'Müller',
          city: 'Berlin',
          modalities: ['narm'],
          approach_text: 'Ich begleite Menschen.',
          gender: 'female',
        },
      });

      expect(result.html).toContain('Anna M.');
      // Booking CTA should be outline (border style)
      expect(result.html).toContain('border:2px solid #10b981');
      // Interview CTA should be solid primary
      expect(result.html).toContain('background-color:#10b981');
      // Gender-aware title
      expect(result.html).toContain('K\u00F6rperpsychotherapeutin');
    });

    it('includes interview CTA with voucher offer', () => {
      const result = renderBehavioralFeedbackEmail({
        patientId: 'p-123',
        segment: { segment: 'never_visited' },
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
        therapist: null,
      });

      expect(result.html).toContain('50\u20AC Amazon-Gutschein');
      expect(result.html).toContain('Termin vereinbaren');
    });

    it('renders rejection variants', () => {
      const result = renderBehavioralFeedbackEmail({
        patientId: 'p-123',
        segment: { segment: 'rejected', reasons: [{ reason: 'too_expensive', therapist_id: 't-456' }] },
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
        therapist: null,
      });

      expect(result.subject).toContain('kostenlos');
      expect(result.html).toContain('Kennenlerngespräch ist kostenlos');
    });
  });

  describe('Dark Mode Prevention', () => {
    it('all templates include light-only meta tags', () => {
      const rich = renderRichTherapistEmail({
        patientId: 'p-123',
        therapist: { id: 't-456', first_name: 'Anna', last_name: 'M' },
        matchesUrl: 'https://example.com/matches/uuid',
      });
      const nudge = renderSelectionNudgeEmail({ matchesUrl: 'https://example.com/matches/uuid' });
      const feedback = renderBehavioralFeedbackEmail({
        patientId: 'p-123',
        segment: { segment: 'visited_no_action', visitCount: 0 },
        matchesUrl: 'https://example.com/matches/uuid',
        therapist: null,
      });

      for (const result of [rich, nudge, feedback]) {
        expect(result.html).toContain('color-scheme" content="light only"');
        expect(result.html).toContain('!important');
      }
    });
  });
});
