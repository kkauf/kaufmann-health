import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderTherapistMagicLink(params: {
  name?: string | null;
  magicLinkUrl: string;
}): EmailContent {
  const name = (params.name || '').trim();

  const lines: string[] = [];
  lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Dein Login-Link</h1>');
  lines.push(`<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 24px; font-size:16px; line-height:1.65; color:#475569 !important;">Klicke auf den Button unten, um dein Therapeuten-Profil zu bearbeiten:</p>');
  lines.push(renderButton(params.magicLinkUrl, 'Profil bearbeiten'));
  lines.push('<p style="margin:24px 0 0; font-size:14px; line-height:1.65; color:#64748b !important;">Der Link ist 30 Tage gültig. Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.</p>');
  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:24px;">');
  lines.push('<p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Bei Fragen antworte einfach auf diese E-Mail.</p>');
  lines.push('</div>');

  return {
    subject: 'Dein Login-Link für Kaufmann Health',
    html: renderLayout({ 
      title: 'Login-Link', 
      contentHtml: lines.join(''),
      preheader: 'Klicke hier, um dein Profil zu bearbeiten',
    }),
  };
}
