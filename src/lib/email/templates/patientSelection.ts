import { renderLayout, renderButton } from '../layout';
import type { EmailContent } from '../types';
import { renderTherapistPreviewEmail, renderEnhancedTherapistPreviewEmail } from '../components/therapistPreview';

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export type PatientSelectionItem = {
  id: string; // therapist id
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  modalities?: string[] | null;
  /** @legacy Free-text therapist approach description from early onboarding */
  approach_text?: string | null;
  accepting_new?: boolean | null;
  city?: string | null;
  selectUrl: string; // absolute URL (deprecated - use profileUrl)
  isBest?: boolean;
  // Enhanced profile fields for higher-fidelity email
  next_intro_slot?: { date_iso: string; time_label: string; time_utc?: string } | null;
  cal_username?: string | null;
  typical_rate?: number | null;
  /** @legacy Free-text qualification description */
  qualification?: string | null;
  /** @legacy Free-text describing typical clients */
  who_comes_to_me?: string | null;
  /** @legacy Free-text about session focus areas */
  session_focus?: string | null;
  /** @legacy Free-text about what to expect in first session */
  first_session?: string | null;
  languages?: string[] | null;
  profileUrl?: string; // link to matches page
  calBookingUrl?: string; // direct Cal.com booking link (pre-built)
};

