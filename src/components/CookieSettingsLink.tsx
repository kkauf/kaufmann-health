'use client';

import * as React from 'react';

/**
 * Button-like link that reopens the cookie settings banner.
 * Dispatches a window event consumed by CookieBanner.
 */
export default function CookieSettingsLink({ className }: { className?: string }) {
  const onClick = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('open-cookie-settings'));
    }
  }, []);

  return (
    <button type="button" onClick={onClick} className={className || 'hover:text-gray-900 underline decoration-gray-300 underline-offset-4'}>
      Cookie-Einstellungen
    </button>
  );
}
