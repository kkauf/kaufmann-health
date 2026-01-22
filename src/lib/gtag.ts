'use client';

import { getGclid } from '@/lib/attribution';

const GA_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

// Conversion labels from Google Ads (Goals → Conversions)
// Primary: kh_lead_verified (€12) - what Google optimizes bids against
// Secondary: form_complete (€4), intro_booked (€60), session_booked (€125)
const LABEL_FORM_COMPLETE = process.env.NEXT_PUBLIC_GAD_CONV_FORM_COMPLETE;
const LABEL_VERIFIED = process.env.NEXT_PUBLIC_GAD_CONV_VERIFIED;
const LABEL_INTRO_BOOKED = process.env.NEXT_PUBLIC_GAD_CONV_INTRO_BOOKED;
const LABEL_SESSION_BOOKED = process.env.NEXT_PUBLIC_GAD_CONV_SESSION_BOOKED;
const LABEL_THERAPIST = process.env.NEXT_PUBLIC_GAD_CONV_THERAPIST;

function isTestMode(): boolean {
  try {
    const cookie = document.cookie || '';
    return cookie.split(';').some((p) => {
      const [k, v] = p.trim().split('=');
      return k === 'kh_test' && v === '1';
    });
  } catch {
    return false;
  }
}

/**
 * Track conversion attempt for observability (fire-and-forget)
 */
function trackConversionAttempt(label: string, transactionId?: string, hasGclid?: boolean, gtagAvailable?: boolean) {
  try {
    const body = JSON.stringify({
      type: 'gtag_conversion_attempted',
      // IMPORTANT: API expects 'properties' not 'props'
      properties: { label, transaction_id: transactionId, has_gclid: hasGclid, gtag_available: gtagAvailable },
    });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/events', blob);
    }
  } catch {}
}

/**
 * Build page_location with gclid for attribution.
 * If gclid is stored in sessionStorage but not in current URL, we construct
 * a synthetic page_location that includes it for gtag attribution.
 */
function getPageLocationWithGclid(): string | undefined {
  try {
    const storedGclid = getGclid();
    if (!storedGclid) return undefined;
    
    // Check if gclid is already in current URL
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has('gclid')) {
      return undefined; // Already present, gtag will use it
    }
    
    // Append stored gclid to current URL for attribution
    currentUrl.searchParams.set('gclid', storedGclid);
    return currentUrl.href;
  } catch {
    return undefined;
  }
}

/**
 * Send conversion to Google Ads via gtag.
 * 
 * IMPORTANT: We always fire the conversion - Google's Consent Mode v2 handles privacy:
 * - With ad_storage: 'denied' → cookieless ping sent, limited attribution
 * - With ad_storage: 'granted' → full tracking with cookies
 * 
 * We pass page_location with gclid to ensure attribution works even after
 * SPA navigation loses the gclid from the URL.
 */
function sendConversion({ label, value, transactionId, dedupePrefix }: { label?: string; value: number; transactionId?: string; dedupePrefix: string }) {
  try {
    if (!GA_ID || !label) return;
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production' && isTestMode()) return;

    const key = transactionId ? `${dedupePrefix}${transactionId}` : dedupePrefix;
    try {
      if (window.sessionStorage.getItem(key) === '1') return; // Already fired
    } catch {}

    const sendTo = `${GA_ID}/${label}`;
    const payload: Record<string, unknown> = { send_to: sendTo, value, currency: 'EUR' };
    if (transactionId) payload.transaction_id = transactionId;
    
    // Include page_location with gclid for attribution (critical for SPA)
    const pageLocationWithGclid = getPageLocationWithGclid();
    if (pageLocationWithGclid) {
      payload.page_location = pageLocationWithGclid;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).gtag as ((...args: any[]) => void) | undefined;
    const gtagAvailable = typeof g === 'function';
    
    if (gtagAvailable) {
      // Use beacon transport to ensure conversion sends even if page navigates away
      g('event', 'conversion', { ...payload, transport_type: 'beacon' });
    } else {
      // Fallback: push to dataLayer (gtag.js will process when loaded)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push(['event', 'conversion', { ...payload, transport_type: 'beacon' }]);
    }
    
    // Also fire a direct pixel as belt-and-suspenders (survives navigation)
    try {
      const pixelUrl = new URL('https://www.googleadservices.com/pagead/conversion/' + GA_ID?.replace('AW-', '') + '/');
      pixelUrl.searchParams.set('label', label);
      pixelUrl.searchParams.set('value', String(value));
      pixelUrl.searchParams.set('currency', 'EUR');
      if (transactionId) pixelUrl.searchParams.set('oid', transactionId);
      if (pageLocationWithGclid) pixelUrl.searchParams.set('url', pageLocationWithGclid);
      // Use sendBeacon for reliability
      if (navigator.sendBeacon) {
        navigator.sendBeacon(pixelUrl.toString());
      } else {
        new Image().src = pixelUrl.toString();
      }
    } catch {}

    // Track attempt for observability - include whether gtag was available
    trackConversionAttempt(label, transactionId, !!pageLocationWithGclid || !!getGclid(), gtagAvailable);

    try {
      window.sessionStorage.setItem(key, '1');
    } catch {}
  } catch {}
}

