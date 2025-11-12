import { describe, it, expect } from 'vitest';

import { renderBookingClientConfirmation } from '@/lib/email/templates/bookingClientConfirmation';
import { renderBookingTherapistNotification } from '@/lib/email/templates/bookingTherapistNotification';

describe('booking email templates', () => {
  it('renders client confirmation with date/time/format and optional address', () => {
    const contentOnline = renderBookingClientConfirmation({
      therapistName: 'Max Mustermann',
      dateIso: '2025-11-20',
      timeLabel: '14:00',
      format: 'online',
    });
    expect(contentOnline.subject).toContain('Termin bestätigt');
    expect(contentOnline.html).toContain('Buchung bestätigt');
    expect(contentOnline.html).toContain('14:00');
    expect(contentOnline.html).toContain('Online');

    const contentInPerson = renderBookingClientConfirmation({
      therapistName: 'Max Mustermann',
      dateIso: '2025-11-21',
      timeLabel: '10:00',
      format: 'in_person',
      address: 'Teststraße 1, 10115 Berlin',
    });
    expect(contentInPerson.subject).toContain('Termin bestätigt');
    expect(contentInPerson.html).toContain('Vor Ort');
    expect(contentInPerson.html).toContain('Teststraße 1');
  });

  it('renders therapist notification with date/time/format, optional address, and magic link', () => {
    const content = renderBookingTherapistNotification({
      therapistName: 'Max Mustermann',
      dateIso: '2025-11-22',
      timeLabel: '09:00',
      format: 'in_person',
      address: 'Testallee 5, 10117 Berlin',
      magicUrl: 'https://example.com/booking/abc',
    });
    expect(content.subject).toContain('Neue Buchung');
    expect(content.html).toContain('Neue Buchung');
    expect(content.html).toContain('09:00');
    expect(content.html).toContain('Vor Ort');
    expect(content.html).toContain('Testallee 5');
    expect(content.html).toContain('Buchungsdetails ansehen');
  });
});
