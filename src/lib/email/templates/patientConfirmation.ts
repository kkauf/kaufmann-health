import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';
import { BASE_URL } from '@/lib/constants';

export function renderPatientConfirmation(params: {
  name?: string | null;
  city?: string | null;
  issue?: string | null;
  sessionPreference?: 'online' | 'in_person' | null;
}): EmailContent {
  const name = (params.name || '').trim();
  const city = (params.city || '').trim();
  const issue = (params.issue || '').trim();
  const pref = params.sessionPreference;
  const prefLabel = pref === 'online' ? 'Online' : pref === 'in_person' ? 'Vor Ort' : '—';

  const detailsHtml = `
    <div style="background-color:#F9FAFB; padding:16px; border-radius:8px; border:1px solid #E5E7EB; margin: 16px 0;">
      <h3 style="margin:0 0 8px; color:#1A365D; font-size:16px;">Deine Angaben</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px; color:#374151;">
        <tr><td style="padding:4px 8px 4px 0; width:160px; color:#6B7280;">Stadt</td><td style="padding:4px 0;">${escapeHtml(city || '—')}</td></tr>
        <tr><td style="padding:4px 8px 4px 0; width:160px; color:#6B7280;">Anliegen</td><td style="padding:4px 0;">${escapeHtml(issue || '—')}</td></tr>
        <tr><td style="padding:4px 8px 4px 0; width:160px; color:#6B7280;">Sitzungsart</td><td style="padding:4px 0;">${prefLabel}</td></tr>
      </table>
    </div>
  `;

  const contentHtml = `
    <h1 style="color:#1A365D; font-size:22px; margin:0 0 12px;">Deine Anfrage ist eingegangen</h1>
    <p style="margin:0 0 12px;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 12px;">vielen Dank für deine Anfrage bei Kaufmann Health. Wir haben deine Angaben erhalten und melden uns <strong>innerhalb von 24&nbsp;Stunden</strong> mit den nächsten Schritten.</p>
    ${detailsHtml}
    <div style="background-color:#FFFFFF; padding:16px; border-radius:8px; border:1px solid #E5E7EB;">
      <h3 style="margin:0 0 8px; color:#1A365D; font-size:16px;">Wie geht es weiter?</h3>
      <ol style="margin:0 0 0 18px; padding:0;">
        <li style="margin:0 0 6px;">Wir prüfen deine Anfrage und wählen passende Profile aus unserem kuratierten Netzwerk sorgfältig geprüfter Therapeuten.</li>
        <li style="margin:0 0 6px;">Du erhältst in der Regel innerhalb von 24&nbsp;Stunden eine Rückmeldung per E‑Mail.</li>
        <li style="margin:0;">Bei Rückfragen melden wir uns direkt bei dir. Antworte gerne auf diese E‑Mail.</li>
      </ol>
      <div style="text-align:center; margin-top:12px;">${renderButton(BASE_URL + '/therapie-finden', 'Mehr zur Therapeuten-Empfehlung')}</div>
    </div>
    <p style="color:#6B7280; font-size:12px; margin-top:16px;">Du kannst jederzeit auf diese Nachricht antworten, falls du Ergänzungen oder Fragen hast.</p>
  `;

  return {
    subject: 'Deine Anfrage bei Kaufmann Health ist eingegangen',
    html: renderLayout({ title: 'Deine Anfrage ist eingegangen', contentHtml }),
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
