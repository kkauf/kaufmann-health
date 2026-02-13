/**
 * Generate an .ics (iCalendar) file content for a booking.
 * Returns a UTF-8 string ready to be base64-encoded for email attachment.
 */

interface IcsParams {
  uid: string;           // Unique ID (cal_uid)
  startTimeIso: string;  // ISO 8601 UTC
  endTimeIso: string;    // ISO 8601 UTC
  summary: string;       // e.g. "Therapiesitzung mit Sandra Müller"
  description?: string;
  location?: string;     // Video URL or physical address
  organizerName: string;
  organizerEmail: string;
  attendeeName?: string;
  attendeeEmail: string;
}

function toIcsDate(iso: string): string {
  // Convert "2026-02-17T16:00:00Z" → "20260217T160000Z"
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function generateIcs(params: IcsParams): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kaufmann Health//Booking//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${params.uid}@kaufmann-health.de`,
    `DTSTART:${toIcsDate(params.startTimeIso)}`,
    `DTEND:${toIcsDate(params.endTimeIso)}`,
    `SUMMARY:${escIcs(params.summary)}`,
  ];

  if (params.description) {
    lines.push(`DESCRIPTION:${escIcs(params.description)}`);
  }

  if (params.location) {
    lines.push(`LOCATION:${escIcs(params.location)}`);
  }

  lines.push(`ORGANIZER;CN=${escIcs(params.organizerName)}:mailto:${params.organizerEmail}`);

  if (params.attendeeName) {
    lines.push(`ATTENDEE;CN=${escIcs(params.attendeeName)};RSVP=TRUE:mailto:${params.attendeeEmail}`);
  } else {
    lines.push(`ATTENDEE;RSVP=TRUE:mailto:${params.attendeeEmail}`);
  }

  lines.push('STATUS:CONFIRMED');
  lines.push(`DTSTAMP:${toIcsDate(new Date().toISOString())}`);
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}
