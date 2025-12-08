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
      } else if (wasStopped.current) {
        // Only call start if we previously stopped (resuming from excluded page)
        window.clarity('start');
        wasStopped.current = false;
      }
      // Otherwise: don't touch Clarity, let it track naturally
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
