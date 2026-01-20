import { BASE_URL } from '@/lib/constants';

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getInitials(first?: string | null, last?: string | null) {
  const f = (first?.trim() || "").charAt(0);
  const l = (last?.trim() || "").charAt(0);
  return `${f}${l}`.toUpperCase();
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function truncateSentences(text: string, maxSentences: number) {
  const parts = (text || "").split(/([.!?]\s+)/);
  let count = 0;
  let out = "";
  for (let i = 0; i < parts.length && count < maxSentences; i++) {
    out += parts[i];
    if (/([.!?]\s+)$/.test(parts[i])) count++;
  }
  return out || text || "";
}

// Convert Supabase public bucket URLs to our domain proxy for deliverability in emails
function toProxiedPhotoUrl(url?: string | null): string | null {
  const raw = (url || '').trim();
  if (!raw) return null;
  // Already proxied or already our domain
  if (raw.startsWith(`${BASE_URL}/api/images/therapist-profiles/`) || raw.startsWith(BASE_URL)) return raw;
  try {
    const u = new URL(raw);
    const path = u.pathname;
    // Match both variants:
    //  - /storage/v1/object/public/therapist-profiles/<path>
    //  - /storage/v1/render/image/public/therapist-profiles/<path>
    const m = path.match(/\/storage\/v1\/(?:object|render\/image)\/public\/therapist-profiles\/(.+)$/);
    if (m && m[1]) {
      // Preserve any query string from the original URL? Public URLs shouldn't need it; drop to maximize cacheability.
      const proxiedPath = m[1];
      return `${BASE_URL}/api/images/therapist-profiles/${proxiedPath}`;
    }
  } catch {}
  return raw; // Fallback: leave as-is if not a Supabase public URL
}

export function renderTherapistPreviewEmail(params: {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  modalities?: string[] | null;
  approach_text?: string | null;
  accepting_new?: boolean | null;
  city?: string | null;
  actionButtonHtml?: string; // already inlined styles, safe HTML (trusted)
}): string {
  const initials = getInitials(params.first_name, params.last_name);
  const avatarColor = `hsl(${hashCode(params.id) % 360}, 70%, 50%)`;
  const approach = truncateSentences(params.approach_text || "", 3);

  const photoSrc = toProxiedPhotoUrl(params.photo_url);
  const photo = photoSrc
    ? `<img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(params.first_name)} ${escapeHtml(params.last_name)}" width="72" height="72" style="width:72px;height:72px;object-fit:cover;display:block;border-radius:999px;" />`
    : `<div style="width:72px;height:72px;color:#fff !important;text-align:center;line-height:72px;font-size:24px;font-weight:600;border-radius:999px;">${escapeHtml(initials)}</div>`;
  // Build multiple modality badges
  const badgeItems = buildBadgeItems(params.modalities || []);
  const maxBadges = 3;
  const shown = badgeItems.slice(0, maxBadges);
  const extra = badgeItems.length - shown.length;
  const badgeBase = 'display:inline-block;border-radius:999px;font-size:12px;padding:2px 8px;line-height:1.3;vertical-align:middle;margin:2px 6px 2px 0;';
  const badgesHtml = [
    ...shown.map((b) => `<span style="${badgeBase}background:${b.color} !important;color:#fff !important;">${escapeHtml(b.label)}</span>`),
    ...(extra > 0 ? [`<span style="${badgeBase}background:#e5e7eb !important;color:#111827 !important;">+${extra}</span>`] : []),
  ].join("");

  const availability = params.accepting_new
    ? `<span style="color:#16a34a !important;font-weight:500">✓ Verfügbar</span>`
    : `<span style="color:#ef4444 !important;font-weight:500">✕ Derzeit keine Kapazität</span>`;

  const action = params.actionButtonHtml ? `<div style="margin-top:12px;">${params.actionButtonHtml}</div>` : "";

  return [
    `<div style="display:flex;align-items:flex-start;">`,
    `  <div style="width:72px;height:72px;border-radius:999px;overflow:hidden;background:${avatarColor} !important;flex:0 0 auto;margin-right:12px;border:1px solid #e5e7eb;">${photo}</div>`,
    `  <div style="flex:1;min-width:0;">`,
    `    <div style="font-weight:600;margin-bottom:4px;color:#0f172a !important;">${escapeHtml(params.first_name)} ${escapeHtml(params.last_name)}</div>`,
    `    <div style="margin:0 0 6px 0;">${badgesHtml}</div>`,
    `    <div style="color:#475569 !important;font-size:14px;margin-bottom:4px;">${escapeHtml(params.city || "")}</div>`,
    `    <div style="font-size:14px;color:#334155 !important;margin-bottom:8px;">${escapeHtml(approach)}</div>`,
    `    <div style="font-size:14px;color:#334155 !important;">Neue Klient:innen: ${availability}</div>`,
    `    ${action}`,
    `  </div>`,
    `</div>`,
  ].join("");
}

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

const MODALITY_MAP: Record<string, { label: string; color: string }> = {
  'narm': { label: 'NARM', color: '#0f766e' },
  'somatic-experiencing': { label: 'Somatic Experiencing', color: '#d97706' },
  'hakomi': { label: 'Hakomi', color: '#047857' },
  'core-energetics': { label: 'Core Energetics', color: '#a21caf' },
};

function buildBadgeItems(modalities: string[]): Array<{ label: string; color: string }> {
  const list = Array.isArray(modalities) ? modalities : [];
  const items = list.map((m) => {
    const slug = normalizeModality(String(m));
    const conf = MODALITY_MAP[slug];
    const label = conf ? conf.label : toTitleCase(String(m));
    const color = conf ? conf.color : '#0f172a';
    return { label, color };
  });
  // Deduplicate by label
  const seen = new Set<string>();
  return items.filter((it) => {
    const k = it.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Format next intro slot for email display.
 * Returns German-formatted date string like "Mo 13. Jan um 10:00"
 * 
 * IMPORTANT: Requires minimum 24h notice for email display.
 * Data shows median email-to-action time is 44h, with 75% of users
 * taking >30 min. Showing "next slot in 4h" in an email that won't
 * be opened for hours creates a poor UX.
 */
function formatNextIntroSlot(slot: { date_iso: string; time_label: string; time_utc?: string } | null | undefined): string | null {
  if (!slot?.date_iso || !slot?.time_label) return null;
  try {
    // Check if slot is in the future
    const slotTime = slot.time_utc 
      ? new Date(slot.time_utc).getTime()
      : new Date(slot.date_iso + 'T' + slot.time_label + ':00').getTime();
    const now = Date.now();
    
    // Require minimum 24h notice for email display
    // Median email-to-action time is 44h, so 24h is safe buffer
    const MIN_NOTICE_MS = 24 * 60 * 60 * 1000; // 24 hours
    if (slotTime < now + MIN_NOTICE_MS) return null;

    const date = new Date(slot.date_iso + 'T12:00:00');
    const weekday = date.toLocaleDateString('de-DE', { weekday: 'short' });
    const day = date.getDate();
    const month = date.toLocaleDateString('de-DE', { month: 'short' });
    return `${weekday} ${day}. ${month} um ${slot.time_label}`;
  } catch {
    return null;
  }
}

export type EnhancedTherapistPreviewParams = {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  modalities?: string[] | null;
  /** @legacy Free-text therapist approach description from early onboarding */
  approach_text?: string | null;
  accepting_new?: boolean | null;
  city?: string | null;
  // Enhanced fields
  next_intro_slot?: { date_iso: string; time_label: string; time_utc?: string } | null;
  /** @legacy Free-text qualification description */
  qualification?: string | null;
  /** @legacy Free-text describing typical clients */
  who_comes_to_me?: string | null;
  /** @legacy Free-text about session focus areas */
  session_focus?: string | null;
  /** @legacy Free-text about what to expect in first session */
  first_session?: string | null;
  typical_rate?: number | null;
  languages?: string[] | null;
  // CTAs
  calBookingUrl?: string | null; // Direct Cal.com booking link
  profileUrl?: string | null; // Link to matches/profile page
  isBest?: boolean; // Show "Für dich empfohlen" badge
};

/**
 * Render enhanced therapist preview for high-conversion selection emails.
 * 
 * Conversion-focused design:
 * - Hero slot display with urgency
 * - Single strong CTA ("Jetzt kostenlos kennenlernen")
 * - Objection handling (free, 15 min, no commitment)
 * - Trust signals (qualification, verified)
 */
export function renderEnhancedTherapistPreviewEmail(params: EnhancedTherapistPreviewParams): string {
  const initials = getInitials(params.first_name, params.last_name);
  const avatarColor = `hsl(${hashCode(params.id) % 360}, 70%, 50%)`;
  
  // Build profile text from available legacy fields
  // Priority: session_focus > first_session > who_comes_to_me > approach_text
  const profileText = params.session_focus
    ? truncateSentences(params.session_focus, 2)
    : params.first_session
      ? truncateSentences(params.first_session, 2)
      : params.who_comes_to_me 
        ? truncateSentences(params.who_comes_to_me, 2)
        : truncateSentences(params.approach_text || '', 2);

  const photoSrc = toProxiedPhotoUrl(params.photo_url);
  const photo = photoSrc
    ? `<img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(params.first_name)} ${escapeHtml(params.last_name)}" width="96" height="96" style="width:96px;height:96px;object-fit:cover;display:block;border-radius:999px;" />`
    : `<div style="width:96px;height:96px;color:#fff !important;text-align:center;line-height:96px;font-size:32px;font-weight:600;border-radius:999px;background:${avatarColor} !important;">${escapeHtml(initials)}</div>`;

  // Modality badges - compact
  const badgeItems = buildBadgeItems(params.modalities || []);
  const shown = badgeItems.slice(0, 2);
  const badgeBase = 'display:inline-block;border-radius:999px;font-size:11px;padding:3px 8px;line-height:1.3;vertical-align:middle;margin:2px 4px 2px 0;';
  const badgesHtml = shown.map((b) => `<span style="${badgeBase}background:${b.color} !important;color:#fff !important;">${escapeHtml(b.label)}</span>`).join('');

  // Next intro slot - HERO ELEMENT with urgency
  const nextSlotFormatted = formatNextIntroSlot(params.next_intro_slot);
  const hasCalBooking = Boolean(params.calBookingUrl && nextSlotFormatted);
  
  // Primary CTA - conversion focused copy
  const primaryCtaUrl = params.calBookingUrl || params.profileUrl;
  const primaryCtaLabel = hasCalBooking 
    ? `Jetzt kostenlos kennenlernen` 
    : `${params.first_name} kennenlernen`;
  
  const primaryCtaHtml = primaryCtaUrl
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-top:20px;">
        <tr>
          <td align="center" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; background-image: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; border-radius:12px; padding:0; box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.35);">
            <a href="${escapeHtml(primaryCtaUrl)}" target="_blank" style="display:inline-block; width:100%; padding:18px 24px; box-sizing:border-box; color:#ffffff !important; text-decoration:none; font-weight:700; text-align:center; font-size:18px; line-height:1.3; border-radius:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${escapeHtml(primaryCtaLabel)}</a>
          </td>
        </tr>
      </table>
    `
    : '';

  // Slot display with urgency - only if Cal booking available
  const slotHeroHtml = hasCalBooking && nextSlotFormatted
    ? `
      <div style="text-align:center;margin:20px 0 0;">
        <div style="font-size:13px;color:#065f46 !important;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Nächster freier Termin</div>
        <div style="font-size:22px;color:#047857 !important;font-weight:700;">${escapeHtml(nextSlotFormatted)}</div>
        <div style="font-size:13px;color:#059669 !important;margin-top:4px;">15 Min • Video-Call • Kostenlos</div>
      </div>
    `
    : '';

  // Qualification + trust inline
  const qualificationHtml = params.qualification
    ? `<span style="color:#166534 !important;font-size:13px;">✓ ${escapeHtml(params.qualification)}</span>`
    : '<span style="color:#166534 !important;font-size:13px;">✓ Verifiziert</span>';

  // Secondary link - minimal, text only
  const secondaryCtaHtml = params.calBookingUrl && params.profileUrl
    ? `<div style="text-align:center;margin-top:14px;"><a href="${escapeHtml(params.profileUrl)}" target="_blank" style="color:#64748b !important;text-decoration:underline;font-size:13px;">Vollständiges Profil ansehen</a></div>`
    : '';

  return `
    <div style="text-align:center;">
      <div style="display:inline-block;width:96px;height:96px;border-radius:999px;overflow:hidden;border:3px solid #10b981;box-shadow:0 4px 12px rgba(16,185,129,0.2);">${photo}</div>
      <div style="margin-top:16px;">
        <div style="font-weight:700;font-size:24px;color:#0f172a !important;">${escapeHtml(params.first_name)} ${escapeHtml(params.last_name)}</div>
        <div style="margin-top:6px;">${qualificationHtml}</div>
        <div style="color:#64748b !important;font-size:14px;margin-top:4px;">📍 ${escapeHtml(params.city || 'Berlin')}</div>
        ${badgesHtml ? `<div style="margin-top:8px;">${badgesHtml}</div>` : ''}
      </div>
    </div>
    ${profileText ? `<div style="font-size:15px;color:#475569 !important;line-height:1.65;margin-top:20px;text-align:center;padding:0 12px;"><em>"${escapeHtml(profileText)}"</em></div>` : ''}
    ${slotHeroHtml}
    ${primaryCtaHtml}
    ${secondaryCtaHtml}
  `;
}
