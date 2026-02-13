/**
 * Tests for Cal.com booking email templates
 * 
 * These are critical emails sent after Cal.com bookings:
 * - Client confirmation (intro and full session)
 * - Therapist notification
 * - Booking reminder
 * - Intro followup
 */

import { describe, it, expect } from 'vitest';
import { renderCalBookingClientConfirmation } from '@/lib/email/templates/calBookingClientConfirmation';
import { renderCalBookingTherapistNotification } from '@/lib/email/templates/calBookingTherapistNotification';

describe('Cal.com Booking Email Templates', () => {
  describe('Client Confirmation Email', () => {
    const baseParams = {
      patientName: 'Max Mustermann',
      patientEmail: 'max@example.com',
      therapistName: 'Dr. Sandra Therapist',
      therapistEmail: 'sandra@example.com',
      dateIso: '2025-01-20',
      timeLabel: '10:00',
      isIntro: true,
      sessionPrice: 120,
      bookingUid: 'booking-uid-123',
      videoUrl: 'https://cal.kaufmann.health/video/abc123',
      locationType: 'video' as const,
    };

    it('renders intro session confirmation with correct subject', () => {
      const result = renderCalBookingClientConfirmation(baseParams);
      
      expect(result.subject).toContain('Kennenlernen bestätigt');
      expect(result.subject).toContain('Dr. Sandra Therapist');
      expect(result.subject).toContain('20.01');
      expect(result.subject).toContain('10:00');
    });

    it('renders full session confirmation with different subject', () => {
      const result = renderCalBookingClientConfirmation({
        ...baseParams,
        isIntro: false,
      });
      
      expect(result.subject).toContain('Termin bestätigt');
      expect(result.subject).not.toContain('Kennenlernen');
    });

    it('includes video URL when provided', () => {
      const result = renderCalBookingClientConfirmation(baseParams);
      
      expect(result.html).toContain('cal.kaufmann.health/video/abc123');
      expect(result.html).toContain('Cal Video');
    });

    it('shows fallback message when no video URL', () => {
      const result = renderCalBookingClientConfirmation({
        ...baseParams,
        videoUrl: undefined,
      });
      
      expect(result.html).toContain('Online-Videogespräch');
      expect(result.html).toContain('Der Video-Link findest du in der angehängten Kalendereinladung');
    });

    it('shows in-person location when locationType is in_person', () => {
      const result = renderCalBookingClientConfirmation({
        ...baseParams,
        locationType: 'in_person',
        locationAddress: 'Teststraße 1, 10115 Berlin',
        videoUrl: undefined,
      });
      
      expect(result.html).toContain('Vor Ort');
      expect(result.html).toContain('Teststraße 1, 10115 Berlin');
    });

    it('includes reschedule and cancel links', () => {
      const result = renderCalBookingClientConfirmation(baseParams);
      
      expect(result.html).toContain('reschedule/booking-uid-123');
      expect(result.html).toContain('cancel=true');
      expect(result.html).toContain('Neuplanen');
      expect(result.html).toContain('Stornieren');
    });

    it('shows session price context for intro sessions', () => {
      const result = renderCalBookingClientConfirmation(baseParams);
      
      expect(result.html).toContain('Reguläre Sitzungen');
      expect(result.html).toContain('120');
    });

    it('calculates correct end time for 15 min intro', () => {
      const result = renderCalBookingClientConfirmation({
        ...baseParams,
        isIntro: true,
        timeLabel: '14:30',
      });
      
      // 14:30 + 15 min = 14:45
      expect(result.html).toContain('14:30');
      expect(result.html).toContain('14:45');
    });

    it('calculates correct end time for 50 min session', () => {
      const result = renderCalBookingClientConfirmation({
        ...baseParams,
        isIntro: false,
        timeLabel: '10:00',
      });
      
      // 10:00 + 50 min = 10:50
      expect(result.html).toContain('10:00');
      expect(result.html).toContain('10:50');
    });

    it('handles missing patient name gracefully', () => {
      const result = renderCalBookingClientConfirmation({
        ...baseParams,
        patientName: null,
      });
      
      expect(result.html).toContain('dir');
      expect(result.html).toContain('Gast');
    });

    it('escapes HTML in user-provided content', () => {
      const result = renderCalBookingClientConfirmation({
        ...baseParams,
        patientName: '<script>alert("xss")</script>',
        therapistName: 'Dr. "Evil" <Therapist>',
      });
      
      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;');
      expect(result.html).toContain('&quot;Evil&quot;');
    });
  });

  describe('Therapist Notification Email', () => {
    const baseParams = {
      therapistName: 'Dr. Sandra Therapist',
      patientName: 'Max Mustermann',
      patientEmail: 'max@example.com',
      dateIso: '2025-01-20',
      timeLabel: '10:00',
      isIntro: true,
    };

    it('renders notification with correct subject', () => {
      const result = renderCalBookingTherapistNotification(baseParams);
      
      // Intro sessions use "Neues Kennenlernen" subject
      expect(result.subject).toContain('Kennenlernen');
      expect(result.subject).toContain('20.01.2025');
    });

    it('includes patient contact information', () => {
      const result = renderCalBookingTherapistNotification(baseParams);
      
      expect(result.html).toContain('max@example.com');
    });

    it('shows booking type (intro vs session)', () => {
      const introResult = renderCalBookingTherapistNotification(baseParams);
      expect(introResult.html).toContain('Kennenlernen');
      
      const sessionResult = renderCalBookingTherapistNotification({
        ...baseParams,
        isIntro: false,
      });
      expect(sessionResult.html).toContain('Sitzung');
    });

    it('formats date correctly', () => {
      const result = renderCalBookingTherapistNotification(baseParams);
      
      // Should contain formatted date (DD.MM.YYYY format)
      expect(result.html).toContain('20.01.2025');
    });

    it('handles missing patient email gracefully', () => {
      const result = renderCalBookingTherapistNotification({
        ...baseParams,
        patientEmail: null,
      });
      
      // Should still render
      expect(result.html).toBeTruthy();
      expect(result.subject).toBeTruthy();
    });
  });
});

describe('Email Template Edge Cases', () => {
  it('handles edge case: midnight crossing for end time', () => {
    const result = renderCalBookingClientConfirmation({
      patientName: 'Test',
      therapistName: 'Therapist',
      dateIso: '2025-01-20',
      timeLabel: '23:30',
      isIntro: false, // 50 min session
      locationType: 'video',
    });
    
    // 23:30 + 50 min = 00:20 (next day, but we show 00:20)
    expect(result.html).toContain('23:30');
    expect(result.html).toContain('00:20');
  });

  it('handles empty strings gracefully', () => {
    const result = renderCalBookingClientConfirmation({
      patientName: '',
      therapistName: 'Therapist',
      dateIso: '2025-01-20',
      timeLabel: '10:00',
      isIntro: true,
      locationType: 'video',
    });
    
    expect(result.html).toBeTruthy();
    expect(result.subject).toBeTruthy();
  });
});
