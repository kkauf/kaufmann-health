'use client';

import { useEffect } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const COOKIES_ENABLED = (process.env.NEXT_PUBLIC_COOKIES || '').toLowerCase() === 'true';

function loadGtag() {
  if (!GA_ID) return;
  if (document.getElementById('gtag-lib')) return;
  const s = document.createElement('script');
  s.id = 'gtag-lib';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  // Re-apply config when lib is present
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).gtag as ((...args: any[]) => void) | undefined;
  if (typeof g === 'function') {
    g('config', GA_ID, {
      allow_ad_personalization_signals: false,
      // Only enable conversion_linker (sets _gcl_aw) when cookies are enabled and (by our loader) consent is granted
      conversion_linker: COOKIES_ENABLED ? true : false,
      url_passthrough: true,
    });
  }
}

export default function GtagLoader() {
  useEffect(() => {
    if (!GA_ID) return;

    if (!COOKIES_ENABLED) {
      // Cookie-free mode: always load gtag to allow cookieless conversions
      loadGtag();
      return;
    }

    // Cookies-enabled mode: only load after consent
    try {
      const val = localStorage.getItem('ga-consent');
      if (val === 'accepted') {
        loadGtag();
        return;
      }
    } catch {}

    const onAccepted = () => loadGtag();
    window.addEventListener('ga-consent-accepted', onAccepted);
    // Also listen to storage events from other tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ga-consent' && e.newValue === 'accepted') {
        loadGtag();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('ga-consent-accepted', onAccepted);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return null;
}
