'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    clarity?: (command: string, ...args: unknown[]) => void;
  }
}

/**
 * Controls Clarity recording based on current route.
 * Script is loaded in layout.tsx with afterInteractive + readiness check.
 * 
 * IMPORTANT: Only use clarity('stop') for excluded pages.
 * Do NOT call clarity('start') or clarity('upgrade') on navigation —
 * these can cause session splits in SPAs.
 */
export default function ClarityLoader() {
  const pathname = usePathname();
  const wasStopped = useRef(false);
  const lastNotifiedUrl = useRef<string | null>(null);

  useEffect(() => {
    // Stop Clarity on admin pages and therapist acceptance flow (/match/[uuid])
    // Note: /matches/* (patient flow) is intentionally tracked
    const isExcluded = pathname?.startsWith('/admin') || 
      (pathname?.startsWith('/match/') && !pathname?.startsWith('/matches/'));

    const applyClarity = () => {
      if (typeof window === 'undefined' || !window.clarity) return false;
      
      if (isExcluded) {
        window.clarity('stop');
        wasStopped.current = true;
        lastNotifiedUrl.current = null;
      } else {
        if (wasStopped.current) {
          // Resume if we previously stopped (coming from excluded page)
          window.clarity('start');
          wasStopped.current = false;
        }
        
        // Notify Clarity of URL change for SPA session continuity
        // Uses window.location to avoid useSearchParams Suspense requirement
        const currentUrl = window.location.pathname + window.location.search;
        if (currentUrl !== lastNotifiedUrl.current) {
          window.clarity('set', 'page', currentUrl);
          lastNotifiedUrl.current = currentUrl;
        }
      }
      return true;
    };

    // Try immediately, then retry after Clarity loads
    if (!applyClarity()) {
      const timer = setTimeout(applyClarity, 2000);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return null;
}
