import { BASE_URL } from '@/lib/constants';

export function renderButton(href: string, label: string) {
  return `
    <a href="${href}" style="display:inline-block; background-color:#4A9B8E; color:#ffffff; padding:10px 16px; border-radius:8px; text-decoration:none; font-weight:600;">${label}</a>
  `;
}

export function renderLayout(params: { title?: string; contentHtml: string }) {
  const title = params.title || 'Kaufmann Health';
  // Use PNG for broad email client compatibility (SVG is not supported everywhere like Gmail)
  const logoSrc = `${BASE_URL}/logos/Health%20Logos%20-%20black/Kaufmann_health_logo_small.png`;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0; padding:0; background-color:#F9FAFB;">
    <div style="max-width:640px; margin:0 auto; padding:24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #E5E7EB;">
        <tr>
          <td style="padding:16px 24px; background:#FFFFFF; border-bottom:1px solid #E5E7EB;">
            <img src="${logoSrc}" alt="Kaufmann Health" height="28" style="display:block; height:28px; width:auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:24px; font-family: Arial, sans-serif; line-height:1.6; color:#374151;">
            ${params.contentHtml}
          </td>
        </tr>
      </table>
      <div style="text-align:center; color:#9CA3AF; font-size:12px; margin-top:12px;">
        <a href="${BASE_URL}" style="color:#9CA3AF; text-decoration:none;">${BASE_URL.replace('https://','')}</a>
      </div>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
