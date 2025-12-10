'use client';

import { useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getFlowVariant, wasFlowRandomized, type FlowVariant } from '@/lib/flow-randomization';
import CtaLink from '@/components/CtaLink';
import { track } from '@vercel/analytics';

interface VariantAwareCtaProps {
  /** Landing page for analytics */
  landingPage: 'start' | 'therapie-finden';
  /** Event ID for tracking */
  eventId: string;
  /** data-cta attribute */
  dataCta: string;
  /** Button label */
  label: string;
  /** Additional className */
  className?: string;
}

/**
 * CTA button that links to /fragebogen with the correct flow variant.
 * Handles client-side randomization when no ?variant= is present.
 */
export function VariantAwareCta({ landingPage, eventId, dataCta, label, className }: VariantAwareCtaProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const urlVariant = searchParams.get('variant') || searchParams.get('v');
  const [variant, setVariant] = useState<FlowVariant>('concierge');

  useEffect(() => {
    const actualVariant = getFlowVariant(urlVariant);
    setVariant(actualVariant);
    
    // If randomized, update URL (once per session)
    if (wasFlowRandomized(urlVariant)) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('variant', actualVariant);
      window.history.replaceState({}, '', `${pathname}?${newParams.toString()}`);
      
      // Track randomization
      track('flow_randomized', {
        landing_page: landingPage,
        flow_variant: actualVariant,
      });
    }
  }, [urlVariant, searchParams, pathname, landingPage]);

  const fragebogenHref = `/fragebogen?variant=${encodeURIComponent(variant)}`;

  return (
    <CtaLink
      href={fragebogenHref}
      eventType="cta_click"
      eventId={eventId}
      data-cta={dataCta}
      className={className}
    >
      {label}
    </CtaLink>
  );
}
