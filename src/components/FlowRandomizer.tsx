'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { getFlowVariant, wasFlowRandomized, type FlowVariant } from '@/lib/flow-randomization';

interface FlowRandomizerProps {
  children: (variant: FlowVariant, isRandomized: boolean) => React.ReactNode;
  /** Track the randomization event */
  onRandomized?: (variant: FlowVariant) => void;
}

/**
 * Client component that handles flow randomization for A/B testing.
 * 
 * If no ?variant= param is present, randomizes 50/50 between concierge/self-service
 * and persists the choice. Adds the variant to URL for consistent server rendering.
 */
export function FlowRandomizer({ children, onRandomized }: FlowRandomizerProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const urlVariant = searchParams.get('variant') || searchParams.get('v');
  const [variant, setVariant] = useState<FlowVariant>(() => 
    (urlVariant === 'concierge' || urlVariant === 'self-service') ? urlVariant : 'concierge'
  );
  const [isRandomized, setIsRandomized] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Get the actual variant (potentially randomized)
    const actualVariant = getFlowVariant(urlVariant);
    setVariant(actualVariant);
    
    const randomized = wasFlowRandomized(urlVariant);
    setIsRandomized(randomized);
    
    // If randomized, update URL without triggering navigation
    // This ensures consistent rendering and proper analytics attribution
    if (randomized) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('variant', actualVariant);
      
      // Use replaceState to update URL without navigation
      const newUrl = `${pathname}?${newParams.toString()}`;
      window.history.replaceState({}, '', newUrl);
      
      // Track the randomization
      onRandomized?.(actualVariant);
    }
  }, [urlVariant, searchParams, pathname, onRandomized]);

  // Prevent hydration mismatch by rendering default until mounted
  if (!mounted) {
    return <>{children('concierge', false)}</>;
  }

  return <>{children(variant, isRandomized)}</>;
}
