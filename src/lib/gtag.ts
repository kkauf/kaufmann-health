'use client';

const GA_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const LABEL_CLIENT = process.env.NEXT_PUBLIC_GAD_CONV_CLIENT;
const LABEL_THERAPIST = process.env.NEXT_PUBLIC_GAD_CONV_THERAPIST;
const LABEL_BOOKING = process.env.NEXT_PUBLIC_GAD_CONV_BOOKING;
const COOKIES_ENABLED = (process.env.NEXT_PUBLIC_COOKIES || '').toLowerCase() === 'true';

function consentGranted(): boolean {
  if (!COOKIES_ENABLED) return true; // cookieless allowed
  try {
    return localStorage.getItem('ga-consent') === 'accepted';
  } catch {
    return false;
  }
}

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

function sendConversion({ label, value, transactionId, dedupePrefix }: { label?: string; value: number; transactionId?: string; dedupePrefix: string }) {
  try {
    if (!GA_ID || !label) return;
    if (typeof window === 'undefined') return;
    if (!consentGranted()) return;
    if (isTestMode()) return;

    const key = transactionId ? `${dedupePrefix}${transactionId}` : dedupePrefix;
    try {
      if (window.sessionStorage.getItem(key) === '1') return;
      if (window.localStorage.getItem(key) === '1') return;
    } catch {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).gtag as ((...args: any[]) => void) | undefined;
    const sendTo = `${GA_ID}/${label}`;
    const payload: Record<string, unknown> = { send_to: sendTo, value, currency: 'EUR' };
    if (transactionId) payload.transaction_id = transactionId;

    if (typeof g === 'function') {
      g('event', 'conversion', payload);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push(['event', 'conversion', payload]);
    }

    try {
      window.sessionStorage.setItem(key, '1');
      window.localStorage.setItem(key, '1');
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
