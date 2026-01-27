import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';
import type { PatientBehaviorSegment } from '../patientBehavior';
import { BASE_URL } from '@/lib/constants';

function escapeHtml(s: string) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ============================================================================
// Modality helpers (inline — simpler than Day 1, no photo complexity)
// ============================================================================

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

function truncateText(text: string, maxChars: number) {
  const cleaned = (text || '').trim();
  if (cleaned.length <= maxChars) return cleaned;
  const truncated = cleaned.slice(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  if (lastPeriod > maxChars * 0.6) {
    return truncated.slice(0, lastPeriod + 1);
  }
  return truncated.slice(0, truncated.lastIndexOf(' ')) + '\u2026';
}

// ============================================================================
// Types
// ============================================================================

export type TherapistInfo = {
  id: string;
  first_name: string;
  last_name: string;
  city?: string | null;
  modalities?: string[] | null;
  approach_text?: string | null;
};

export type BehavioralFeedbackParams = {
  patientName?: string | null;
  patientId: string;
  segment: PatientBehaviorSegment;
  matchesUrl: string;
  therapist?: TherapistInfo | null;
  availableSlots?: number | null;
  nextSlotDate?: string | null;
  calBookingUrl?: string | null;
};

// ============================================================================
// Interview CTA (shared across variants, with segment-aware copy)
// ============================================================================

function renderInterviewCta(segment: PatientBehaviorSegment, patientId: string, source: string): string {
  const calendarUrl = process.env.NEXT_PUBLIC_BOOKING_URL || 'https://cal.com/kkauf/15min';
  const feedbackUrl = `${BASE_URL}/feedback/quick?patient=${encodeURIComponent(patientId)}&reason=${encodeURIComponent(interviewReason(segment))}&utm_source=email&utm_campaign=${encodeURIComponent(source)}`;

  const isPrimary = segment.segment === 'almost_booked' ||
    (segment.segment === 'rejected' && isPrimaryInterviewRejection(segment.reasons));

  const heading = interviewHeading(segment);
  const description = interviewDescription(segment);

  if (isPrimary) {
    // Primary CTA: prominent interview block
    return `
      <div style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%) !important; background-image: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%) !important; border-radius:16px; border:1px solid rgba(99, 102, 241, 0.2); padding:24px; margin:0 0 20px; box-shadow: 0 2px 8px 0 rgba(99, 102, 241, 0.08);">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="48" style="vertical-align:top;padding-right:16px;">
              <div style="width:44px;height:44px;background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;border-radius:12px;text-align:center;line-height:44px;">
                <span style="font-size:20px;">&#x1F4AC;</span>
              </div>
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0 0 8px; font-size:17px; font-weight:700; color:#0f172a !important;">${escapeHtml(heading)}</p>
              <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#4338ca !important;">${escapeHtml(description)} <strong style="color:#312e81 !important;">25\u20AC Amazon-Gutschein</strong>.</p>
              ${renderButton(calendarUrl, 'Termin vereinbaren')}
            </td>
          </tr>
        </table>
      </div>
      <div style="text-align:center;">
        <a href="${escapeHtml(feedbackUrl)}" style="color:#64748b !important;font-size:13px;text-decoration:underline;">Lieber kurz schriftlich antworten</a>
      </div>
    `;
  }

  // Secondary CTA: lighter styling
  return `
    <div style="border-top:1px solid rgba(226,232,240,0.8); padding-top:24px; margin-top:24px;">
      <div style="background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%) !important; background-image: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%) !important; border-radius:16px; border:1px solid rgba(99, 102, 241, 0.2); padding:24px; box-shadow: 0 2px 8px 0 rgba(99, 102, 241, 0.08);">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="48" style="vertical-align:top;padding-right:16px;">
              <div style="width:44px;height:44px;background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;border-radius:12px;text-align:center;line-height:44px;">
                <span style="font-size:20px;">&#x1F4AC;</span>
              </div>
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0 0 8px; font-size:17px; font-weight:700; color:#0f172a !important;">${escapeHtml(heading)}</p>
              <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#4338ca !important;">${escapeHtml(description)} <strong style="color:#312e81 !important;">25\u20AC Amazon-Gutschein</strong>.</p>
              ${renderButton(calendarUrl, 'Termin vereinbaren')}
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

function interviewReason(segment: PatientBehaviorSegment): string {
  switch (segment.segment) {
    case 'almost_booked': return 'almost_booked_feedback';
    case 'rejected': return segment.reasons[0]?.reason || 'profile_feedback';
    case 'visited_no_action': return 'profile_feedback';
    case 'never_visited': return 'profile_feedback';
    default: return 'other';
  }
}

function interviewHeading(segment: PatientBehaviorSegment): string {
  switch (segment.segment) {
    case 'almost_booked': return 'Was hat dich gestoppt? 15 Min + 25\u20AC';
    case 'rejected': return isPrimaryInterviewRejection(segment.reasons)
      ? 'Wir w\u00FCrden gern verstehen warum \u2014 15 Min + 25\u20AC'
      : 'Hast du 15 Minuten f\u00FCr ein kurzes Gespr\u00E4ch?';
    case 'visited_no_action': return 'Noch unsicher? Wir helfen bei der Entscheidung \u2014 15 Min + 25\u20AC';
    case 'never_visited': return 'Hast du Fragen? Wir erkl\u00E4ren dir alles \u2014 15 Min + 25\u20AC';
    default: return 'Hast du 15 Minuten f\u00FCr ein kurzes Gespr\u00E4ch?';
  }
}

function interviewDescription(segment: PatientBehaviorSegment): string {
  switch (segment.segment) {
    case 'almost_booked': return 'Dein Feedback hilft uns, den Buchungsprozess zu verbessern. Als Dank erh\u00E4ltst du einen';
    case 'rejected': return 'Dein Feedback hilft uns, bessere Empfehlungen zu machen. Als Dank erh\u00E4ltst du einen';
    default: return 'Als Dank erh\u00E4ltst du einen';
  }
}

function isPrimaryInterviewRejection(reasons: { reason: string }[]): boolean {
  const primaryReasons = new Set(['method_wrong', 'too_expensive', 'wants_insurance']);
  return reasons.some(r => primaryReasons.has(r.reason));
}

// ============================================================================
// Mini therapist card (for variants A & D)
// ============================================================================

function renderMiniTherapistCard(therapist: TherapistInfo, matchesUrl: string): string {
  const firstName = (therapist.first_name || '').trim();
  const lastInitial = (therapist.last_name || '').trim().charAt(0);
  const displayName = `${firstName} ${lastInitial ? lastInitial + '.' : ''}`.trim();
  const city = (therapist.city || 'Online').trim();
  const approachText = truncateText(therapist.approach_text || '', 150);
  const modalityBadges = buildModalityBadges(therapist.modalities || []);

  const profileUrl = `${matchesUrl}?therapist=${encodeURIComponent(therapist.id)}&utm_source=email&utm_medium=transactional&utm_campaign=feedback_behavioral_d10`;

  return `
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; border-radius:16px; border:1px solid rgba(226, 232, 240, 0.8); padding:24px; margin:0 0 24px; box-shadow: 0 4px 12px 0 rgba(100, 116, 139, 0.08);">
      <div style="font-size:20px;font-weight:700;color:#0f172a !important;margin-bottom:4px;">${escapeHtml(displayName)}</div>
      <div style="font-size:14px;color:#64748b !important;margin-bottom:8px;">K\u00F6rperpsychotherapeutin \u00B7 ${escapeHtml(city)}</div>
      <div style="margin-bottom:12px;">${modalityBadges}</div>
      ${approachText ? `
        <div style="border-top:1px solid rgba(226, 232, 240, 0.8);padding-top:12px;margin-bottom:12px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#334155 !important;font-style:italic;">\u201E${escapeHtml(approachText)}\u201C</p>
        </div>
      ` : ''}
      <div style="margin-bottom:12px;">
        <span style="display:inline-block;margin-right:12px;font-size:13px;color:#16a34a !important;font-weight:500;">\u2713 15 Min kostenlos</span>
        <span style="display:inline-block;font-size:13px;color:#16a34a !important;font-weight:500;">\u2713 Unverbindlich</span>
      </div>
      <div style="text-align:center;">
        <a href="${escapeHtml(profileUrl)}" style="color:#4f46e5 !important;font-size:14px;text-decoration:underline;font-weight:500;">Profil ansehen \u2192</a>
      </div>
    </div>
  `;
}

// ============================================================================
// Variant D: Almost Booked
// ============================================================================

function renderAlmostBooked(params: BehavioralFeedbackParams): { contentHtml: string; subject: string; preheader: string } {
  const { patientName, patientId, matchesUrl, therapist, calBookingUrl } = params;
  const name = (patientName || '').trim();
  const therapistFirstName = (therapist?.first_name || '').trim();
  const therapistLastInitial = (therapist?.last_name || '').trim().charAt(0);
  const therapistDisplay = `${therapistFirstName} ${therapistLastInitial ? therapistLastInitial + '.' : ''}`.trim();

  const bookingCta = calBookingUrl || `${matchesUrl}?therapist=${encodeURIComponent(therapist?.id || '')}&utm_source=email&utm_medium=transactional&utm_campaign=feedback_behavioral_d10`;

  const contentHtml = `
    <div style="margin:0 0 20px;">
      ${name ? `<p style="margin:0 0 12px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(name)},</p>` : ''}
      <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">du warst kurz davor, ${therapistFirstName ? `ein Gespr\u00E4ch mit <strong style="color:#0f172a !important;">${escapeHtml(therapistDisplay)}</strong> zu buchen` : 'ein Kennenlerngespräch zu buchen'}. Wir wollten sichergehen, dass nichts dazwischengekommen ist.</p>
    </div>

    ${therapist ? renderMiniTherapistCard(therapist, matchesUrl) : ''}

    <div style="margin:0 0 24px;">
      ${renderButton(bookingCta, 'Jetzt kostenlosen Termin buchen')}
    </div>

    <div style="text-align:center;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#64748b !important;">Kostenlos \u00B7 15 Minuten \u00B7 Unverbindlich</p>
    </div>

    ${renderInterviewCta(params.segment, patientId, 'feedback_behavioral_d10_almost_booked')}
  `;

  const subject = therapistFirstName
    ? `Du warst fast soweit \u2014 ${therapistDisplay} hat noch Termine`
    : 'Du warst fast soweit \u2014 dein Termin wartet';
  const preheader = 'Ein Schritt trennt dich vom kostenlosen Kennenlerngespräch.';

  return { contentHtml, subject, preheader };
}

// ============================================================================
// Variant A: Never Visited
// ============================================================================

function renderNeverVisited(params: BehavioralFeedbackParams): { contentHtml: string; subject: string; preheader: string } {
  const { patientName, patientId, matchesUrl, therapist, availableSlots, nextSlotDate } = params;
  const name = (patientName || '').trim();
  const therapistFirstName = (therapist?.first_name || '').trim();
  const therapistLastInitial = (therapist?.last_name || '').trim().charAt(0);
  const therapistDisplay = `${therapistFirstName} ${therapistLastInitial ? therapistLastInitial + '.' : ''}`.trim();

  const displaySlots = availableSlots ? Math.min(Math.max(availableSlots, 1), 5) : null;

  const slotHtml = displaySlots && nextSlotDate
    ? `<div style="background:#fef3c7 !important; border:1px solid #fcd34d; border-radius:8px; padding:12px 16px; margin:0 0 20px; text-align:center;">
        <span style="color:#92400e !important; font-size:14px; font-weight:600;">\u26A1 ${escapeHtml(therapistFirstName)} hat noch ${displaySlots} freie${displaySlots === 1 ? 'n' : ''} Termin${displaySlots === 1 ? '' : 'e'} diese Woche</span>
       </div>`
    : '';

  const profileUrl = `${matchesUrl}?therapist=${encodeURIComponent(therapist?.id || '')}&utm_source=email&utm_medium=transactional&utm_campaign=feedback_behavioral_d10`;

  const contentHtml = `
    <div style="margin:0 0 20px;">
      ${name ? `<p style="margin:0 0 12px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(name)},</p>` : ''}
      <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">wir haben ${therapistFirstName ? `<strong style="color:#0f172a !important;">${escapeHtml(therapistDisplay)}</strong>` : 'eine Therapeutin'} pers\u00F6nlich f\u00FCr dich ausgew\u00E4hlt. Schau dir ${therapistFirstName ? (therapistFirstName.endsWith('a') || therapistFirstName.endsWith('e') ? 'ihr' : 'sein') : 'das'} Profil an \u2014 der erste Termin ist kostenlos und unverbindlich.</p>
    </div>

    ${slotHtml}
    ${therapist ? renderMiniTherapistCard(therapist, matchesUrl) : ''}

    <div style="margin:0 0 24px;">
      ${renderButton(profileUrl, 'Kostenlosen Termin buchen')}
    </div>

    ${renderInterviewCta(params.segment, patientId, 'feedback_behavioral_d10_never_visited')}
  `;

  const subject = therapistFirstName
    ? `${therapistDisplay} hat diese Woche noch freie Termine`
    : 'Deine Therapeuten-Empfehlung wartet auf dich';
  const preheader = 'Kostenloses Kennenlerngespr\u00E4ch verf\u00FCgbar \u2014 jetzt Termin sichern.';

  return { contentHtml, subject, preheader };
}

// ============================================================================
// Variant B: Visited, No Action
// ============================================================================

function renderVisitedNoAction(params: BehavioralFeedbackParams): { contentHtml: string; subject: string; preheader: string } {
  const { patientName, patientId, matchesUrl } = params;
  const name = (patientName || '').trim();

  const profileUrl = `${matchesUrl}?utm_source=email&utm_medium=transactional&utm_campaign=feedback_behavioral_d10`;

  const contentHtml = `
    <div style="margin:0 0 20px;">
      ${name ? `<p style="margin:0 0 12px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(name)},</p>` : ''}
      <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">wir wissen, dass es nicht leicht ist, sich f\u00FCr eine:n Therapeut:in zu entscheiden. Aber: <strong style="color:#0f172a !important;">Die meisten unserer Patient:innen buchen nach dem Kennenlerngespräch eine Sitzung.</strong></p>
    </div>

    <!-- Social Proof + Reframe -->
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; border-radius:16px; border:1px solid rgba(226, 232, 240, 0.8); padding:24px; margin:0 0 24px; box-shadow: 0 2px 8px 0 rgba(100, 116, 139, 0.06);">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding:8px 0;vertical-align:top;width:24px;">
            <span style="color:#16a34a !important;font-size:16px;font-weight:700;">\u2713</span>
          </td>
          <td style="padding:8px 0 8px 8px;vertical-align:top;">
            <span style="font-size:15px;line-height:1.6;color:#334155 !important;">Die <strong style="color:#0f172a !important;">\u201EChemie\u201C</strong> zeigt sich im Gespr\u00E4ch, nicht im Profil</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;width:24px;">
            <span style="color:#16a34a !important;font-size:16px;font-weight:700;">\u2713</span>
          </td>
          <td style="padding:8px 0 8px 8px;vertical-align:top;">
            <span style="font-size:15px;line-height:1.6;color:#334155 !important;">Das Kennenlernen ist <strong style="color:#0f172a !important;">kostenlos und unverbindlich</strong> \u2014 du entscheidest danach</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;vertical-align:top;width:24px;">
            <span style="color:#16a34a !important;font-size:16px;font-weight:700;">\u2713</span>
          </td>
          <td style="padding:8px 0 8px 8px;vertical-align:top;">
            <span style="font-size:15px;line-height:1.6;color:#334155 !important;">Du kannst <strong style="color:#0f172a !important;">jederzeit wechseln</strong>, wenn es nicht passt</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Social Proof Testimonial -->
    <div style="background:#f0fdf4 !important; border-left:4px solid #22c55e; padding:16px 20px; margin:0 0 24px; border-radius:0 8px 8px 0;">
      <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#166534 !important; font-style:italic;">\u201ENach 3 Sessions f\u00FChlte ich mich endlich verstanden.\u201C</p>
      <p style="margin:0; font-size:13px; color:#15803d !important;">\u2014 Patient:in aus Berlin</p>
    </div>

    <div style="margin:0 0 24px;">
      ${renderButton(profileUrl, 'Vorschl\u00E4ge nochmal ansehen')}
    </div>

    ${renderInterviewCta(params.segment, patientId, 'feedback_behavioral_d10_visited_no_action')}
  `;

  const subject = '85% buchen nach dem Kennenlernen eine Sitzung';
  const preheader = 'Die \u201EChemie\u201C zeigt sich im Gespr\u00E4ch, nicht im Profil.';

  return { contentHtml, subject, preheader };
}

// ============================================================================
// Variant C: Rejected (7 sub-variants by rejection reason)
// ============================================================================

type RejectionCopy = {
  subject: string;
  preheader: string;
  bodyHtml: string;
  feedbackReason: string;
};

function getRejectionCopy(
  reasons: { reason: string; therapist_id: string; details?: string }[],
  name: string,
  matchesUrl: string,
): RejectionCopy {
  const primaryReason = reasons[0]?.reason || 'other';
  const profileUrl = `${matchesUrl}?utm_source=email&utm_medium=transactional&utm_campaign=feedback_behavioral_d10`;

  const greeting = name ? `<p style="margin:0 0 12px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(name)},</p>` : '';

  switch (primaryReason) {
    case 'not_right_fit':
      return {
        subject: 'Nicht die richtige Person? Wir haben weitere Vorschl\u00E4ge',
        preheader: 'Jeder Mensch braucht eine andere therapeutische Pers\u00F6nlichkeit.',
        feedbackReason: 'profile_feedback',
        bodyHtml: `
          ${greeting}
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">wir verstehen, dass nicht jede Empfehlung auf Anhieb passt. Jeder Mensch braucht eine andere therapeutische Pers\u00F6nlichkeit \u2014 das ist v\u00F6llig normal.</p>
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Schau dir deine <strong style="color:#0f172a !important;">weiteren Vorschl\u00E4ge</strong> an \u2014 vielleicht ist die richtige Person dabei:</p>
          ${renderButton(profileUrl, 'Weitere Vorschl\u00E4ge ansehen')}
        `,
      };

    case 'method_wrong':
      return {
        subject: 'Die Methode passt nicht? Hier ist, was du wissen solltest',
        preheader: 'K\u00F6rperpsychotherapie funktioniert anders als klassische Gespr\u00E4chstherapie.',
        feedbackReason: 'method_preference',
        bodyHtml: `
          ${greeting}
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">wir haben gesehen, dass die vorgeschlagene Methode nicht ganz deinen Vorstellungen entspricht.</p>
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">K\u00F6rperpsychotherapie-Methoden wie NARM, Hakomi oder Somatic Experiencing arbeiten <strong style="color:#0f172a !important;">mit dem K\u00F6rper statt nur \u00FCber das Gespr\u00E4ch</strong>. Im kostenlosen Kennenlernen kannst du erleben, wie sich das anf\u00FChlt.</p>
          ${renderButton(profileUrl, 'Vorschl\u00E4ge nochmal ansehen')}
        `,
      };

    case 'too_expensive':
      return {
        subject: 'Zum Preis: Das erste Gespr\u00E4ch ist kostenlos',
        preheader: 'Kennenlernen kostet nichts \u2014 und danach entscheidest du.',
        feedbackReason: 'price_feedback',
        bodyHtml: `
          ${greeting}
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">wir verstehen, dass der Preis eine Rolle spielt. Deshalb m\u00F6chten wir klarstellen:</p>
          <div style="background:#f0fdf4 !important; border-left:4px solid #22c55e; padding:16px 20px; margin:0 0 20px; border-radius:0 8px 8px 0;">
            <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#166534 !important; font-weight:600;">\u2713 Das Kennenlerngespräch ist kostenlos</p>
            <p style="margin:0; font-size:15px; line-height:1.6; color:#166534 !important;">\u2713 Keine Verpflichtung, keine versteckten Kosten</p>
          </div>
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Viele Therapeut:innen bieten au\u00DFerdem flexible Preisgestaltung an. Im Kennenlerngespräch kannst du das direkt ansprechen.</p>
          ${renderButton(profileUrl, 'Kostenlosen Termin buchen')}
        `,
      };

    case 'wants_insurance':
      return {
        subject: 'Therapie ohne Krankenkasseneintrag \u2014 dein Vorteil',
        preheader: 'Kein Eintrag, keine Wartezeit, sofort starten.',
        feedbackReason: 'insurance_preference',
        bodyHtml: `
          ${greeting}
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">wir verstehen, dass Kassentherapie erstmal naheliegend wirkt. Aber es gibt gute Gr\u00FCnde, warum viele Menschen sich bewusst f\u00FCr Selbstzahler-Therapie entscheiden:</p>
          <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); padding:20px; margin:0 0 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="padding:6px 0;font-size:15px;line-height:1.6;color:#334155 !important;">
                  <strong style="color:#16a34a !important;">\u2713</strong> <strong style="color:#0f172a !important;">Kein Eintrag</strong> in der Krankenakte
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:15px;line-height:1.6;color:#334155 !important;">
                  <strong style="color:#16a34a !important;">\u2713</strong> <strong style="color:#0f172a !important;">Keine Wartezeit</strong> \u2014 sofort starten
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:15px;line-height:1.6;color:#334155 !important;">
                  <strong style="color:#16a34a !important;">\u2713</strong> <strong style="color:#0f172a !important;">Freie Wahl</strong> der Methode und Therapeut:in
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:15px;line-height:1.6;color:#334155 !important;">
                  <strong style="color:#16a34a !important;">\u2713</strong> Kennenlernen ist <strong style="color:#0f172a !important;">kostenlos</strong>
                </td>
              </tr>
            </table>
          </div>
          ${renderButton(profileUrl, 'Kostenlosen Termin buchen')}
        `,
      };

    case 'no_availability':
      return {
        subject: 'Neue Termine verf\u00FCgbar \u2014 jetzt ansehen',
        preheader: 'Es gibt frische Termine f\u00FCr dich.',
        feedbackReason: 'profile_feedback',
        bodyHtml: `
          ${greeting}
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">als du zuletzt geschaut hast, war die Verf\u00FCgbarkeit eingeschr\u00E4nkt. Gute Nachricht: <strong style="color:#0f172a !important;">Es gibt neue Termine.</strong></p>
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Schau nochmal rein \u2014 das Kennenlernen ist kostenlos und unverbindlich:</p>
          ${renderButton(profileUrl, 'Neue Termine ansehen')}
        `,
      };

    case 'location_wrong':
      return {
        subject: 'Standort passt nicht? Die meisten Sitzungen sind online',
        preheader: 'Video-Sitzungen von zu Hause \u2014 genauso wirksam.',
        feedbackReason: 'profile_feedback',
        bodyHtml: `
          ${greeting}
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">der Standort passt nicht ideal? Kein Problem \u2014 die meisten K\u00F6rperpsychotherapie-Sitzungen finden als <strong style="color:#0f172a !important;">Video-Gespr\u00E4ch</strong> statt und sind genauso wirksam.</p>
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Probier es einfach im kostenlosen Kennenlernen aus:</p>
          ${renderButton(profileUrl, 'Kostenlosen Termin buchen')}
        `,
      };

    default:
      // Catch-all for 'other' or unknown reasons
      return {
        subject: 'Deine Empfehlung passt nicht? Sag uns warum',
        preheader: 'Dein Feedback hilft uns, bessere Vorschl\u00E4ge zu machen.',
        feedbackReason: 'profile_feedback',
        bodyHtml: `
          ${greeting}
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">wir haben gesehen, dass unsere Empfehlung nicht ganz gepasst hat. Das tut uns leid \u2014 wir wollen es besser machen.</p>
          <p style="margin:0 0 16px; font-size:16px; line-height:1.65; color:#475569 !important;">Hast du dir schon die <strong style="color:#0f172a !important;">anderen Vorschl\u00E4ge</strong> angesehen? Vielleicht ist die richtige Person dabei:</p>
          ${renderButton(profileUrl, 'Weitere Vorschl\u00E4ge ansehen')}
        `,
      };
  }
}

function renderRejected(params: BehavioralFeedbackParams): { contentHtml: string; subject: string; preheader: string } {
  const { patientName, patientId, segment } = params;
  const name = (patientName || '').trim();

  if (segment.segment !== 'rejected') {
    // Should never happen, but TypeScript needs this
    return renderVisitedNoAction(params);
  }

  const copy = getRejectionCopy(segment.reasons, name, params.matchesUrl);

  const contentHtml = `
    <div style="margin:0 0 20px;">
      ${copy.bodyHtml}
    </div>

    ${renderInterviewCta(params.segment, patientId, `feedback_behavioral_d10_rejected_${segment.reasons[0]?.reason || 'other'}`)}
  `;

  return { contentHtml, subject: copy.subject, preheader: copy.preheader };
}

// ============================================================================
// Main render function
// ============================================================================

export function renderBehavioralFeedbackEmail(params: BehavioralFeedbackParams): EmailContent {
  const { segment } = params;

  let result: { contentHtml: string; subject: string; preheader: string };

  switch (segment.segment) {
    case 'almost_booked':
      result = renderAlmostBooked(params);
      break;
    case 'never_visited':
      result = renderNeverVisited(params);
      break;
    case 'visited_no_action':
      result = renderVisitedNoAction(params);
      break;
    case 'rejected':
      result = renderRejected(params);
      break;
    default:
      // 'contacted' segment should not receive this email; fallback to visited_no_action
      result = renderVisitedNoAction(params);
      break;
  }

  const schema = {
    '@context': 'http://schema.org',
    '@type': 'EmailMessage',
    potentialAction: {
      '@type': 'ViewAction',
      name: 'Vorschl\u00E4ge ansehen',
      url: params.matchesUrl,
    },
    description: result.preheader,
  };

  return {
    subject: result.subject,
    html: renderLayout({ title: 'Kaufmann Health', contentHtml: result.contentHtml, preheader: result.preheader, schema }),
  };
}
