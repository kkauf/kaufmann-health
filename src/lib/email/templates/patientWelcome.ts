import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

export function renderPatientWelcome(params: {
  name?: string | null;
}): EmailContent {
  const name = (params.name || '').trim();

  const contentHtml = `
    <h1 style="color:#111827; font-size:22px; margin:0 0 12px;">Willkommen bei Kaufmann Health!</h1>
    <p style="margin:0 0 12px;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>
    <p style="margin:0 0 12px;">vielen Dank für Ihre Anfrage. Wir melden uns in Kürze bei Ihnen mit den nächsten Schritten.</p>
    <div style="text-align:center; margin-top:12px;">${renderButton('https://kaufmann-health.de', 'Zur Startseite')}</div>
  `;

  return {
    subject: 'Willkommen bei Kaufmann Health',
    html: renderLayout({ title: 'Willkommen bei Kaufmann Health', contentHtml }),
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
