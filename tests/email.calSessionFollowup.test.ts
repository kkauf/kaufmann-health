import { describe, it, expect } from 'vitest';
import { renderCalSessionFollowup } from '@/lib/email/templates/calSessionFollowup';

describe('calSessionFollowup email template', () => {
  it('renders with patient name and therapist name', () => {
    const result = renderCalSessionFollowup({
      patientName: 'Anna',
      therapistName: 'Dr. Schmidt',
      fullSessionUrl: 'https://cal.kaufmann.health/dr-schmidt/full-session',
    });

    expect(result.subject).toBe('Für deine nächste Sitzung mit Dr. Schmidt');
    expect(result.html).toContain('Hallo Anna');
    expect(result.html).toContain('Dr. Schmidt');
    expect(result.html).toContain('Nächsten Termin buchen');
    expect(result.html).toContain('https://cal.kaufmann.health/dr-schmidt/full-session');
  });

  it('renders without patient name', () => {
    const result = renderCalSessionFollowup({
      therapistName: 'Dr. Müller',
      fullSessionUrl: 'https://cal.kaufmann.health/dr-mueller/full-session',
    });

    expect(result.html).toContain('Hallo,');
    expect(result.html).not.toContain('Hallo Anna');
  });

  it('renders with next available slot', () => {
    const result = renderCalSessionFollowup({
      patientName: 'Max',
      therapistName: 'Dr. Weber',
      fullSessionUrl: 'https://cal.kaufmann.health/dr-weber/full-session',
      nextSlotDateIso: '2026-01-25',
      nextSlotTimeLabel: '10:00',
    });

    expect(result.html).toContain('Sonntag, 25. Januar');
    expect(result.html).toContain('10:00 Uhr');
    // Preheader is rendered in HTML hidden span
    expect(result.html).toContain('Nächster freier Termin:');
  });

  it('renders without next slot showing generic message', () => {
    const result = renderCalSessionFollowup({
      therapistName: 'Dr. Fischer',
      fullSessionUrl: 'https://cal.kaufmann.health/dr-fischer/full-session',
    });

    expect(result.html).toContain('Regelmäßige Sitzungen können deinen Fortschritt unterstützen');
    expect(result.html).not.toContain('Nächster freier Termin');
  });

  it('includes pause message', () => {
    const result = renderCalSessionFollowup({
      therapistName: 'Dr. Klein',
      fullSessionUrl: 'https://cal.kaufmann.health/dr-klein/full-session',
    });

    expect(result.html).toContain('Pause einlegen?');
    expect(result.html).toContain('du entscheidest über dein Tempo');
  });

  it('escapes HTML in patient and therapist names', () => {
    const result = renderCalSessionFollowup({
      patientName: '<script>alert("xss")</script>',
      therapistName: 'Dr. <b>Bold</b>',
      fullSessionUrl: 'https://example.com',
    });

    expect(result.html).not.toContain('<script>');
    expect(result.html).not.toContain('<b>Bold</b>');
    expect(result.html).toContain('&lt;script&gt;');
  });

  it('renders contact support message', () => {
    const result = renderCalSessionFollowup({
      therapistName: 'Dr. Meyer',
      fullSessionUrl: 'https://example.com',
    });

    expect(result.html).toContain('Bei Fragen antworte einfach auf diese E-Mail');
  });
});
