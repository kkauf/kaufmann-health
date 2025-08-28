import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

/**
 * Therapist outreach email with a magic link to review a new patient request.
 * Keep PII minimal. No patient identifiers beyond city/issue category.
 */
export function renderTherapistOutreach(params: {
  therapistName?: string | null;
  city?: string | null;
  issueCategory?: string | null;
  magicUrl: string; // e.g. `${BASE_URL}/match/${secure_uuid}`
  expiresHours?: number; // default 72
}): EmailContent {
  const name = (params.therapistName || '').trim();
  const city = (params.city || '').trim();
  const issue = (params.issueCategory || '').trim();
  const expiresHours = typeof params.expiresHours === 'number' && params.expiresHours > 0 ? params.expiresHours : 72;

  const subjectCity = city || 'unbekannt';
  const subjectIssue = issue || 'Allgemein';
  const subject = `Neue Patientenanfrage – ${subjectCity} – ${subjectIssue}`;

  const detailsHtml = `
    <div style="background-color:#F9FAFB; padding:16px; border-radius:8px; border:1px solid #E5E7EB; margin: 16px 0;">
      <h3 style="margin:0 0 8px; color:#1A365D; font-size:16px;">Anfrage-Details</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px; color:#374151;">
        <tr><td style="padding:4px 8px 4px 0; width:160px; color:#6B7280;">Stadt</td><td style="padding:4px 0;">${escapeHtml(subjectCity)}</td></tr>
        <tr><td style="padding:4px 8px 4px 0; width:160px; color:#6B7280;">Anliegen</td><td style="padding:4px 0;">${escapeHtml(subjectIssue)}</td></tr>
        <tr><td style="padding:4px 8px 4px 0; width:160px; color:#6B7280;">Gültigkeit</td><td style="padding:4px 0;">${expiresHours} Stunden</td></tr>
      </table>
    </div>
  `;

  const contentHtml = `
    <h1 style="color:#1A365D; font-size:22px; margin:0 0 12px;">Neue Patientenanfrage</h1>
    <p style="margin:0 0 12px;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 12px;">Sie wurden für eine neue Patientenanfrage vorgeschlagen. Bitte prüfen Sie die Details und geben Sie Ihre Rückmeldung.</p>
    ${detailsHtml}
    <div style="background-color:#FFFFFF; padding:16px; border-radius:8px; border:1px solid #E5E7EB;">
      <p style="margin:0 0 12px;">Der Link ist aus Sicherheitsgründen nur für ${expiresHours} Stunden gültig.</p>
      <div style="text-align:center;">${renderButton(params.magicUrl, 'Anfrage ansehen')}</div>
    </div>
    <p style="color:#6B7280; font-size:12px; margin-top:16px;">Wenn der Button nicht funktioniert, öffnen Sie folgenden Link:<br/><a href="${params.magicUrl}" style="color:#4A9B8E; text-decoration:none;">${escapeHtml(
      params.magicUrl,
    )}</a></p>
  `;

  return {
    subject,
    html: renderLayout({ title: 'Neue Patientenanfrage', contentHtml }),
  };
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