/**
 * Fire when questionnaire form is completed (before verification)
 * Value: €4 (secondary conversion)
 */
export function fireFormCompleteConversion(patientId?: string) {
  sendConversion({ label: LABEL_FORM_COMPLETE, value: 4, transactionId: patientId, dedupePrefix: 'ga_conv_form_complete' });
}

/**
 * Fire when user verifies their contact info (email/SMS)
 * Value: €12 (PRIMARY conversion - Google optimizes bids against this)
 */
export function fireLeadVerifiedConversion(patientId?: string) {
  sendConversion({ label: LABEL_VERIFIED, value: 12, transactionId: patientId, dedupePrefix: 'ga_conv_lead_verified' });
}

/**
 * Fire when intro/consultation booking is made
 * Value: €60 (secondary conversion)
 */
export function fireIntroBookedConversion(bookingId?: string) {
  sendConversion({ label: LABEL_INTRO_BOOKED, value: 60, transactionId: bookingId, dedupePrefix: 'ga_conv_intro_booked' });
}

/**
 * Fire when full session booking is made
 * Value: €125 (secondary conversion - expected CLV)
 */
export function fireSessionBookedConversion(bookingId?: string) {
  sendConversion({ label: LABEL_SESSION_BOOKED, value: 125, transactionId: bookingId, dedupePrefix: 'ga_conv_session_booked' });
}

/**
 * Fire when therapist submits application
 * Value: €25 (legacy)
 */
export function fireGoogleAdsTherapistConversion(leadId?: string) {
  sendConversion({ label: LABEL_THERAPIST, value: 25, transactionId: leadId, dedupePrefix: 'ga_conv_therapist_registration' });
}

/**
 * Fire base conversion AND trigger server-side Enhanced Conversion.
 *
 * CRITICAL: This is the correct flow for Enhanced Conversions:
 * 1. Fire client-side gtag base conversion FIRST
 * 2. Then trigger server-side enhancement via API
 *
 * The base conversion must be received by Google before the enhancement
 * can be matched to it (via orderId/transaction_id).
 *
 * @param patientId - Patient UUID used as transaction_id for matching
 * @param verificationMethod - 'email' or 'sms' for tracking
 */
export async function fireLeadVerifiedWithEnhancement(
  patientId: string | undefined,
  verificationMethod: 'email' | 'sms' = 'email'
): Promise<void> {
  try {
    // Step 1: Fire client-side base conversion immediately
    // This sends the conversion to Google via gtag with transaction_id
    fireLeadVerifiedConversion(patientId);

    // Step 2: Trigger server-side enhancement
    // The network round-trip provides a small natural delay, giving Google
    // time to process the base conversion before receiving the enhancement
    if (patientId) {
      try {
        const body = JSON.stringify({
          patient_id: patientId,
          verification_method: verificationMethod,
        });

        // Use sendBeacon for reliability (survives page navigation)
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' });
          navigator.sendBeacon('/api/public/conversions/enhance', blob);
        } else {
          // Fallback to fetch with keepalive
          void fetch('/api/public/conversions/enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
          });
        }
      } catch {
        // Enhancement failure is non-blocking; base conversion was already sent
      }
    }
  } catch {
    // Ignore errors - conversion tracking should never break the user flow
  }
}
