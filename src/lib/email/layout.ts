import { BASE_URL } from '@/lib/constants';

export function renderButton(href: string, label: string) {
  return `
    <a href="${href}" role="button" style="display:block; width:100%; box-sizing:border-box; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; padding:16px 24px; border-radius:12px; text-decoration:none; font-weight:700; text-align:center; font-size:17px; line-height:1.3; border:none; box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.25);">${label}</a>
  `;
}

export function renderLayout(params: { title?: string; contentHtml: string; preheader?: string; schema?: object }) {
  const title = params.title || 'Kaufmann Health';
  const preheader = (params.preheader || '').trim();
  const schema = params.schema;
  // Use PNG for broad email client compatibility (SVG is not supported everywhere like Gmail)
  const logoSrc = `${BASE_URL}/logos/Health%20Logos%20-%20black/Kaufmann_health_logo_small.png`;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    ${schema ? `\n    <script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n    </script>\n    ` : ''}
    <style>
      /* Dark mode support for email clients */
      @media (prefers-color-scheme: dark) {
        /* Apple Mail, Outlook dark mode */
        .email-container {
          background: #1a1a1a !important;
        }
        .email-header {
          background: #2d2d2d !important;
          border-bottom-color: #404040 !important;
        }
        .email-body {
          background: #1a1a1a !important;
          color: #e5e7eb !important;
        }
        .email-footer {
          color: #9ca3af !important;
        }
        .email-footer a {
          color: #9ca3af !important;
        }
        /* Keep hero sections with their branded colors in dark mode */
        .hero-section {
          background: linear-gradient(135deg, #065f46 0%, #047857 100%) !important;
          border-color: rgba(34, 197, 94, 0.3) !important;
        }
        .hero-title {
          color: #ffffff !important;
        }
        .hero-text {
          color: #d1fae5 !important;
        }
        .info-box {
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%) !important;
          border-color: rgba(148, 163, 184, 0.3) !important;
        }
        .info-text {
          color: #cbd5e1 !important;
        }
        .info-text strong {
          color: #e2e8f0 !important;
        }
      }

      /* Gmail iOS dark mode fix using CSS blend modes */
      /* Gmail wraps content with <u> tag, allowing us to target it */
      u + .email-body .gmail-blend-screen {
        background: #000000;
        mix-blend-mode: screen;
      }
      u + .email-body .gmail-blend-difference {
        background: #000000;
        mix-blend-mode: difference;
      }
    </style>
  </head>
  <body class="email-body" style="margin:0; padding:0; background: linear-gradient(to bottom, #f9fafb 0%, #f3f4f6 100%);">
    ${preheader ? `<div style="display:none; font-size:1px; color:#F9FAFB; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${escapeHtml(preheader)}</div>` : ''}
    <div style="max-width:640px; margin:0 auto; padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid rgba(226, 232, 240, 0.8); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);" bgcolor="#ffffff">
        <tr>
          <td class="email-header" style="padding:24px 32px; background: #f8fafc; border-bottom:1px solid rgba(226, 232, 240, 0.6);" bgcolor="#f8fafc">
            <img src="${logoSrc}" alt="Kaufmann Health" height="32" style="display:block; height:32px; width:auto;" />
          </td>
        </tr>
        <tr>
          <td style="padding:32px; background:#ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height:1.65; color:#334155;" bgcolor="#ffffff">
            ${params.contentHtml}
          </td>
        </tr>
      </table>
      <div class="email-footer" style="text-align:center; color:#94a3b8; font-size:13px; margin-top:16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
        <a href="${BASE_URL}" style="color:#94a3b8; text-decoration:none;">${BASE_URL.replace('https://','')}</a>
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
