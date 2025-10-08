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
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin: 20px 0; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
      <h3 style="margin:0 0 16px; color:#0f172a; font-size:18px; font-weight:700;">Deine Angaben</h3>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:15px; color:#475569; line-height:1.65;">
        <tr><td style="padding:6px 12px 6px 0; width:160px; color:#64748b; font-weight:500;">Stadt</td><td style="padding:6px 0; color:#0f172a;">${escapeHtml(city || '—')}</td></tr>
        <tr><td style="padding:6px 12px 6px 0; width:160px; color:#64748b; font-weight:500;">Anliegen</td><td style="padding:6px 0; color:#0f172a;">${escapeHtml(issue || '—')}</td></tr>
        <tr><td style="padding:6px 12px 6px 0; width:160px; color:#64748b; font-weight:500;">Sitzungsart</td><td style="padding:6px 0; color:#0f172a;">${prefLabel}</td></tr>
      </table>
    </div>
  `;

  const contentHtml = `
    <h1 style="color:#0f172a; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Deine Anfrage ist eingegangen</h1>
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569;">vielen Dank für deine Anfrage bei Kaufmann Health. Wir haben deine Angaben erhalten und melden uns <strong style="color:#0f172a;">innerhalb von 24&nbsp;Stunden</strong> mit den nächsten Schritten.</p>
    ${detailsHtml}
    <div style="background:#ffffff; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
      <h3 style="margin:0 0 16px; color:#0f172a; font-size:18px; font-weight:700;">Wie geht es weiter?</h3>
      <ol style="margin:0 0 0 20px; padding:0; font-size:15px; color:#475569; line-height:1.65;">
        <li style="margin:0 0 12px;">Wir prüfen deine Anfrage und wählen passende Profile aus unserem kuratierten Netzwerk sorgfältig geprüfter Therapeuten.</li>
        <li style="margin:0 0 12px;">Du erhältst in der Regel innerhalb von 24&nbsp;Stunden eine Rückmeldung per E‑Mail.</li>
        <li style="margin:0;">Bei Rückfragen melden wir uns direkt bei dir. Antworte gerne auf diese E‑Mail.</li>
      </ol>
      <div style="text-align:center; margin-top:20px;">${renderButton(BASE_URL + '/therapie-finden', 'Mehr zur Therapeuten-Empfehlung')}</div>
    </div>
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">
      <p style="color:#64748b; font-size:14px; margin:0; line-height:1.6;">Du kannst jederzeit auf diese Nachricht antworten, falls du Ergänzungen oder Fragen hast.</p>
    </div>
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
