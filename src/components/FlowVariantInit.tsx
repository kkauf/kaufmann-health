'use client';

import { useEffect } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { getFlowVariant, wasFlowRandomized } from '@/lib/flow-randomization';
import { track } from '@vercel/analytics';

interface FlowVariantInitProps {
  /** Landing page for analytics */
  landingPage: 'start' | 'therapie-finden';
}

/**
 * Initializes flow variant on page load.
 * If no ?variant= param, randomizes 50/50 and updates URL.
 * Place once per landing page.
 */
export function FlowVariantInit({ landingPage }: FlowVariantInitProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  useEffect(() => {
    const urlVariant = searchParams.get('variant') || searchParams.get('v');
    
    // Only randomize if no explicit variant
    if (wasFlowRandomized(urlVariant)) {
      const variant = getFlowVariant(urlVariant);
      
      // Update URL with randomized variant
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('variant', variant);
      window.history.replaceState({}, '', `${pathname}?${newParams.toString()}`);
      
      // Track the randomization
      track('flow_randomized', {
        landing_page: landingPage,
        flow_variant: variant,
      });
    }
  }, [searchParams, pathname, landingPage]);

  return null;
}
