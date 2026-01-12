import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

function esc(s: string) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export type CalIntroFollowupParams = {
  patientName?: string | null;
  therapistName: string;
  fullSessionUrl?: string | null;
  // Next available slot from cache
  nextSlotDateIso?: string | null; // YYYY-MM-DD
  nextSlotTimeLabel?: string | null; // HH:MM
  // Link to browse other therapists
  browseTherapistsUrl?: string | null;
  // Match UUID for personalized matches link
  matchUuid?: string | null;
};

function formatDate(d: string): string {
  try {
    const [y, m, day] = d.split('-');
    const weekdays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    const date = new Date(`${y}-${m}-${day}T12:00:00Z`);
    const weekday = weekdays[date.getUTCDay()];
    const month = months[parseInt(m, 10) - 1];
    return `${weekday}, ${parseInt(day, 10)}. ${month}`;
  } catch {
    return d;
  }
}

export function renderCalIntroFollowup(params: CalIntroFollowupParams): EmailContent {
  const name = (params.patientName || '').trim();
  const therapist = esc(params.therapistName);
  const hasNextSlot = params.nextSlotDateIso && params.nextSlotTimeLabel;

  const lines: string[] = [];
  lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Wie war Ihr Kennenlerngespräch?</h1>');
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${esc(name)}` : ''},</p>`);
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Sie hatten gerade ein Kennenlerngespräch mit <strong>${therapist}</strong>. Wir hoffen, es war ein guter erster Kontakt!</p>`);

  // Book follow-up section with next available slot
  lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin: 16px 0;">');
  lines.push('<p style="margin:0 0 12px; font-size:16px; line-height:1.65; color:#064e3b !important;"><strong>Möchten Sie eine Therapiesitzung buchen?</strong></p>');
  
  if (hasNextSlot) {
    const formattedDate = formatDate(params.nextSlotDateIso!);
    lines.push(`<p style="margin:0 0 8px; font-size:15px; line-height:1.65; color:#065f46 !important;">Nächster freier Termin bei ${therapist}:</p>`);
    lines.push(`<p style="margin:0; font-size:17px; font-weight:600; color:#047857 !important;">📅 ${esc(formattedDate)} um ${esc(params.nextSlotTimeLabel!)} Uhr</p>`);
  } else {
    lines.push(`<p style="margin:0; font-size:15px; line-height:1.65; color:#065f46 !important;">Wenn ${therapist} gut zu Ihnen passt, können Sie direkt eine Therapiesitzung buchen.</p>`);
  }
  lines.push('</div>');

  if (params.fullSessionUrl) {
    lines.push('<div style="margin:24px 0; text-align:center;">');
    lines.push(renderButton(params.fullSessionUrl, hasNextSlot ? 'Jetzt Termin buchen' : 'Folgetermin buchen'));
    lines.push('</div>');
  }

  // "Not the right fit" section with browse option
  const matchesUrl = params.matchUuid 
    ? `https://www.kaufmann-health.de/matches/${params.matchUuid}?utm_source=email&utm_medium=transactional&utm_campaign=intro_followup`
    : params.browseTherapistsUrl || 'https://www.kaufmann-health.de/therapeuten?utm_source=email&utm_medium=transactional&utm_campaign=intro_followup';
  
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226,232,240,0.8); margin-top:20px;">');
  lines.push('<p style="margin:0 0 8px; color:#475569 !important; font-size:14px; line-height:1.6;"><strong>Noch nicht die richtige Verbindung?</strong></p>');
  lines.push('<p style="margin:0 0 12px; color:#64748b !important; font-size:14px; line-height:1.6;">Das ist völlig in Ordnung – die Chemie muss stimmen. Sie können sich gerne andere Therapeut:innen anschauen oder uns kontaktieren.</p>');
  lines.push(`<a href="${matchesUrl}" style="color:#059669 !important; font-size:14px; font-weight:500; text-decoration:underline;">→ Andere Therapeut:innen ansehen</a>`);
  lines.push('</div>');

  // Contact note
  lines.push('<p style="margin:20px 0 0; font-size:14px; color:#64748b !important;">Bei Fragen antworten Sie einfach auf diese E-Mail.</p>');

  const subject = `Wie war Ihr Kennenlerngespräch mit ${params.therapistName}?`;
  const html = renderLayout({
    title: 'Wie war Ihr Kennenlerngespräch?',
    contentHtml: lines.join(''),
    preheader: hasNextSlot 
      ? `Nächster Termin: ${formatDate(params.nextSlotDateIso!)} ${params.nextSlotTimeLabel} Uhr` 
      : 'Möchten Sie einen Folgetermin buchen?',
  });

  return { subject, html };
}
