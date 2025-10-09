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

export function renderTherapistReminder(params: {
  name?: string | null;
  profileUrl: string;
  uploadUrl: string;
  missingDocuments: boolean;
  missingPhoto: boolean;
  missingApproach: boolean;
  missingBasic?: boolean; // gender/city/accepting_new missing
  completionPercentage?: number; // 0..100
  stageLabel?: string; // e.g., "Erinnerung", "Zweite Erinnerung", "Letzte Erinnerung"
  optOutUrl?: string;
}): EmailContent {
  const name = (params.name || '').trim();
  const pct = typeof params.completionPercentage === 'number' ? Math.max(0, Math.min(100, Math.round(params.completionPercentage))) : undefined;
  const items: string[] = [];
  if (params.missingDocuments) items.push('Lizenz‑Nachweis');
  if (params.missingPhoto) items.push('Profilfoto');
  if (params.missingApproach) items.push('Ansatz‑Beschreibung');
  if (params.missingBasic) items.push('Basisdaten (Stadt, Verfügbarkeit)');

  const missingList = items.length ? items.join(', ') : 'Profilangaben';

  const lines: string[] = [];
  lines.push(`<p style=\"margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569;\">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>`);
  lines.push('<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569;">Dein Profil ist fast startklar – es fehlen nur noch wenige Angaben.</p>');

  lines.push('<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding:20px 24px; border-radius:12px; border:1px solid rgba(251, 191, 36, 0.3); margin: 20px 0; box-shadow: 0 2px 4px 0 rgba(251, 191, 36, 0.1);">');
  lines.push(`<p style=\"margin:0 0 12px; color:#78350f; font-size:17px; font-weight:700;\">Fehlende Angaben:</p>`);
  lines.push(`<p style=\"margin:0; color:#78350f; font-size:15px; line-height:1.65;\">${escapeHtml(missingList)}</p>`);
  if (typeof pct === 'number') {
    lines.push(`<p style=\"margin:12px 0 0; color:#78350f; font-size:15px; font-weight:600;\">Dein Profil ist zu ${pct}% vollständig.</p>`);
  }
  lines.push('</div>');

  const targetIsProfile = Boolean(params.missingPhoto || params.missingApproach || params.missingBasic);
  const targetUrl = targetIsProfile ? params.profileUrl : params.uploadUrl;
  const ctaLabel = targetIsProfile ? 'Profil vervollständigen' : 'Dokumente hochladen';
  lines.push(`<div style=\"text-align:center; margin: 24px 0;\">${renderButton(targetUrl, ctaLabel)}</div>`);
  lines.push('<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569;">Dauert nur 5–10 Minuten. Danach kannst du sofort Klienten‑Anfragen erhalten.</p>');

  if (params.optOutUrl) {
    lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">');
    lines.push(
      `<p style=\"margin:0; color:#64748b; font-size:14px; line-height:1.6;\">Möchtest du diese Erinnerungen pausieren? <a href=\"${escapeHtml(params.optOutUrl)}\" style=\"color:#10b981; text-decoration:none; font-weight:600;\">Hier klicken</a>.</p>`
    );
    lines.push('</div>');
  }

  const subjectStage = params.stageLabel ? ` – ${params.stageLabel}` : '';
  let subjectBase = 'Profil vervollständigen';
  if (params.missingDocuments && !targetIsProfile) subjectBase = 'Lizenz‑Nachweis ausstehend';
  else if (params.missingPhoto) subjectBase = 'Dein Profil ist fast startklar – Foto fehlt noch';

  const titleHtml = `<h1 style="color:#0f172a; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">${subjectBase}</h1>`;

  return {
    subject: `${subjectBase}${subjectStage}`,
    html: renderLayout({ title: subjectBase, contentHtml: titleHtml + lines.join('') }),
  };
}
