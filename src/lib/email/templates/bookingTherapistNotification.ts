import { renderLayout } from '../layout';
import type { EmailContent } from '../types';

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

export type BookingTherapistParams = {
  therapistName?: string | null;
  patientName?: string | null;
  patientEmail?: string | null;
  dateIso: string;
  timeLabel: string; // HH:MM
  format: 'online' | 'in_person';
  address?: string | null;
};

export function renderBookingTherapistNotification(params: BookingTherapistParams): EmailContent {
  const tName = (params.therapistName || '').trim();
  const pName = (params.patientName || '').trim();
  const pEmail = (params.patientEmail || '').trim();
  const date = formatDate(params.dateIso);
  const time = params.timeLabel;
  const isOnline = params.format === 'online';
  const address = (params.address || '').trim();

  const lines: string[] = [];
  lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Neue Buchung</h1>');
  lines.push(`<p style=\"margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;\">Hallo${tName ? ` ${esc(tName)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Ein:e Klient:in hat soeben einen Termin gebucht. Hier die Details:</p>');

  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226,232,240,0.8); margin: 12px 0;">');
  lines.push('<ul style="margin:0; padding:0 0 0 20px; font-size:15px; line-height:1.65; color:#334155 !important;">');
  lines.push(`<li><strong>Datum:</strong> ${esc(date)}</li>`);
  lines.push(`<li><strong>Uhrzeit:</strong> ${esc(time)} Uhr</li>`);
  lines.push(`<li><strong>Format:</strong> ${isOnline ? 'Online' : 'Vor Ort'}</li>`);
  if (!isOnline && address) {
    lines.push(`<li><strong>Adresse:</strong> ${esc(address)}</li>`);
  }
  if (pName) {
    lines.push(`<li><strong>Klient:</strong> ${esc(pName)}</li>`);
  }
  if (pEmail) {
    lines.push(`<li><strong>E‑Mail des Klienten:</strong> ${esc(pEmail)}</li>`);
  }
  lines.push('</ul>');
  lines.push('</div>');

  if (isOnline) {
    lines.push('<p style="margin:8px 0 0; font-size:14px; color:#64748b !important;">Hinweis: Für Online‑Termine wird der Zugangs‑Link separat übermittelt.</p>');
  }

  const title = 'Neue Buchung';
  const subject = `Neue Buchung: ${date}, ${time} – ${isOnline ? 'Online' : 'Vor Ort'}`;
  const html = renderLayout({ title, contentHtml: lines.join('') });
  return { subject, html };
}
