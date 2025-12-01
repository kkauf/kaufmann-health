'use client';

import { useEffect } from 'react';
import { initErrorTracking } from '@/lib/errorTracking';

/**
 * Client component that initializes error tracking on mount.
 * Add to root layout to enable tracking across all pages.
 */
export function ErrorTracker() {
  useEffect(() => {
    initErrorTracking();
  }, []);
  
  return null;
}
