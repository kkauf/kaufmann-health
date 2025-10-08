'use client';

import { useCallback, useEffect, useState } from 'react';

function sendEvent(type: string) {
  try {
    const body = JSON.stringify({ type });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/events', blob);
    } else {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    }
  } catch {}
}

function applyAdConsentDenied() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).gtag as ((...args: any[]) => void) | undefined;
    if (typeof g === 'function') {
      g('consent', 'update', {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      // Optionally re-configure to ensure linker does not operate post-withdrawal
      if (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID) {
        g('config', process.env.NEXT_PUBLIC_GOOGLE_ADS_ID, {
          allow_ad_personalization_signals: false,
          conversion_linker: false,
          url_passthrough: true,
        });
      }
    }
  } catch {}
}

function applyAdConsentGranted() {
  try {
    // gtag placeholder should exist via layout's inline init script
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).gtag as ((...args: any[]) => void) | undefined;
    if (typeof g === 'function') {
      g('consent', 'update', {
        ad_storage: 'granted',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      // Ensure conversion_linker plugin is (re)applied after granting consent
      if (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID) {
        g('config', process.env.NEXT_PUBLIC_GOOGLE_ADS_ID, {
          allow_ad_personalization_signals: false,
          conversion_linker: true,
          url_passthrough: true,
        });
      }
    }
  } catch {}
}

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // If GA ID is not configured, never show the banner
    if (!process.env.NEXT_PUBLIC_GOOGLE_ADS_ID) {
      setShow(false);
      return;
    }
    try {
      const val = localStorage.getItem('ga-consent');
      if (val === null) {
        setShow(true);
      } else if (val === 'accepted') {
        applyAdConsentGranted();
        setShow(false);
      } else {
        setShow(false);
      }
    } catch {
      // If localStorage not available, default to showing banner
      setShow(true);
    }
  }, []);

  useEffect(() => {
    const handler = () => setShow(true);
    try {
      window.addEventListener('open-cookie-settings', handler);
    } catch {}
    return () => {
      try {
        window.removeEventListener('open-cookie-settings', handler);
      } catch {}
    };
  }, []);

  const onAccept = useCallback(() => {
    try {
      localStorage.setItem('ga-consent', 'accepted');
    } catch {}
    applyAdConsentGranted();
    sendEvent('cookie_consent_accepted');
    try {
      // Notify listeners (e.g., GtagLoader) that consent was granted
      window.dispatchEvent(new Event('ga-consent-accepted'));
    } catch {}
    setShow(false);
  }, []);

  const onReject = useCallback(() => {
    try {
      localStorage.setItem('ga-consent', 'rejected');
    } catch {}
    applyAdConsentDenied();
    sendEvent('cookie_consent_rejected');
    setShow(false);
  }, []);

  if (!process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || !show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200/60 shadow-2xl bg-white/95 backdrop-blur-lg supports-[backdrop-filter]:bg-white/90">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-5 p-5 sm:p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm sm:text-base leading-relaxed text-gray-800">
          Für eine bessere Zuordnung von Werbeklicks zu erfolgreichen Formularsendungen können wir einen Conversion‑Linker (Google Ads) einsetzen.
          Keine Analytics‑Cookies. Mehr Infos in unserer{' '}
          <a href="/datenschutz#cookies" className="underline decoration-emerald-300 underline-offset-4 hover:text-emerald-700 hover:decoration-emerald-600 transition-colors font-medium">Datenschutzerklärung</a>.
        </p>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onReject}
            className="flex-1 sm:flex-none rounded-lg border-2 border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            Ablehnen
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 sm:flex-none rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/40 transition-all duration-200"
          >
            Akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
