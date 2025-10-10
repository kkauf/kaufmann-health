import { renderLayout } from '../layout';
import type { EmailContent } from '../types';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderPatientMatchFound(params: {
  patientName?: string | null;
  therapistName?: string | null;
  specializations?: string[] | null;
}): EmailContent {
  const patient = (params.patientName || '').trim();
  const therapist = (params.therapistName || '').trim();
  const specs = Array.isArray(params.specializations) ? params.specializations.filter(Boolean) : [];

  const lines: string[] = [];
  lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Dein:e Therapeut:in wird sich melden</h1>');
  lines.push(`<p style=\"margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;\">Hallo${patient ? ` ${escapeHtml(patient)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">gute Neuigkeiten! Deine Therapeut:in hat deine Anfrage angenommen. Ihr werden nun euren ersten gemeinsamen Termin vereinbaren.</p>');

  lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; background-image: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin: 20px 0; box-shadow: 0 2px 8px 0 rgba(16, 185, 129, 0.15);">');
  lines.push(`<p style=\"margin:0 0 8px; font-weight:700; color:#064e3b !important; font-size:18px;\">${therapist ? escapeHtml(therapist) : 'Dein:e Therapeut:in'}</p>`);
  if (specs.length > 0) {
    lines.push(`<p style=\"margin:0; color:#065f46 !important; font-size:15px; line-height:1.65;\">Spezialisierung: ${escapeHtml(specs.join(', '))}</p>`);
  }
  lines.push('</div>');

  lines.push('<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Der/die Therapeut:in wird dich in der Regel innerhalb von 24&nbsp;Stunden kontaktieren. Falls du in dieser Zeit nichts hörst, antworte gerne auf diese E‑Mail, dann kümmern wir uns sofort darum.</p>');

  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">');
  lines.push('<p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Du kannst jederzeit auf diese Nachricht antworten, falls du Ergänzungen oder Fragen hast.</p>');
  lines.push('</div>');

  const html = renderLayout({
    title: 'Update zu deiner Suche',
    contentHtml: lines.join(''),
  });

  return {
    subject: `Dein:e Therapeut:in wird sich melden${therapist ? ` - ${therapist}` : ''}`,
    html,
  };
}

/**
 * EARTH-205: Rejection email when therapist declines patient-initiated contact
 */
export function renderTherapistRejection(params: {
  patientName?: string | null;
  therapistName?: string | null;
}): EmailContent {
  const patient = (params.patientName || '').trim();
  const therapist = (params.therapistName || '').trim();
  const firstName = patient ? patient.split(' ')[0] : '';

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://kaufmann.health';
  const directoryUrl = `${baseUrl}/therapeuten`;

  const lines: string[] = [];
  lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Update zu Ihrer Anfrage</h1>');
  lines.push(`<p style=\"margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;\">Guten Tag${firstName ? ` ${escapeHtml(firstName)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">vielen Dank für Ihr Interesse. Leider kann ich aktuell keine neuen Klienten aufnehmen.</p>');
  lines.push('<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">Über Kaufmann Health finden Sie andere qualifizierte Therapeut:innen:</p>');

  lines.push('<div style="margin:24px 0; text-align:center;">');
  lines.push(`<a href="${directoryUrl}" style="display:inline-block; padding:14px 28px; background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; background-image: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; color:#ffffff !important; text-decoration:none; border-radius:8px; font-weight:700; font-size:16px; box-shadow: 0 4px 12px 0 rgba(16, 185, 129, 0.2);">Therapeuten-Verzeichnis ansehen</a>`);
  lines.push('</div>');

  lines.push(`<p style=\"margin:24px 0 0; font-size:16px; line-height:1.65; color:#475569 !important;\">Alles Gute für Sie${therapist ? `,<br/><strong style=\"color:#0f172a !important;\">${escapeHtml(therapist)}</strong>` : ''}</p>`);

  const html = renderLayout({
    title: 'Update zu Ihrer Anfrage',
    contentHtml: lines.join(''),
  });

  return {
    subject: therapist ? `Ihre Anfrage bei ${therapist}` : 'Update zu Ihrer Anfrage',
    html,
  };
}

export function renderPatientCustomUpdate(params: {
  patientName?: string | null;
  message?: string | null;
}): EmailContent {
  const patient = (params.patientName || '').trim();
  const message = (params.message || '').trim();
  const safeMessage = escapeHtml(message).replaceAll('\n', '<br/>');

  const contentHtml = `
    <h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Update zu deiner Therapeut:innensuche</h1>
    <p style=\"margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;\">Hallo${patient ? ` ${escapeHtml(patient)}` : ''},</p>
    <p style=\"margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;\">${safeMessage || 'kurzes Update von uns.'}</p>
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">
      <p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Bei Fragen antworte gerne auf diese E‑Mail.</p>
    </div>
  `;

  return {
    subject: 'Update zu deiner Therapeut:innensuche',
    html: renderLayout({ title: 'Update', contentHtml }),
  };
}
