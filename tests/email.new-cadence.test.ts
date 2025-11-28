import { describe, it, expect } from 'vitest';
import { renderRichTherapistEmail } from '@/lib/email/templates/richTherapistEmail';
import { renderSelectionNudgeEmail } from '@/lib/email/templates/selectionNudge';
import { renderFeedbackRequestEmail } from '@/lib/email/templates/feedbackRequest';

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

      expect(result.subject).toBe('Anna M. — deine persönliche Empfehlung');
      expect(result.html).toContain('Hallo Max');
      expect(result.html).toContain('Anna M.');
      expect(result.html).toContain('Berlin');
      expect(result.html).toContain('NARM');
      expect(result.html).toContain('Kostenloses Kennenlerngespräch');
      expect(result.html).toContain('Schnelle Terminvergabe');
      expect(result.html).toContain('Annas Profil ansehen');
      expect(result.html).toContain('Andere Vorschläge ansehen');
      expect(result.html).toContain('Passt nicht zu mir');
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
      expect(result.subject).toBe('Anna M. — deine persönliche Empfehlung');
    });
  });

  describe('Selection Nudge Email (Day 5)', () => {
    it('renders with reassurance content', () => {
      const result = renderSelectionNudgeEmail({
        patientName: 'Max',
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
      });

      expect(result.subject).toBe('Noch unsicher? So findest du die richtige Person');
      expect(result.html).toContain('Hallo Max');
      expect(result.html).toContain('kostenlose Kennenlerngespräch');
      expect(result.html).toContain('„Chemie"');
      expect(result.html).toContain('jederzeit wechseln');
      expect(result.html).toContain('Meine Vorschläge ansehen');
      expect(result.html).toContain('Schreib uns');
    });

    it('includes tracking parameters', () => {
      const result = renderSelectionNudgeEmail({
        matchesUrl: 'https://www.kaufmann-health.de/matches/secure-uuid',
      });

      expect(result.html).toContain('utm_campaign=selection_nudge_d5');
    });
  });

  describe('Feedback Request Email (Day 10)', () => {
    it('renders with one-click feedback options', () => {
      const result = renderFeedbackRequestEmail({
        patientName: 'Max',
        patientId: 'p-123',
      });

      expect(result.subject).toBe('Kurze Frage: Was hält dich zurück?');
      expect(result.html).toContain('Hallo Max');
      expect(result.html).toContain('Preis ist zu hoch');
      expect(result.html).toContain('Unsicher, welche:r Therapeut:in passt');
      expect(result.html).toContain('Brauche mehr Zeit');
      expect(result.html).toContain('Habe andere Lösung gefunden');
      expect(result.html).toContain('Etwas anderes');
    });

    it('includes interview CTA with voucher offer', () => {
      const result = renderFeedbackRequestEmail({
        patientId: 'p-123',
      });

      expect(result.html).toContain('15 Minuten');
      expect(result.html).toContain('25€ Amazon-Gutschein');
      expect(result.html).toContain('Termin vereinbaren');
    });

    it('links feedback options to quick survey page', () => {
      const result = renderFeedbackRequestEmail({
        patientId: 'p-123',
      });

      expect(result.html).toContain('/feedback/quick?patient=p-123');
      expect(result.html).toContain('reason=price_too_high');
      expect(result.html).toContain('reason=unsure_which_therapist');
      expect(result.html).toContain('reason=need_more_time');
      expect(result.html).toContain('reason=found_alternative');
      expect(result.html).toContain('reason=other');
    });

    it('includes tracking parameters', () => {
      const result = renderFeedbackRequestEmail({
        patientId: 'p-123',
      });

      expect(result.html).toContain('utm_campaign=feedback_request_d10');
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
      const feedback = renderFeedbackRequestEmail({ patientId: 'p-123' });

      for (const result of [rich, nudge, feedback]) {
        expect(result.html).toContain('color-scheme" content="light only"');
        expect(result.html).toContain('!important');
      }
    });
  });
});
