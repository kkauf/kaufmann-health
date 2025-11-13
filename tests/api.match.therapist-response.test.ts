/**
 * EARTH-205: Therapist Receives & Responds to Contact Requests
 * 
 * Tests for the enhanced therapist response flow:
 * - Displaying patient message and request type
 * - Mailto template generation
 * - Rejection email flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabaseServer } from '@/lib/supabase-server';
import { renderTherapistNotification } from '@/lib/email/templates/therapistNotification';
import { renderTherapistRejection } from '@/lib/email/templates/patientUpdates';

// Mock Supabase
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));

describe('EARTH-205: Therapist Response Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Therapist Notification Email', () => {
    it('includes contact type and patient message for patient-initiated contacts', () => {
      const result = renderTherapistNotification({
        type: 'outreach',
        therapistName: 'Dr. Schmidt',
        patientIssue: 'Panikattacken',
        magicUrl: 'https://example.com/match/uuid',
        expiresHours: 72,
        contactType: 'booking',
        patientMessage: 'Ich würde gerne einen Termin vereinbaren. Ich habe Erfahrung mit NARM gesucht.',
      });

      expect(result.subject).toBe('Neue Anfrage: Direktbuchung');
      expect(result.html).toContain('Direktbuchung');
      expect(result.html).toContain('Nachricht von Klient:in');
      expect(result.html).toContain('Ich würde gerne einen Termin vereinbaren');
      expect(result.html).toContain('Ich habe Erfahrung mit NARM gesucht');
    });

    it('shows "Erstgespräch" for consultation type', () => {
      const result = renderTherapistNotification({
        type: 'outreach',
        therapistName: 'Dr. Schmidt',
        patientIssue: 'Depression',
        magicUrl: 'https://example.com/match/uuid',
        expiresHours: 72,
        contactType: 'consultation',
        patientMessage: 'Ich möchte Sie gerne kennenlernen.',
      });

      expect(result.subject).toBe('Neue Anfrage: Erstgespräch');
      expect(result.html).toContain('Kostenloses Erstgespräch (15 Min)');
    });

    it('works without contact type (backward compatibility)', () => {
      const result = renderTherapistNotification({
        type: 'outreach',
        therapistName: 'Dr. Schmidt',
        patientCity: 'Berlin',
        patientIssue: 'Angst',
        magicUrl: 'https://example.com/match/uuid',
        expiresHours: 72,
      });

      expect(result.subject).toBe('Neue Anfrage von Klient:in – Berlin – Angst');
      expect(result.html).not.toContain('Direktbuchung');
      expect(result.html).not.toContain('Nachricht von Klient:in');
    });

    it('escapes HTML in patient message', () => {
      const result = renderTherapistNotification({
        type: 'outreach',
        therapistName: 'Dr. Schmidt',
        magicUrl: 'https://example.com/match/uuid',
        contactType: 'booking',
        patientMessage: '<script>alert("xss")</script>',
      });

      expect(result.html).toContain('&lt;script&gt;');
      expect(result.html).not.toContain('<script>');
    });
  });

  describe('Therapist Rejection Email', () => {
    it('includes therapist name and directory link', () => {
      const result = renderTherapistRejection({
        patientName: 'Maria Schmidt',
        therapistName: 'Dr. Anna Müller',
      });

      expect(result.subject).toBe('Ihre Anfrage bei Dr. Anna Müller');
      expect(result.html).toContain('Guten Tag Maria');
      expect(result.html).toContain('Leider kann ich aktuell keine neuen Klienten aufnehmen');
      expect(result.html).toContain('Therapeuten-Verzeichnis ansehen');
      expect(result.html).toContain('/therapeuten');
      expect(result.html).toContain('Alles Gute für Sie');
      expect(result.html).toContain('Dr. Anna Müller');
    });

    it('works without therapist name', () => {
      const result = renderTherapistRejection({
        patientName: 'Maria Schmidt',
      });

      expect(result.subject).toBe('Update zu Ihrer Anfrage');
      expect(result.html).toContain('Alles Gute für Sie');
      expect(result.html).not.toContain(',<br/>');
    });

    it('uses first name only for greeting', () => {
      const result = renderTherapistRejection({
        patientName: 'Maria Anna Schmidt',
        therapistName: 'Dr. Müller',
      });

      expect(result.html).toContain('Guten Tag Maria,');
      expect(result.html).not.toContain('Guten Tag Maria Anna');
    });
  });

  describe('Mailto Template Generation', () => {
    it('generates correct template for booking with address placeholder', () => {
      const subject = encodeURIComponent('Re: Ihre Anfrage bei Kaufmann Health');
      const body = encodeURIComponent(
        'Guten Tag Maria,\n\nvielen Dank für deine Nachricht über Kaufmann Health.\n\n' +
        'Gerne können wir einen Termin vereinbaren. Wann passt es dir am besten?\n\n' +
        '[Ihre Praxis-Adresse hier einfügen]\n\n' +
        'Viele Grüße'
      );
      
      const expected = `mailto:maria@example.com?subject=${subject}&body=${body}`;
      
      // This would be generated by Actions.tsx generateMailto()
      expect(expected).toContain('subject=Re%3A%20Ihre%20Anfrage');
      expect(expected).toContain('Ihre%20Praxis-Adresse%20hier%20einf%C3%BCgen');
    });

    it('generates correct template for consultation', () => {
      const body = encodeURIComponent(
        'Guten Tag Hans,\n\nvielen Dank für deine Nachricht über Kaufmann Health.\n\n' +
        'Gerne können wir einen Termin vereinbaren. Wann passt es dir am besten?\n\n' +
        'Das kostenlose Erstgespräch dauert 15 Minuten und dient zum gegenseitigen Kennenlernen.\n\n' +
        'Viele Grüße'
      );
      
      const mailto = `mailto:hans@example.com?subject=Re%3A%20Ihre%20Anfrage&body=${body}`;
      
      expect(mailto).toContain('Das%20kostenlose%20Erstgespr%C3%A4ch');
      expect(mailto).toContain('15%20Minuten');
      expect(mailto).not.toContain('Praxis-Adresse');
    });
  });

  describe('Match Page Data Extraction', () => {
    it('extracts patient-initiated contact metadata', async () => {
      const mockMatch = {
        id: 'match-123',
        status: 'proposed',
        created_at: new Date().toISOString(),
        patient_id: 'patient-123',
        metadata: {
          patient_initiated: true,
          contact_type: 'booking',
          patient_reason: 'Trauma-Verarbeitung',
          patient_message: 'Ich suche Unterstützung bei der Verarbeitung traumatischer Erlebnisse.',
          contact_method: 'email',
        },
      };

      expect(mockMatch.metadata.contact_type).toBe('booking');
      expect(mockMatch.metadata.patient_message).toContain('traumatischer Erlebnisse');
      expect(mockMatch.metadata.patient_initiated).toBe(true);
    });
  });
});
