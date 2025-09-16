import { renderLayout } from '../layout';
import type { EmailContent } from '../types';
import { BASE_URL } from '@/lib/constants';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderPatientBlockerSurvey(params: {
  patientName?: string | null;
  therapistName?: string | null;
  matchId: string;
}): EmailContent {
  const patient = (params.patientName || '').trim();
  const therapist = (params.therapistName || '').trim();
  const matchId = params.matchId;

  const link = (reason: string) => `${BASE_URL}/api/feedback?match=${encodeURIComponent(matchId)}&reason=${encodeURIComponent(reason)}`;

  const choice = (href: string, label: string, style?: string) =>
    `<a href="${href}" style="display:block; padding:12px; margin:8px 0; background:${style || '#F3F4F6'}; text-decoration:none; color:#111827; border-radius:6px;">${label}</a>`;

  const header = `<h1 style="color:#1A365D; font-size:22px; margin:0 0 12px;">Kurze Frage zu Ihrer Therapie‑Anfrage</h1>`;
  const greeting = `<p style="margin:0 0 12px;">Hallo${patient ? ` ${escapeHtml(patient)}` : ''},</p>`;
  const intro = `
    <p style="margin:0 0 12px;">Sie haben vor einer Woche${therapist ? ` ${escapeHtml(therapist)}` : ''} als Therapeut:in ausgewählt, aber wir sehen, dass noch kein Ersttermin stattgefunden hat.</p>
    <p style="margin:0 0 8px;"><strong>Was hält Sie aktuell davon ab?</strong> (1 Klick genügt)</p>
  `;

  const choices = [
    choice(link('scheduling'), '📅 Terminfindung schwierig'),
    choice(link('cost'), '💰 Kosten doch zu hoch'),
    choice(link('changed_mind'), '🤔 Habe es mir anders überlegt'),
    choice(link('no_contact'), '⚠️ Therapeut:in hat sich nicht gemeldet', '#FEE2E2'),
    choice(link('other'), '✏️ Anderer Grund (bitte antworten Sie auf diese E‑Mail)')
  ].join('');

  const footer = `<p style="margin:12px 0 0; color:#6B7280; font-size:12px;">Ihre Rückmeldung hilft uns, den Service für Sie zu verbessern.</p>`;

  const contentHtml = [header, greeting, intro, choices, footer].join('');

  return {
    subject: 'Kurze Frage zu Ihrer Therapie‑Anfrage',
    html: renderLayout({ title: 'Kurze Frage', contentHtml }),
  };
}
