'use client';

const GA_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const LABEL_CLIENT = process.env.NEXT_PUBLIC_GAD_CONV_CLIENT;
const COOKIES_ENABLED = (process.env.NEXT_PUBLIC_COOKIES || '').toLowerCase() === 'true';

export function fireGoogleAdsClientConversion(leadId?: string) {
  try {
    if (!GA_ID || !LABEL_CLIENT) return;
    if (typeof window === 'undefined') return;

    if (COOKIES_ENABLED) {
      try {
        if (localStorage.getItem('ga-consent') !== 'accepted') return;
      } catch {}
    }

    const dedupeKey = leadId ? `ga_conv_client_registration${leadId}` : 'ga_conv_client_registration';
    try {
      if (window.sessionStorage.getItem(dedupeKey) === '1') return;
      if (window.localStorage.getItem(dedupeKey) === '1') return;
    } catch {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).gtag as ((...args: any[]) => void) | undefined;
    const sendTo = `${GA_ID}/${LABEL_CLIENT}`;
    const payload: Record<string, unknown> = { send_to: sendTo, value: 10, currency: 'EUR' };
    if (leadId) payload.transaction_id = leadId;

    if (typeof g === 'function') {
      g('event', 'conversion', payload);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push(['event', 'conversion', payload]);
    }

    try {
      window.sessionStorage.setItem(dedupeKey, '1');
      window.localStorage.setItem(dedupeKey, '1');
    } catch {}
  } catch {}
}
