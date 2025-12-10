'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { getFlowVariant, wasFlowRandomized, type FlowVariant } from '@/lib/flow-randomization';
import { track } from '@vercel/analytics';

interface UseFlowVariantOptions {
  /** Landing page context for analytics */
  landingPage?: 'start' | 'therapie-finden';
}

interface UseFlowVariantResult {
  variant: FlowVariant;
  isConcierge: boolean;
  fragebogenHref: string;
  isRandomized: boolean;
  mounted: boolean;
}

/**
 * Hook that provides the current flow variant, handling client-side randomization.
 * Updates URL with randomized variant for consistent attribution.
 */
export function useFlowVariant(options: UseFlowVariantOptions = {}): UseFlowVariantResult {
  const { landingPage } = options;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const urlVariant = searchParams.get('variant') || searchParams.get('v');
  const [variant, setVariant] = useState<FlowVariant>('concierge');
  const [mounted, setMounted] = useState(false);
  const [isRandomized, setIsRandomized] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const actualVariant = getFlowVariant(urlVariant);
    setVariant(actualVariant);
    
    const randomized = wasFlowRandomized(urlVariant);
    setIsRandomized(randomized);
    
    // If randomized, update URL and track
    if (randomized) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('variant', actualVariant);
      window.history.replaceState({}, '', `${pathname}?${newParams.toString()}`);
      
      // Track randomization event
      if (landingPage) {
        track('flow_randomized', {
          landing_page: landingPage,
          flow_variant: actualVariant,
        });
      }
    }
  }, [urlVariant, searchParams, pathname, landingPage]);

  return {
    variant,
    isConcierge: variant === 'concierge',
    fragebogenHref: `/fragebogen?variant=${encodeURIComponent(variant)}`,
    isRandomized,
    mounted,
  };
}
