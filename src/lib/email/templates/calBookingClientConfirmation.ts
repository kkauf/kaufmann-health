import { renderLayout } from '../layout';
import type { EmailContent } from '../types';
import { formatEmailPrice } from '@/lib/pricing';

const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';

function esc(s: string) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateGerman(d: string): string {
  try {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const endMinutes = (hours * 60 + minutes + durationMinutes) % (24 * 60);
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
}

export type CalBookingClientConfirmationParams = {
  patientName?: string | null;
  patientEmail?: string | null;
  therapistName: string;
  therapistEmail?: string | null;
  dateIso: string;
  timeLabel: string; // HH:MM
  isIntro: boolean; // true for free intro sessions
  sessionPrice?: number | null; // typical session price for context
  // EARTH-273: New fields for enhanced emails
  bookingUid?: string | null;
  videoUrl?: string | null;
  locationType?: 'video' | 'in_person';
  locationAddress?: string | null;
};

/**
 * Cal.com booking confirmation email for clients.
 * 
 * EARTH-273: Enhanced with video link, reschedule/cancel links, participant info.
 */
export function renderCalBookingClientConfirmation(params: CalBookingClientConfirmationParams): EmailContent {
  const name = (params.patientName || '').trim();
  const therapist = esc(params.therapistName);
  const date = formatDateGerman(params.dateIso);
  const time = params.timeLabel;
  const isIntro = params.isIntro;
  const duration = isIntro ? 15 : 50;
  const endTime = calculateEndTime(time, duration);
  const isVideo = params.locationType !== 'in_person';

  const lines: string[] = [];
  
  // Header with checkmark
  const headline = isIntro ? 'Dein Termin ist gebucht!' : 'Dein Termin ist gebucht!';
  lines.push(`<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 24px; line-height:1.3; letter-spacing:-0.02em;">✓ ${headline}</h1>`);

  // === WAS (What) ===
  lines.push('<div style="margin-bottom:20px;">');
  lines.push('<p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#64748b !important; text-transform:uppercase; letter-spacing:0.05em;">Was</p>');
  lines.push(`<p style="margin:0; font-size:16px; color:#0f172a !important; font-weight:600;">${isIntro ? 'Kostenloses Kennenlerngespräch' : 'Therapiesitzung'} (${duration} Min.)</p>`);
  lines.push(`<p style="margin:4px 0 0; font-size:14px; color:#475569 !important;">zwischen ${therapist} und ${name ? esc(name) : 'dir'}</p>`);
  lines.push('</div>');

  // === WANN (When) ===
  lines.push('<div style="margin-bottom:20px;">');
  lines.push('<p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#64748b !important; text-transform:uppercase; letter-spacing:0.05em;">Wann</p>');
  lines.push(`<p style="margin:0; font-size:16px; color:#0f172a !important; font-weight:600;">${esc(date)}</p>`);
  lines.push(`<p style="margin:4px 0 0; font-size:14px; color:#475569 !important;">${esc(time)} - ${esc(endTime)} Uhr (Europe/Berlin)</p>`);
  lines.push('</div>');

  // === WER (Who) ===
  lines.push('<div style="margin-bottom:20px;">');
  lines.push('<p style="margin:0 0 8px; font-size:12px; font-weight:600; color:#64748b !important; text-transform:uppercase; letter-spacing:0.05em;">Wer</p>');
  lines.push('<table style="border-collapse:collapse; width:100%;">');
  // Therapist
  lines.push('<tr>');
  lines.push(`<td style="padding:8px 0; vertical-align:top;"><span style="font-size:14px; color:#0f172a !important; font-weight:500;">${therapist}</span> <span style="font-size:12px; color:#64748b !important;">– Therapeut:in</span></td>`);
  lines.push('</tr>');
  if (params.therapistEmail) {
    lines.push(`<tr><td style="padding:0 0 8px; font-size:13px; color:#64748b !important;">${esc(params.therapistEmail)}</td></tr>`);
  }
  // Patient
  lines.push('<tr>');
  lines.push(`<td style="padding:8px 0; vertical-align:top;"><span style="font-size:14px; color:#0f172a !important; font-weight:500;">${name ? esc(name) : 'Gast'}</span> <span style="font-size:12px; color:#64748b !important;">– Gast</span></td>`);
  lines.push('</tr>');
  if (params.patientEmail) {
    lines.push(`<tr><td style="padding:0 0 8px; font-size:13px; color:#64748b !important;">${esc(params.patientEmail)}</td></tr>`);
  }
  lines.push('</table>');
  lines.push('</div>');

  // === WO (Where) ===
  lines.push('<div style="margin-bottom:24px;">');
  lines.push('<p style="margin:0 0 8px; font-size:12px; font-weight:600; color:#64748b !important; text-transform:uppercase; letter-spacing:0.05em;">Wo</p>');
  if (isVideo) {
    if (params.videoUrl) {
      lines.push('<div style="background:#ecfdf5 !important; padding:12px 16px; border-radius:8px; border:1px solid rgba(16,185,129,0.3);">');
      lines.push('<p style="margin:0 0 8px; font-size:14px; color:#064e3b !important;"><strong>📹 Cal Video</strong></p>');
      lines.push(`<a href="${esc(params.videoUrl)}" style="color:#059669 !important; font-size:14px; word-break:break-all;">${esc(params.videoUrl)}</a>`);
      lines.push('</div>');
    } else {
      lines.push('<div style="background:#f0f9ff !important; padding:12px 16px; border-radius:8px; border:1px solid rgba(14,165,233,0.3);">');
      lines.push('<p style="margin:0; font-size:14px; color:#0369a1 !important;">📹 Online-Videogespräch</p>');
      lines.push('<p style="margin:8px 0 0; font-size:13px; color:#0c4a6e !important;">Der Video-Link wird dir mit der Kalendereinladung zugesendet.</p>');
      lines.push('</div>');
    }
  } else {
    // In-person
    lines.push('<div style="background:#f8fafc !important; padding:12px 16px; border-radius:8px; border:1px solid rgba(226,232,240,0.8);">');
    lines.push('<p style="margin:0 0 4px; font-size:14px; color:#0f172a !important;"><strong>📍 Vor Ort</strong></p>');
    if (params.locationAddress) {
      lines.push(`<p style="margin:0; font-size:14px; color:#475569 !important;">${esc(params.locationAddress)}</p>`);
    }
    lines.push('</div>');
  }
  lines.push('</div>');

  // === Reschedule/Cancel Links ===
  if (params.bookingUid && params.patientEmail) {
    const rescheduleUrl = `${CAL_ORIGIN}/reschedule/${params.bookingUid}?rescheduledBy=${encodeURIComponent(params.patientEmail)}`;
    const cancelUrl = `${CAL_ORIGIN}/booking/${params.bookingUid}?cancel=true&cancelledBy=${encodeURIComponent(params.patientEmail)}`;
    
    lines.push('<div style="border-top:1px solid #e2e8f0; padding-top:20px; margin-top:8px;">');
    lines.push('<p style="margin:0 0 12px; font-size:14px; color:#64748b !important;"><strong>Änderungen?</strong></p>');
    lines.push('<p style="margin:0;">');
    lines.push(`<a href="${esc(rescheduleUrl)}" style="color:#0ea5e9 !important; font-size:14px; text-decoration:underline; margin-right:16px;">Neuplanen</a>`);
    lines.push(`<a href="${esc(cancelUrl)}" style="color:#ef4444 !important; font-size:14px; text-decoration:underline;">Stornieren</a>`);
    lines.push('</p>');
    lines.push('</div>');
  }

  // === Calendar invite note ===
  lines.push('<div style="margin-top:20px; padding:12px 16px; background:#fefce8 !important; border-radius:8px; border:1px solid rgba(250,204,21,0.4);">');
  lines.push('<p style="margin:0; font-size:13px; color:#854d0e !important;">📅 Eine Kalendereinladung folgt separat per E-Mail.</p>');
  lines.push('</div>');

  // Future session pricing context (only for intro sessions)
  if (isIntro && params.sessionPrice) {
    lines.push('<div style="margin-top:16px; padding:12px 16px; background:#f8fafc !important; border-radius:8px; border:1px solid rgba(226,232,240,0.8);">');
    lines.push('<p style="margin:0 0 4px; color:#475569 !important; font-size:13px;"><strong>Gut zu wissen:</strong></p>');
    lines.push(`<p style="margin:0; color:#64748b !important; font-size:13px;">Reguläre Sitzungen bei ${therapist}: ${esc(formatEmailPrice(params.sessionPrice))}</p>`);
    lines.push('</div>');
  }

  // Footer note
  lines.push('<p style="margin:20px 0 0; font-size:13px; color:#94a3b8 !important;">Bei Fragen antworte einfach auf diese E-Mail.</p>');

  const shortDate = params.dateIso.split('-').reverse().slice(0, 2).join('.');
  const subject = isIntro 
    ? `✓ Kennenlernen bestätigt: ${shortDate}, ${time} Uhr mit ${params.therapistName}`
    : `✓ Termin bestätigt: ${shortDate}, ${time} Uhr mit ${params.therapistName}`;
  
  const html = renderLayout({
    title: headline,
    contentHtml: lines.join(''),
    preheader: isIntro ? 'Dein kostenloses Kennenlerngespräch ist bestätigt' : 'Dein Termin ist bestätigt',
  });

  return { subject, html };
}
