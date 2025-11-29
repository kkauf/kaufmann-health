'use client';

import { useEffect } from 'react';

const GA_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

/**
 * IMPORTANT: We ALWAYS load gtag.js immediately regardless of consent.
 * Google's Consent Mode v2 handles privacy:
 * - With ad_storage: 'denied' → cookieless pings are sent (no cookies set)
 * - With ad_storage: 'granted' → full tracking with cookies
 * 
 * This ensures conversions can fire with attribution data (gclid) even before
 * user responds to cookie banner. Consent Mode handles the privacy correctly.
 */
function loadGtag() {
  if (!GA_ID) return;
  if (document.getElementById('gtag-lib')) return;
  const s = document.createElement('script');
  s.id = 'gtag-lib';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

export default function GtagLoader() {
  useEffect(() => {
    if (!GA_ID) return;
    // Always load gtag.js - Consent Mode handles privacy
    loadGtag();
  }, []);

  return null;
}
