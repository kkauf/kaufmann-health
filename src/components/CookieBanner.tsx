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
    sendEvent('cookie_consent_rejected');
    setShow(false);
  }, []);

  if (!process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || !show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-800">
          Für eine bessere Zuordnung von Werbeklicks zu erfolgreichen Formularsendungen können wir einen Conversion‑Linker (Google Ads) einsetzen.
          Keine Analytics‑Cookies. Mehr Infos in unserer{' '}
          <a href="/datenschutz#cookies" className="underline">Datenschutzerklärung</a>.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReject}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Ablehnen
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700"
          >
            Alle akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
