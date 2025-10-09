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

  const choice = (href: string, label: string, isHighlight?: boolean) => {
    const bgStyle = isHighlight
      ? 'background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border:1px solid rgba(239, 68, 68, 0.3);'
      : 'background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border:1px solid rgba(226, 232, 240, 0.8);';
    const textColor = isHighlight ? '#991b1b' : '#0f172a';
    return `<a href="${href}" style="display:block; padding:14px 16px; margin:10px 0; ${bgStyle} text-decoration:none; color:${textColor}; border-radius:8px; font-weight:600; font-size:15px; transition: all 0.2s; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">${label}</a>`;
  };

  const header = `<h1 style="color:#0f172a; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Kurze Frage zu deiner Therapie‑Anfrage</h1>`;
  const greeting = `<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569;">Hallo${patient ? ` ${escapeHtml(patient)}` : ''},</p>`;
  const intro = `
    <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569;">Du hast vor einer Woche${therapist ? ` ${escapeHtml(therapist)}` : ''} als Therapeut:in ausgewählt, aber wir sehen, dass noch kein Ersttermin stattgefunden hat.</p>
    <p style="margin:0 0 16px; font-size:17px; font-weight:700; color:#0f172a;">Was hält dich aktuell davon ab? (1 Klick genügt)</p>
  `;

  const choices = [
    choice(link('scheduling'), '📅 Terminfindung schwierig'),
    choice(link('cost'), '💰 Kosten doch zu hoch'),
    choice(link('changed_mind'), '🤔 Habe es mir anders überlegt'),
    choice(link('no_contact'), '⚠️ Therapeut:in hat sich nicht gemeldet', true),
    choice(link('other'), '✏️ Anderer Grund (bitte antworte auf diese E‑Mail)')
  ].join('');

  const footer = `<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:24px;">
    <p style="color:#64748b; font-size:14px; margin:0; line-height:1.6;">Deine Rückmeldung hilft uns, den Service für dich zu verbessern.</p>
  </div>`;

  const contentHtml = [header, greeting, intro, choices, footer].join('');

  return {
    subject: 'Kurze Frage zu deiner Therapie‑Anfrage',
    html: renderLayout({ title: 'Kurze Frage', contentHtml }),
  };
}
