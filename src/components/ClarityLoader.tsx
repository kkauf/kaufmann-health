'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

/**
 * Microsoft Clarity session recordings and heatmaps.
 * Loads on all public pages. Excludes /admin/* for privacy.
 * /matches/* (patient flow) is tracked; /match/* (therapist acceptance) excluded.
 * Configure additional masking (e.g., form inputs) in the Clarity dashboard.
 */
export default function ClarityLoader() {
  const pathname = usePathname();

  useEffect(() => {
    if (!CLARITY_ID) return;

    // Skip Clarity on admin pages and therapist acceptance flow (/match/[uuid])
    // Note: /matches/* (patient flow) is intentionally tracked
    if (pathname?.startsWith('/admin') || (pathname?.startsWith('/match/') && !pathname?.startsWith('/matches/'))) {
      return;
    }

    // Prevent duplicate initialization
    if (document.getElementById('clarity-script')) return;
    if (typeof window !== 'undefined' && (window as unknown as { clarity?: unknown }).clarity) return;

    // Microsoft Clarity tracking script
    (function (c: Window, l: Document, a: string, r: string, i: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c as any)[a] =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c as any)[a] ||
        function () {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-rest-params
          ((c as any)[a].q = (c as any)[a].q || []).push(arguments);
        };
      const t = l.createElement(r) as HTMLScriptElement;
      t.id = 'clarity-script';
      t.async = true;
      t.src = 'https://www.clarity.ms/tag/' + i;
      const y = l.getElementsByTagName(r)[0];
      y?.parentNode?.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }, [pathname]);

  return null;
}
