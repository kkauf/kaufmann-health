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
 * Script is loaded in layout.tsx with afterInteractive + delay.
 * This component stops recording on sensitive pages (/admin/*, /match/*).
 * /matches/* (patient flow) is intentionally tracked.
 */
export default function ClarityLoader() {
  const pathname = usePathname();

  useEffect(() => {
    // Stop Clarity on admin pages and therapist acceptance flow (/match/[uuid])
    // Note: /matches/* (patient flow) is intentionally tracked
    const isExcluded = pathname?.startsWith('/admin') || 
      (pathname?.startsWith('/match/') && !pathname?.startsWith('/matches/'));

    const applyClarity = () => {
      if (typeof window === 'undefined' || !window.clarity) return false;
      
      if (isExcluded) {
        window.clarity('stop');
      } else {
        window.clarity('start');
      }
      return true;
    };

    // Try immediately, then retry after Clarity loads (1.5s to account for init delay)
    if (!applyClarity()) {
      const timer = setTimeout(applyClarity, 1500);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return null;
}
