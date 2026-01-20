'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import clarity from '@microsoft/clarity';

declare global {
  interface Window {
    clarity?: (command: string, ...args: unknown[]) => void;
    clarityInitialized?: boolean;
  }
}

/**
 * Initializes and controls Clarity recording.
 * Uses official @microsoft/clarity SDK for proper SPA support.
 * 
 * Key: Uses clarity('event', 'pageview') on route changes to maintain
 * session continuity instead of relying on auto-detection which can
 * cause session splits in Next.js apps.
 */
export default function ClarityLoader() {
  const pathname = usePathname();
  const isExcludedRef = useRef(false);

  // Check if should exclude recording entirely
  const shouldExcludeRecording = () => {
    if (typeof window === 'undefined') return true;
    // Check kh_test cookie
    if (document.cookie.split(';').some(c => c.trim().startsWith('kh_test=1'))) return true;
    // Check localhost
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return true;
    // Check staging/preview
    if (h.includes('.vercel.app') || h.includes('staging') || h.includes('preview')) return true;
    // Check admin pages and therapist acceptance flow (/match/[uuid])
    if (pathname?.startsWith('/admin')) return true;
    if (pathname?.startsWith('/match/') && !pathname?.startsWith('/matches/')) return true;
    return false;
  };

  // Initialize Clarity once
  useEffect(() => {
    const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    if (!projectId || window.clarityInitialized) return;

    if (shouldExcludeRecording()) {
      console.log('[Clarity] Excluded: test/localhost/staging/admin');
      isExcludedRef.current = true;
      return;
    }

    // Initialize using official SDK
    clarity.init(projectId);
    window.clarityInitialized = true;
    console.log('[Clarity] Initialized');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track SPA page navigation
  useEffect(() => {
    // Skip if excluded or not initialized
    if (isExcludedRef.current || !window.clarityInitialized) return;
    
    // Re-check exclusion on route change (e.g., navigating to admin)
    if (shouldExcludeRecording()) {
      if (window.clarity) {
        window.clarity('stop');
        isExcludedRef.current = true;
        console.log('[Clarity] Stopped: navigated to excluded page');
      }
      return;
    }

    // Fire pageview event for SPA navigation
    if (typeof window.clarity === 'function') {
      window.clarity('event', 'pageview');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
