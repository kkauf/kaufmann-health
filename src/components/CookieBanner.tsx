'use client';

import * as React from 'react';
import CookieConsent from 'react-cookie-consent';
import Link from 'next/link';
import { CONSENT_COOKIE_NAME } from '@/lib/consent-constants';

/**
 * GDPR cookie banner using react-cookie-consent.
 * - Stores consent in cookie name defined by CONSENT_COOKIE_NAME
 * - Provides a global event "open-cookie-settings" to reopen the banner
 */
export default function CookieBanner() {
  const [forceVisible, setForceVisible] = React.useState(false);

  React.useEffect(() => {
    const onOpen = () => setForceVisible(true);
    window.addEventListener('open-cookie-settings', onOpen);
    return () => window.removeEventListener('open-cookie-settings', onOpen);
  }, []);

  const commonBtn = 'px-3 py-2 rounded-md text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70';

  return (
    <CookieConsent
      visible={forceVisible ? 'show' : 'byCookieValue'}
      location="bottom"
      disableStyles
      containerClasses="fixed bottom-0 inset-x-0 z-50 bg-gray-900/95 backdrop-blur text-white"
      contentClasses="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      buttonText="Akzeptieren"
      declineButtonText="Ablehnen"
      enableDeclineButton
      buttonClasses={`${commonBtn} bg-white text-gray-900 hover:bg-gray-100`}
      declineButtonClasses={`${commonBtn} bg-gray-700 text-white hover:bg-gray-600`}
      cookieName={CONSENT_COOKIE_NAME}
      cookieValue="true"
      declineCookieValue="false"
      expires={180}
      onAccept={() => setForceVisible(false)}
      onDecline={() => setForceVisible(false)}
    >
      <span className="text-sm leading-relaxed">
        Wir verwenden technisch notwendige Cookies sowie optionale, anonymisierte Messungen für eine bessere Nutzererfahrung. 
        Sie können zustimmen oder ablehnen. Mehr erfahren in unserer{' '}
        <Link href="/datenschutz" className="underline underline-offset-4 text-white hover:text-gray-200">Datenschutzerklärung</Link>.
      </span>
    </CookieConsent>
  );
}
