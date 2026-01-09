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
};

export function renderCalIntroFollowup(params: CalIntroFollowupParams): EmailContent {
  const name = (params.patientName || '').trim();
  const therapist = esc(params.therapistName);

  const lines: string[] = [];
  lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Wie war Ihr Kennenlerngespräch?</h1>');
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${esc(name)}` : ''},</p>`);
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Sie hatten gerade ein Kennenlerngespräch mit <strong>${therapist}</strong>. Wir hoffen, es war ein guter erster Kontakt!</p>`);

  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226,232,240,0.8); margin: 16px 0;">');
  lines.push('<p style="margin:0 0 12px; font-size:16px; line-height:1.65; color:#334155 !important;"><strong>Möchten Sie einen Folgetermin buchen?</strong></p>');
  lines.push(`<p style="margin:0; font-size:15px; line-height:1.65; color:#475569 !important;">Wenn ${therapist} gut zu Ihnen passt, können Sie direkt eine vollständige Therapiesitzung buchen.</p>`);
  lines.push('</div>');

  if (params.fullSessionUrl) {
    lines.push('<div style="margin:24px 0; text-align:center;">');
    lines.push(renderButton(params.fullSessionUrl, 'Folgetermin buchen'));
    lines.push('</div>');
  }

  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226,232,240,0.8); margin-top:20px;">');
  lines.push('<p style="margin:0 0 8px; color:#475569 !important; font-size:14px; line-height:1.6;"><strong>Noch unsicher?</strong></p>');
  lines.push('<p style="margin:0; color:#64748b !important; font-size:14px; line-height:1.6;">Das ist völlig normal. Antworten Sie einfach auf diese E-Mail, wenn Sie Fragen haben oder eine andere Therapeut:in kennenlernen möchten.</p>');
  lines.push('</div>');

  const subject = `Wie war Ihr Kennenlerngespräch mit ${params.therapistName}?`;
  const html = renderLayout({
    title: 'Wie war Ihr Kennenlerngespräch?',
    contentHtml: lines.join(''),
    preheader: 'Möchten Sie einen Folgetermin buchen?',
  });

  return { subject, html };
}
