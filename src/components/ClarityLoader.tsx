'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    clarity?: (command: string, ...args: unknown[]) => void;
  }
}

/**
 * Controls Clarity recording based on current route.
 * Script is loaded early in layout.tsx via beforeInteractive.
 * This component stops recording on sensitive pages (/admin/*, /match/*).
 * /matches/* (patient flow) is intentionally tracked.
 */
export default function ClarityLoader() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined' || !window.clarity) return;

    // Stop Clarity on admin pages and therapist acceptance flow (/match/[uuid])
    // Note: /matches/* (patient flow) is intentionally tracked
    const isExcluded = pathname?.startsWith('/admin') || 
      (pathname?.startsWith('/match/') && !pathname?.startsWith('/matches/'));

    if (isExcluded) {
      window.clarity('stop');
    } else {
      // Resume if navigating back to a tracked page
      window.clarity('start');
    }
  }, [pathname]);

  return null;
}
