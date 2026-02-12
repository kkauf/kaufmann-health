import { renderLayout } from '../layout';
import type { EmailContent } from '../types';

function getCalOrigin() {
  return process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';
}

function esc(s: string) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export type CalBookingReminderParams = {
  patientName?: string | null;
  therapistName: string;
  dateStr: string;
  timeStr: string;
  isOnline: boolean;
  hoursUntil: number;
  videoUrl?: string | null;
  bookingUid?: string | null;
  patientEmail?: string | null;
  bookingKind?: string | null;
};

export function renderCalBookingReminder(params: CalBookingReminderParams): EmailContent {
  const name = (params.patientName || '').trim();
  const therapist = esc(params.therapistName);
  const is24h = params.hoursUntil >= 20;

  const lines: string[] = [];
  
  const headline = is24h ? 'Erinnerung: Dein Termin morgen' : 'Gleich geht\'s los!';
  lines.push(`<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">${headline}</h1>`);
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${esc(name)}` : ''},</p>`);

  if (is24h) {
    lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Morgen ist es soweit – dein Termin mit <strong>${therapist}</strong> steht an.</p>`);
  } else {
    lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">In wenigen Minuten beginnt dein Termin mit <strong>${therapist}</strong>.</p>`);
  }

  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226,232,240,0.8); margin: 16px 0;">');
  lines.push('<ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:1.65; color:#334155 !important;">');
  lines.push(`<li><strong>Datum:</strong> ${esc(params.dateStr)}</li>`);
  lines.push(`<li><strong>Uhrzeit:</strong> ${esc(params.timeStr)} Uhr</li>`);
  lines.push(`<li><strong>Format:</strong> ${params.isOnline ? 'Online-Termin' : 'Vor-Ort-Termin'}</li>`);
  lines.push('</ul>');
  lines.push('</div>');

  if (params.isOnline) {
    if (params.videoUrl) {
      lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin-top:16px;">');
      lines.push(`<p style="margin:0 0 8px; color:#064e3b !important; font-size:14px; line-height:1.6;"><strong>📹 Cal Video</strong></p>`);
      lines.push(`<a href="${esc(params.videoUrl)}" style="color:#059669 !important; font-size:14px; word-break:break-all;">${esc(params.videoUrl)}</a>`);
      lines.push('</div>');
    } else {
      lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin-top:16px;">');
      lines.push('<p style="margin:0; color:#064e3b !important; font-size:14px; line-height:1.6;"><strong>💻 Online-Termin:</strong> Den Zugangslink erhältst du von deiner Therapeut:in direkt oder in der Terminbestätigung.</p>');
      lines.push('</div>');
    }
  }

  // Reschedule/Cancel links
  if (params.bookingUid && params.patientEmail) {
    const calOrigin = getCalOrigin();
    const rescheduleUrl = `${calOrigin}/reschedule/${params.bookingUid}?rescheduledBy=${encodeURIComponent(params.patientEmail)}`;
    const cancelUrl = `${calOrigin}/booking/${params.bookingUid}?cancel=true&cancelledBy=${encodeURIComponent(params.patientEmail)}`;

    lines.push('<div style="border-top:1px solid #e2e8f0; padding-top:20px; margin-top:16px;">');
    lines.push('<p style="margin:0 0 12px; font-size:14px; color:#64748b !important;"><strong>Änderungen?</strong></p>');
    lines.push('<p style="margin:0;">');
    lines.push(`<a href="${esc(rescheduleUrl)}" style="color:#0ea5e9 !important; font-size:14px; text-decoration:underline; margin-right:16px;">Neuplanen</a>`);
    lines.push(`<a href="${esc(cancelUrl)}" style="color:#ef4444 !important; font-size:14px; text-decoration:underline;">Stornieren</a>`);
    lines.push('</p>');
    lines.push('</div>');
  } else {
    lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226,232,240,0.8); margin-top:16px;">');
    lines.push('<p style="margin:0; color:#64748b !important; font-size:14px; line-height:1.6;">Bei Fragen oder falls du absagen musst, antworte einfach auf diese E-Mail.</p>');
    lines.push('</div>');
  }

  const subject = is24h
    ? `Erinnerung: Morgen ${params.timeStr} Uhr – Termin mit ${params.therapistName}`
    : `In 1 Stunde: Termin mit ${params.therapistName}`;

  const html = renderLayout({
    title: headline,
    contentHtml: lines.join(''),
    preheader: is24h ? 'Dein Termin ist morgen' : 'Dein Termin beginnt gleich',
  });

  return { subject, html };
}
