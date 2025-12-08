import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';
import { BASE_URL } from '@/lib/constants';

function escapeHtml(s: string) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getInitials(first?: string | null, last?: string | null) {
  const f = (first?.trim() || '').charAt(0);
  const l = (last?.trim() || '').charAt(0);
  return `${f}${l}`.toUpperCase();
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function truncateText(text: string, maxChars: number) {
  const cleaned = (text || '').trim();
  if (cleaned.length <= maxChars) return cleaned;
  // Find last complete sentence within limit
  const truncated = cleaned.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > maxChars * 0.6) {
    return truncated.slice(0, lastPeriod + 1);
  }
  return truncated.slice(0, truncated.lastIndexOf(' ')) + '…';
}

// Convert Supabase public bucket URLs to our domain proxy for email deliverability
function toProxiedPhotoUrl(url?: string | null): string | null {
  const raw = (url || '').trim();
  if (!raw) return null;
  if (raw.startsWith(`${BASE_URL}/api/images/therapist-profiles/`) || raw.startsWith(BASE_URL)) return raw;
  try {
    const u = new URL(raw);
    const path = u.pathname;
    const m = path.match(/\/storage\/v1\/(?:object|render\/image)\/public\/therapist-profiles\/(.+)$/);
    if (m && m[1]) {
      return `${BASE_URL}/api/images/therapist-profiles/${m[1]}`;
    }
  } catch {}
  return raw;
}

const MODALITY_MAP: Record<string, { label: string; color: string }> = {
  'narm': { label: 'NARM', color: '#0f766e' },
  'somatic-experiencing': { label: 'Somatic Experiencing', color: '#d97706' },
  'hakomi': { label: 'Hakomi', color: '#047857' },
  'core-energetics': { label: 'Core Energetics', color: '#a21caf' },
};

