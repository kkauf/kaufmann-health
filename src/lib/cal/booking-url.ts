/**
 * Cal.com Booking URL Builder
 *
 * Builds Cal.com booking URLs with KH metadata for attribution and tracking.
 * Metadata is passed via query params and arrives in webhook payload.
 */

const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';

export type CalBookingMetadata = {
  kh_therapist_id?: string;
  kh_patient_id?: string;
  kh_match_id?: string;
  kh_form_session_id?: string;
  kh_booking_kind?: 'intro' | 'full_session';
  kh_source?: 'directory' | 'questionnaire';
  kh_test?: boolean;
  kh_gclid?: string;
  kh_utm_source?: string;
  kh_utm_medium?: string;
  kh_utm_campaign?: string;
  kh_utm_term?: string;
  kh_utm_content?: string;
};

export type CalBookingUrlOptions = {
  calUsername: string;
  eventType?: 'intro' | 'full_session'; // Maps to Cal event type slug
  metadata?: CalBookingMetadata;
  prefillName?: string;
  prefillEmail?: string;
  /** If true, adds successRedirectUrl to redirect back to KH after booking */
  redirectBack?: boolean;
  /** Path to return to after booking confirmation (EARTH-256) */
  returnTo?: string;
  /** Pre-selected date in YYYY-MM-DD format */
  date?: string;
  /** Layout mode for Cal.com embed */
  layout?: 'mobile' | 'month_view' | 'week_view' | 'column_view';
};

/**
 * Build a Cal.com booking URL with optional metadata and prefill data.
 *
 * Example output:
 * https://cal.kaufmann.health/firstname-lastname/intro?metadata[kh_therapist_id]=xxx&name=John
 */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';

export function buildCalBookingUrl(options: CalBookingUrlOptions): string {
  const { calUsername, eventType, metadata, prefillName, prefillEmail, redirectBack, returnTo, date, layout } = options;

  // Build base URL - if eventType specified, append it as a path segment
  // Cal.com event type slugs: intro, full-session
  const eventSlug = eventType === 'intro' ? 'intro' : eventType === 'full_session' ? 'full-session' : null;
  const basePath = eventSlug ? `/${calUsername}/${eventSlug}` : `/${calUsername}`;
  
  const url = new URL(basePath, CAL_ORIGIN);
  
  // Add date as query param (Cal.com self-hosted uses ?date=YYYY-MM-DD)
  if (date) {
    url.searchParams.set('date', date);
  }

  // Add metadata as query params (Cal.com metadata[key]=value format)
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(`metadata[${key}]`, String(value));
      }
    }
  }

  // Add prefill data
  if (prefillName) {
    url.searchParams.set('name', prefillName);
  }
  if (prefillEmail) {
    url.searchParams.set('email', prefillEmail);
  }

  // Add redirect back to KH after successful booking
  if (redirectBack) {
    const redirectUrl = new URL('/booking/confirmed', BASE_URL);
    if (metadata?.kh_therapist_id) {
      redirectUrl.searchParams.set('therapist', metadata.kh_therapist_id);
    }
    if (eventType) {
      redirectUrl.searchParams.set('kind', eventType);
    }
    // EARTH-256: Include returnTo so confirmation page can redirect back to origin
    if (returnTo) {
      redirectUrl.searchParams.set('returnTo', returnTo);
    }
    url.searchParams.set('successRedirectUrl', redirectUrl.toString());
  }

  // Layout mode
  if (layout) {
    url.searchParams.set('layout', layout);
  }

  return url.toString();
}

/**
 * Check if Cal.com booking is available for a therapist
 */
export function isCalBookingEnabled(therapist: {
  cal_enabled?: boolean | null;
  cal_username?: string | null;
}): boolean {
  return Boolean(therapist.cal_enabled && therapist.cal_username);
}
