'use client';

import { getGclid } from '@/lib/attribution';

const GA_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const LABEL_CLIENT = process.env.NEXT_PUBLIC_GAD_CONV_CLIENT;
const LABEL_THERAPIST = process.env.NEXT_PUBLIC_GAD_CONV_THERAPIST;
const LABEL_BOOKING = process.env.NEXT_PUBLIC_GAD_CONV_BOOKING;

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
function trackConversionAttempt(label: string, transactionId?: string, hasGclid?: boolean) {
  try {
    const body = JSON.stringify({
      type: 'gtag_conversion_attempted',
      // IMPORTANT: API expects 'properties' not 'props'
      properties: { label, transaction_id: transactionId, has_gclid: hasGclid },
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
    if (typeof g === 'function') {
      g('event', 'conversion', payload);
    } else {
      // Fallback: push to dataLayer (gtag.js will process when loaded)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({ event: 'conversion', ...payload });
    }

    // Track attempt for observability
    trackConversionAttempt(label, transactionId, !!pageLocationWithGclid || !!getGclid());

    try {
      window.sessionStorage.setItem(key, '1');
    } catch {}
  } catch {}
}

export function fireGoogleAdsClientConversion(patientId?: string) {
  sendConversion({ label: LABEL_CLIENT, value: 10, transactionId: patientId, dedupePrefix: 'ga_conv_client_registration' });
}

export function fireGoogleAdsTherapistConversion(leadId?: string) {
  sendConversion({ label: LABEL_THERAPIST, value: 25, transactionId: leadId, dedupePrefix: 'ga_conv_therapist_registration' });
}

export function fireGoogleAdsBookingConversion(bookingId?: string) {
  // Keep value aligned with current policy; can be adjusted later
  sendConversion({ label: LABEL_BOOKING, value: 10, transactionId: bookingId, dedupePrefix: 'ga_conv_booking' });
}
