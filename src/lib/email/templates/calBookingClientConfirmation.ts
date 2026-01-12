import { renderLayout } from '../layout';
import type { EmailContent } from '../types';
import { formatEmailPrice } from '@/lib/pricing';

function esc(s: string) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(d: string): string {
  try {
    const [y, m, day] = d.split('-');
    return `${day}.${m}.${y}`;
  } catch {
    return d;
  }
}

export type CalBookingClientConfirmationParams = {
  patientName?: string | null;
  therapistName: string;
  dateIso: string;
  timeLabel: string; // HH:MM
  isIntro: boolean; // true for free intro sessions
  sessionPrice?: number | null; // typical session price for context
};

/**
 * Cal.com booking confirmation email for clients.
 * 
 * Key differences from old KH booking confirmation:
 * - Clearly states if it's a FREE intro session
 * - Explains Cal.com sends the calendar invite with video link
 * - Shows future session pricing for context (not the current booking price)
 */
export function renderCalBookingClientConfirmation(params: CalBookingClientConfirmationParams): EmailContent {
  const name = (params.patientName || '').trim();
  const therapist = esc(params.therapistName);
  const date = formatDate(params.dateIso);
  const time = params.timeLabel;
  const isIntro = params.isIntro;

  const lines: string[] = [];
  
  // Header
  const headline = isIntro ? 'Dein kostenloses Kennenlernen ist gebucht!' : 'Deine Buchung ist bestätigt';
  lines.push(`<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">${headline}</h1>`);
  
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${esc(name)}` : ''},</p>`);
  
  if (isIntro) {
    lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Vielen Dank für deine Buchung! Dein <strong>kostenloses 15-minütiges Kennenlerngespräch</strong> mit <strong>${therapist}</strong> ist bestätigt.</p>`);
  } else {
    lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Vielen Dank für deine Buchung bei <strong>${therapist}</strong>.</p>`);
  }

  // Booking details
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226,232,240,0.8); margin: 16px 0;">');
  lines.push('<ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:1.65; color:#334155 !important;">');
  lines.push(`<li><strong>Datum:</strong> ${esc(date)}</li>`);
  lines.push(`<li><strong>Uhrzeit:</strong> ${esc(time)} Uhr</li>`);
  lines.push(`<li><strong>Format:</strong> Online-Videogespräch</li>`);
  if (isIntro) {
    lines.push('<li><strong>Dauer:</strong> ca. 15 Minuten</li>');
    lines.push('<li><strong>Preis:</strong> Kostenlos</li>');
  }
  lines.push('</ul>');
  lines.push('</div>');

  // Video link info
  lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin-top:16px;">');
  lines.push('<p style="margin:0; color:#064e3b !important; font-size:14px; line-height:1.6;"><strong>📹 Video-Link:</strong> Du erhältst in Kürze eine separate Kalendereinladung mit dem Zugangslink für das Videogespräch. Prüfe auch deinen Spam-Ordner.</p>');
  lines.push('</div>');

  // Future session pricing context (only for intro sessions)
  if (isIntro && params.sessionPrice) {
    lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226,232,240,0.8); margin-top:16px;">');
    lines.push('<p style="margin:0 0 8px; color:#475569 !important; font-size:14px; line-height:1.6;"><strong>Gut zu wissen:</strong></p>');
    lines.push(`<p style="margin:0; color:#64748b !important; font-size:14px; line-height:1.6;">Falls du nach dem Kennenlernen weitere Sitzungen buchen möchtest: Die regulären Sitzungspreise bei ${therapist} liegen bei ${esc(formatEmailPrice(params.sessionPrice))}.</p>`);
    lines.push('</div>');
  }

  // Footer note
  lines.push('<p style="margin:16px 0 0; font-size:14px; color:#64748b !important;">Bei Fragen antworte einfach auf diese E-Mail.</p>');

  const subject = isIntro 
    ? `Kostenloses Kennenlernen bestätigt: ${date}, ${time} Uhr mit ${params.therapistName}`
    : `Termin bestätigt: ${date}, ${time} Uhr mit ${params.therapistName}`;
  
  const html = renderLayout({
    title: headline,
    contentHtml: lines.join(''),
    preheader: isIntro ? 'Dein kostenloses Kennenlerngespräch ist bestätigt' : 'Dein Termin ist bestätigt',
  });

  return { subject, html };
}
