import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';

function esc(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export type TherapistNotificationParams = {
  type: 'selection' | 'outreach' | 'reminder';
  magicUrl: string;
  therapistName?: string | null;
  patientCity?: string | null;
  patientIssue?: string | null;
  patientSessionPreference?: 'online' | 'in_person' | null;
  subjectOverride?: string | null;
  expiresHours?: number | null; // for outreach copy
  // EARTH-205: Patient-initiated contact fields
  contactType?: 'booking' | 'consultation' | null;
  patientMessage?: string | null;
};

export function renderTherapistNotification(params: TherapistNotificationParams): EmailContent {
  const tName = (params.therapistName || '').trim();
  const city = (params.patientCity || '').trim();
  const issue = (params.patientIssue || '').trim();
  const format = (params.patientSessionPreference || '').trim();
  const expiresHours = typeof params.expiresHours === 'number' && params.expiresHours > 0 ? params.expiresHours : 72;
  const contactType = params.contactType;
  const patientMessage = (params.patientMessage || '').trim();

  const lines: string[] = [];
  // Header based on type
  if (params.type === 'selection') {
    lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Ein:e Klient:in hat dich ausgewählt</h1>');
    lines.push(`<p style=\"margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;\">Hallo${tName ? ` ${esc(tName)}` : ''},</p>`);
    lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; background-image: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.3); margin:0 0 20px; box-shadow: 0 2px 8px 0 rgba(16, 185, 129, 0.15);">');
    lines.push('<p style="margin:0; font-size:17px; line-height:1.65; color:#064e3b !important; font-weight:600;">Bitte sieh dir die Anfrage kurz an und gib deine Rückmeldung.</p>');
    lines.push('</div>');
  } else if (params.type === 'reminder') {
    lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">⚠️ Erinnerung: Bitte Rückmeldung geben</h1>');
    lines.push(`<p style=\"margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;\">Hallo${tName ? ` ${esc(tName)}` : ''},</p>`);
    lines.push('<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; background-image: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(251, 191, 36, 0.3); margin:0 0 20px; box-shadow: 0 2px 4px 0 rgba(251, 191, 36, 0.1);">');
    lines.push('<p style="margin:0; font-size:17px; line-height:1.65; color:#78350f !important; font-weight:600;">Eine von Klient:in getroffene Auswahl wartet noch auf deine Antwort.</p>');
    lines.push('</div>');
  } else {
    // outreach
    lines.push('<h1 style="color:#0f172a !important; font-size:28px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Neue Anfrage von Klient:in</h1>');
    lines.push(`<p style=\"margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;\">Hallo${tName ? ` ${esc(tName)}` : ''},</p>`);
    // EARTH-205: Show request type if available
    if (contactType) {
      const requestLabel = contactType === 'booking' ? 'Direktbuchung' : 'Kostenloses Erstgespräch (15 Min)';
      lines.push('<div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; background-image: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%) !important; padding:12px 16px; border-radius:8px; border:1px solid rgba(16, 185, 129, 0.3); margin:0 0 16px; display:inline-block;">');
      lines.push(`<p style=\"margin:0; font-weight:700; color:#064e3b !important; font-size:15px;\">${esc(requestLabel)}</p>`);
      lines.push('</div>');
    }
    lines.push(`<p style=\"margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;\">Bitte prüfe die Details und gib deine Rückmeldung. Der Link ist aus Sicherheitsgründen nur für ${expiresHours} Stunden gültig.</p>`);
  }

  // Minimal, non-PII context
  const details: string[] = [];
  if (issue) details.push(`<li style="margin:8px 0;"><strong style="font-weight:700; color:#0f172a !important;">Anliegen:</strong> <span style="color:#475569 !important;">${esc(issue)}</span></li>`);
  if (city) details.push(`<li style="margin:8px 0;"><strong style="font-weight:700; color:#0f172a !important;">Ort:</strong> <span style="color:#475569 !important;">${esc(city)}</span></li>`);
  if (format) details.push(`<li style="margin:8px 0;"><strong style="font-weight:700; color:#0f172a !important;">Format:</strong> <span style="color:#475569 !important;">${format === 'online' ? 'Online' : 'Vor Ort'}</span></li>`);
  if (details.length) {
    lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:20px 24px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin: 20px 0; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">');
    lines.push('<h3 style="margin:0 0 12px; color:#0f172a !important; font-size:18px; font-weight:700;">Anfrage‑Details</h3>');
    lines.push('<ul style="margin:0 0 0 20px; padding:0; font-size:15px; line-height:1.65;">');
    lines.push(details.join(''));
    lines.push('</ul>');
    lines.push('</div>');
  }

  // EARTH-205: Include patient message if provided
  if (patientMessage) {
    lines.push('<div style="margin:20px 0;">');
    lines.push('<h3 style="margin:0 0 12px; color:#0f172a !important; font-size:18px; font-weight:700;">Nachricht von Klient:in</h3>');
    lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; border:1px solid rgba(226, 232, 240, 0.8); border-radius:12px; padding:16px 20px; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">');
    lines.push(`<p style=\"margin:0; white-space:pre-wrap; color:#475569 !important; font-size:15px; line-height:1.65;\">${esc(patientMessage)}</p>`);
    lines.push('</div>');
    lines.push('</div>');
  }

  // CTA
  lines.push('<div style="margin:24px 0; text-align:center;">');
  lines.push(renderButton(params.magicUrl, params.type === 'outreach' ? 'Anfrage ansehen' : 'Anfrage ansehen und annehmen'));
  lines.push('</div>');

  lines.push('<div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin-top:20px;">');
  lines.push('<p style="color:#64748b !important; font-size:14px; margin:0; line-height:1.6;">Kontaktdaten werden aus Datenschutzgründen erst nach Annahme angezeigt.</p>');
  lines.push('</div>');

  const title = params.type === 'outreach' ? 'Neue Anfrage von Klient:in' : 'Neue Auswahl durch Klient:in';
  const html = renderLayout({ title, contentHtml: lines.join('') });

  let subject: string;
  if (params.subjectOverride && params.subjectOverride.trim()) subject = params.subjectOverride.trim();
  else if (params.type === 'selection') subject = 'Ein:e Klient:in hat dich ausgewählt – bitte Rückmeldung geben';
  else if (params.type === 'reminder') subject = 'Erinnerung: Klient:in wartet auf deine Antwort';
  else {
    // EARTH-205: Include request type in subject for patient-initiated contacts
    if (contactType) {
      const typeLabel = contactType === 'booking' ? 'Direktbuchung' : 'Erstgespräch';
      subject = `Neue Anfrage: ${typeLabel}`;
    } else {
      subject = `Neue Anfrage von Klient:in – ${city || 'unbekannt'} – ${issue || 'Allgemein'}`;
    }
  }

  return { subject, html };
}