function normalizeModality(v: string): string {
  return String(v)
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function toTitleCase(s: string): string {
  return String(s)
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

function buildModalityBadges(modalities: string[]): string {
  const list = Array.isArray(modalities) ? modalities : [];
  const seen = new Set<string>();
  const items = list
    .map((m) => {
      const slug = normalizeModality(String(m));
      const conf = MODALITY_MAP[slug];
      const label = conf ? conf.label : toTitleCase(String(m));
      const color = conf ? conf.color : '#0f172a';
      return { label, color, key: label.toLowerCase() };
    })
    .filter((it) => {
      if (seen.has(it.key)) return false;
      seen.add(it.key);
      return true;
    })
    .slice(0, 3);

  const badgeBase = 'display:inline-block;border-radius:999px;font-size:12px;padding:4px 10px;line-height:1.3;vertical-align:middle;margin:2px 6px 2px 0;';
  return items
    .map((b) => `<span style="${badgeBase}background:${b.color} !important;color:#fff !important;">${escapeHtml(b.label)}</span>`)
    .join('');
}

export type RichTherapistEmailParams = {
  patientName?: string | null;
  patientId: string;
  therapist: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url?: string | null;
    city?: string | null;
    modalities?: string[] | null;
    approach_text?: string | null;
  };
  matchesUrl: string; // /matches/[secure_uuid]
};

export function renderRichTherapistEmail(params: RichTherapistEmailParams): EmailContent {
  const { patientName, patientId, therapist, matchesUrl } = params;
  const name = (patientName || '').trim();
  const therapistFirstName = (therapist.first_name || '').trim();
  const therapistLastName = (therapist.last_name || '').trim();
  const therapistInitial = therapistLastName.charAt(0) ? `${therapistLastName.charAt(0)}.` : '';
  const therapistDisplayName = `${therapistFirstName} ${therapistInitial}`.trim();
  const city = (therapist.city || 'Online').trim();
  const approachText = truncateText(therapist.approach_text || '', 200);
  
  // Photo or initials fallback
  const photoSrc = toProxiedPhotoUrl(therapist.photo_url);
  const initials = getInitials(therapist.first_name, therapist.last_name);
  const avatarColor = `hsl(${hashCode(therapist.id) % 360}, 65%, 55%)`;
  
  const photoHtml = photoSrc
    ? `<img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(therapistDisplayName)}" width="80" height="80" style="width:80px;height:80px;object-fit:cover;display:block;border-radius:999px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.1);" />`
    : `<div style="width:80px;height:80px;background:${avatarColor} !important;color:#fff !important;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:24px;border-radius:999px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.1);">${escapeHtml(initials)}</div>`;

  // Modality badges
  const modalityBadges = buildModalityBadges(therapist.modalities || []);

  // URLs with tracking - include therapist ID to auto-open profile modal
  const profileUrl = `${matchesUrl}?therapist=${encodeURIComponent(therapist.id)}&utm_source=email&utm_medium=transactional&utm_campaign=rich_therapist_d1`;
  const otherMatchesUrl = `${matchesUrl}?view=all&utm_source=email&utm_medium=transactional&utm_campaign=rich_therapist_d1`;
  const feedbackUrl = `${BASE_URL}/feedback/quick?patient=${encodeURIComponent(patientId)}&reason=match_dissatisfied&therapist=${encodeURIComponent(therapist.id)}&utm_source=email&utm_campaign=rich_therapist_d1`;

  const contentHtml = `
    <div style="margin:0 0 24px;">
      ${name ? `<p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(name)},</p>` : ''}
      <p style="margin:0; font-size:16px; line-height:1.65; color:#475569 !important;">basierend auf deinen Angaben haben wir eine Therapeutin für dich ausgewählt:</p>
    </div>

    <!-- Therapist Card -->
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; border-radius:16px; border:1px solid rgba(226, 232, 240, 0.8); padding:24px; margin:0 0 24px; box-shadow: 0 4px 12px 0 rgba(100, 116, 139, 0.08);">
      
      <!-- Photo and Name Row -->
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:16px;">
        <tr>
          <td width="92" style="vertical-align:top;">
            ${photoHtml}
          </td>
          <td style="vertical-align:top;padding-left:16px;">
            <div style="font-size:22px;font-weight:700;color:#0f172a !important;margin-bottom:4px;">${escapeHtml(therapistDisplayName)}</div>
            <div style="font-size:14px;color:#64748b !important;margin-bottom:8px;">Körperpsychotherapeutin · ${escapeHtml(city)}</div>
            <div>${modalityBadges}</div>
          </td>
        </tr>
      </table>

      <!-- Approach Text -->
      ${approachText ? `
        <div style="border-top:1px solid rgba(226, 232, 240, 0.8);padding-top:16px;margin-bottom:16px;">
          <p style="margin:0;font-size:15px;line-height:1.65;color:#334155 !important;font-style:italic;">„${escapeHtml(approachText)}"</p>
        </div>
      ` : ''}

      <!-- Benefits -->
      <div style="margin-bottom:20px;">
        <div style="display:inline-block;margin:4px 8px 4px 0;font-size:14px;color:#16a34a !important;font-weight:500;">✓ Kostenloses Kennenlerngespräch</div>
        <div style="display:inline-block;margin:4px 0;font-size:14px;color:#16a34a !important;font-weight:500;">✓ Schnelle Terminvergabe</div>
      </div>

      <!-- CTA Button -->
      ${renderButton(profileUrl, `${escapeHtml(therapistFirstName)}s Profil ansehen`)}
    </div>

    <!-- Escape Hatches -->
    <div style="text-align:center;margin:0 0 8px;">
      <p style="margin:0 0 12px;font-size:14px;color:#64748b !important;">Nicht die richtige Person?</p>
      <a href="${escapeHtml(otherMatchesUrl)}" style="color:#4f46e5 !important;font-size:14px;text-decoration:underline;font-weight:500;">Andere Vorschläge ansehen</a>
      <span style="color:#cbd5e1 !important;margin:0 12px;">|</span>
      <a href="${escapeHtml(feedbackUrl)}" style="color:#64748b !important;font-size:14px;text-decoration:underline;">Passt nicht zu mir</a>
    </div>
  `;

  const subject = `${therapistDisplayName} — deine persönliche Empfehlung`;
  const preheader = `Wir haben eine passende Therapeutin für dich gefunden.`;

  const schema = {
    '@context': 'http://schema.org',
    '@type': 'EmailMessage',
    potentialAction: {
      '@type': 'ViewAction',
      name: `${therapistFirstName}s Profil ansehen`,
      url: profileUrl,
    },
    description: preheader,
  };

  return {
    subject,
    html: renderLayout({ title: 'Deine Therapeuten-Empfehlung', contentHtml, preheader, schema }),
  };
}