export function renderPatientSelectionEmail(params: {
  patientName?: string | null;
  items: PatientSelectionItem[];
  subjectOverride?: string;
  bannerOverrideHtml?: string; // optional custom banner instead of default urgency box
  matchesUrl?: string; // optional: link to the pre-auth matches page
  personalizedMessage?: string; // optional: personalized concierge message shown prominently
}): EmailContent {
  const name = (params.patientName || '').trim();
  const items = Array.isArray(params.items) ? params.items : [];
  const personalizedMessage = (params.personalizedMessage || '').trim();
  
  // Get the best/featured therapist for hero display
  const bestItem = items.find(it => it.isBest) || items[0];
  const hasCalBooking = Boolean(bestItem?.calBookingUrl && bestItem?.next_intro_slot);
  
  // Dynamic subject based on therapist name
  const dynamicSubject = bestItem 
    ? `${bestItem.first_name} wartet auf dich – kostenloser Intro-Termin`
    : 'Dein kostenloser Intro-Termin wartet';
 
  // Conversion-focused header - action oriented
  const header = hasCalBooking
    ? `<h1 style="color:#0f172a !important; font-size:26px; font-weight:700; margin:0 0 8px; line-height:1.3; letter-spacing:-0.02em; text-align:center;">Dein nächster Schritt: Kennenlernen</h1>
       <p style="margin:0 0 24px; font-size:15px; color:#64748b !important; text-align:center;">Kostenlos • 15 Minuten • Unverbindlich</p>`
    : `<h1 style="color:#0f172a !important; font-size:26px; font-weight:700; margin:0 0 16px; line-height:1.3; letter-spacing:-0.02em;">Deine Therapeuten-Empfehlung</h1>`;

  const greetingHtml = name 
    ? `<p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">Hallo ${escapeHtml(name)},</p>` 
    : '';
 
  // Personalized concierge message (compact)
  const personalizedBox = personalizedMessage
    ? `
      <div style="background:#f8fafc !important; padding:16px 20px; border-radius:10px; border-left:4px solid #3b82f6; margin:0 0 24px;">
        <p style="margin:0; font-size:15px; line-height:1.6; color:#334155 !important;"><strong style="color:#1e40af !important;">Katherine:</strong> ${escapeHtml(personalizedMessage)}</p>
      </div>
    `
    : '';

  // "What to expect" box - addresses objections, builds confidence
  const whatToExpectBox = hasCalBooking ? `
    <div style="background:#fafafa !important; padding:20px 24px; border-radius:12px; margin:24px 0 0;">
      <div style="font-weight:600; font-size:15px; color:#0f172a !important; margin-bottom:12px;">Was erwartet dich im Intro-Gespräch?</div>
      <div style="font-size:14px; line-height:1.7; color:#475569 !important;">
        <div style="margin-bottom:8px;">✓ Du lernst ${bestItem ? escapeHtml(bestItem.first_name) : 'deine:n Therapeut:in'} kennen</div>
        <div style="margin-bottom:8px;">✓ Ihr besprecht, ob die Chemie stimmt</div>
        <div style="margin-bottom:8px;">✓ Keine Kosten, keine Verpflichtung</div>
        <div>✓ Jederzeit absagbar</div>
      </div>
    </div>
  ` : '';
 
  // Legacy elements (for backward compatibility when no Cal booking)
  const matchesCtaUrl = params.matchesUrl ? `${params.matchesUrl}?direct=1&utm_source=email&utm_medium=transactional&utm_campaign=patient_selection` : null;
  const matchesCta = (!hasCalBooking && matchesCtaUrl)
    ? `
      <div style="margin: 24px 0; text-align: center;">
        ${renderButton(matchesCtaUrl, 'Therapeut:in kennenlernen')}
      </div>
    `
    : '';
 
  // Quality seal - compact
  const qualitySeal = `
    <div style="text-align:center; margin-top:24px; padding-top:20px; border-top:1px solid #e2e8f0;">
      <div style="font-size:13px; color:#64748b !important;">
        ✓ Geprüfte Qualifikationen • ✓ Persönlich ausgewählt • ✓ Schnelle Terminvergabe
      </div>
    </div>
  `;

  // Hide verbose trust box in enhanced mode
  const trustBox = hasCalBooking ? '' : `
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; background-image: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important; padding:16px 20px; border-radius:12px; border:1px solid rgba(226, 232, 240, 0.8); margin:0 0 20px; box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);">
      <p style="margin:0; font-size:14px; line-height:1.6; color:#475569 !important;">Wir haben diese Empfehlung sorgfältig auf Basis deiner Präferenzen ausgewählt. Qualifikationen und Verfügbarkeit sind geprüft.</p>
    </div>
  `;

  // Legacy quality box (hidden in enhanced mode)
  const qualityBox = params.bannerOverrideHtml ?? '';
 
  // Quality matching framing (simplified for enhanced mode)
  const matchingLine = hasCalBooking ? '' : `
    <p style="margin:0 0 20px; font-size:16px; line-height:1.65; color:#475569 !important;">Basierend auf deinen Angaben haben wir folgende Empfehlung für dich:</p>
  `;

  const cardsHtml = items
    .map((it) => {
      // Use enhanced preview if new profile fields are available (calBookingUrl or next_intro_slot)
      const useEnhanced = Boolean(it.calBookingUrl || it.next_intro_slot || it.profileUrl);
      
      let preview: string;
      if (useEnhanced) {
        // Enhanced preview with direct booking CTA and rich profile data
        preview = renderEnhancedTherapistPreviewEmail({
          id: it.id,
          first_name: it.first_name,
          last_name: it.last_name,
          photo_url: it.photo_url,
          modalities: it.modalities || [],
          approach_text: it.approach_text || '',
          accepting_new: it.accepting_new ?? null,
          city: it.city || null,
          next_intro_slot: it.next_intro_slot,
          qualification: it.qualification,
          who_comes_to_me: it.who_comes_to_me,
          session_focus: it.session_focus,
          first_session: it.first_session,
          typical_rate: it.typical_rate,
          languages: it.languages,
          calBookingUrl: it.calBookingUrl,
          profileUrl: it.profileUrl || it.selectUrl,
          isBest: it.isBest,
        });
      } else {
        // Legacy preview with select button
        const button = renderButton(it.selectUrl, '✓ Diese:n Therapeut:in auswählen');
        preview = renderTherapistPreviewEmail({
          id: it.id,
          first_name: it.first_name,
          last_name: it.last_name,
          photo_url: it.photo_url,
          modalities: it.modalities || [],
          approach_text: it.approach_text || '',
          accepting_new: it.accepting_new ?? null,
          city: it.city || null,
          actionButtonHtml: button,
        });
      }

      // For enhanced preview, badge is handled inside the component
      const bestBadge = (!useEnhanced && it.isBest)
        ? `<div style="margin:0 0 12px 0;"><span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; background-image: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; color:#ffffff !important; padding:6px 12px; border-radius:999px; font-size:13px; font-weight:700; display:inline-block; box-shadow: 0 2px 8px 0 rgba(16, 185, 129, 0.25);">⭐ Beste Übereinstimmung</span></div>`
        : '';
      const borderColor = it.isBest ? 'rgba(16, 185, 129, 0.4)' : 'rgba(226, 232, 240, 0.8)';
      const boxShadow = it.isBest ? 'box-shadow: 0 4px 12px 0 rgba(16, 185, 129, 0.12);' : 'box-shadow: 0 2px 4px 0 rgba(100, 116, 139, 0.05);';
      return `
        <div style="border:1px solid ${borderColor}; background:#ffffff !important; padding:20px; margin:20px 0; border-radius:12px; ${boxShadow}">
          ${bestBadge}
          ${preview}
        </div>
      `;
    })
    .join('');
 
  // Check if we're using enhanced mode (booking CTAs embedded in cards)
  const isEnhancedMode = items.some(it => it.calBookingUrl || it.next_intro_slot || it.profileUrl);

  // Action guidance - only for legacy mode (enhanced has CTA in card)
  const actionGuidance = isEnhancedMode
    ? ''
    : `<p style="margin:12px 0 0; font-size:15px; line-height:1.65; color:#64748b !important;">Mit einem Klick reservierst du unverbindlich den nächsten Schritt.</p>`;
 
  // Closing - compact for enhanced mode
  const closingHtml = hasCalBooking
    ? `<p style="margin:20px 0 0; font-size:14px; line-height:1.6; color:#64748b !important; text-align:center;">Fragen? Antworte einfach auf diese E-Mail.<br/>Dein Team von Kaufmann Health</p>`
    : `<p style="margin:24px 0 0; font-size:16px; line-height:1.65; color:#475569 !important;">Herzliche Grüße<br/><strong style="color:#0f172a !important;">Dein Team von Kaufmann Health</strong></p>`;
 
  // Content assembly - different for enhanced vs legacy mode
  let contentHtml: string;
  if (hasCalBooking) {
    // Enhanced mode: focused on single therapist with booking CTA
    // Only show the best/featured therapist card
    const featuredCard = bestItem ? `
      <div style="border:2px solid rgba(16, 185, 129, 0.4); background:#ffffff !important; padding:24px; margin:0 0 0; border-radius:16px; box-shadow: 0 4px 16px 0 rgba(16, 185, 129, 0.12);">
        ${renderEnhancedTherapistPreviewEmail({
          id: bestItem.id,
          first_name: bestItem.first_name,
          last_name: bestItem.last_name,
          photo_url: bestItem.photo_url,
          modalities: bestItem.modalities || [],
          approach_text: bestItem.approach_text || '',
          accepting_new: bestItem.accepting_new ?? null,
          city: bestItem.city || null,
          next_intro_slot: bestItem.next_intro_slot,
          qualification: bestItem.qualification,
          who_comes_to_me: bestItem.who_comes_to_me,
          session_focus: bestItem.session_focus,
          first_session: bestItem.first_session,
          typical_rate: bestItem.typical_rate,
          languages: bestItem.languages,
          calBookingUrl: bestItem.calBookingUrl,
          profileUrl: bestItem.profileUrl || bestItem.selectUrl,
          isBest: false, // Don't show badge in hero mode
        })}
      </div>
    ` : '';
    contentHtml = [greetingHtml, personalizedBox, header, featuredCard, whatToExpectBox, qualitySeal, closingHtml].join('\n');
  } else {
    // Legacy mode: show all cards with selection buttons
    const cardsSection = params.matchesUrl ? '' : [matchingLine, cardsHtml, actionGuidance, qualityBox].join('\n');
    contentHtml = [header, greetingHtml, personalizedBox, matchesCta, trustBox, cardsSection, closingHtml].join('\n');
  }

  // Schema.org action for email clients
  const actionTarget = bestItem?.calBookingUrl || bestItem?.profileUrl || items[0]?.selectUrl;
  const schema = actionTarget
    ? {
        '@context': 'http://schema.org',
        '@type': 'EmailMessage',
        potentialAction: {
          '@type': 'ViewAction',
          target: actionTarget,
          url: actionTarget,
          name: hasCalBooking ? 'Intro-Termin buchen' : 'Therapeuten ansehen',
        },
        description: hasCalBooking ? 'Kostenloser Intro-Termin' : 'Deine Therapeuten-Empfehlung',
      }
    : undefined;

  // Dynamic preheader for better open rates
  const preheader = hasCalBooking && bestItem
    ? `${bestItem.first_name} hat Zeit für dich – 15 Min kostenlos kennenlernen`
    : 'Deine handverlesene Auswahl ist da – antworte gern bei Fragen.';

  return {
    subject: params.subjectOverride || dynamicSubject,
    html: renderLayout({ title: 'Intro-Termin', contentHtml, preheader, schema }),
  };
}
