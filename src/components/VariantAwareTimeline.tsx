'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { getFlowVariant, wasFlowRandomized, type FlowVariant } from '@/lib/flow-randomization';
import { ProcessTimeline } from '@/features/landing/components/ProcessTimeline';
import { MessageCircle, UserCheck, CalendarCheck } from 'lucide-react';
import { track } from '@vercel/analytics';

interface VariantAwareTimelineProps {
  /** Landing page context for analytics */
  landingPage: 'start' | 'therapie-finden';
  /** Heading text */
  heading?: string;
}

/**
 * Client component that renders ProcessTimeline with flow-variant-aware content.
 * Handles client-side randomization when no ?variant= is present.
 */
export function VariantAwareTimeline({ landingPage, heading }: VariantAwareTimelineProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const urlVariant = searchParams.get('variant') || searchParams.get('v');
  const [variant, setVariant] = useState<FlowVariant>('concierge');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const actualVariant = getFlowVariant(urlVariant);
    setVariant(actualVariant);
    
    // If randomized, update URL and track
    if (wasFlowRandomized(urlVariant)) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.set('variant', actualVariant);
      window.history.replaceState({}, '', `${pathname}?${newParams.toString()}`);
      
      // Track randomization event
      track('flow_randomized', {
        landing_page: landingPage,
        flow_variant: actualVariant,
      });
    }
  }, [urlVariant, searchParams, pathname, landingPage]);

  const isConcierge = variant === 'concierge';

  const tagline = isConcierge
    ? 'Handverlesene Vorschläge innerhalb von 24 Stunden. Deine Daten bleiben privat.'
    : 'Sofort passende Vorschläge basierend auf deinen Angaben. Deine Daten bleiben privat.';

  const items = isConcierge
    ? [
        {
          icon: <MessageCircle className="h-5 w-5" />,
          title: 'Deine Präferenzen',
          caption: '3 Minuten',
          bullets: ['Du sagst uns, was dir wichtig ist — online oder vor Ort, zeitliche Verfügbarkeit, was dich belastet.'],
        },
        {
          icon: <UserCheck className="h-5 w-5" />,
          title: 'Unsere persönliche Auswahl',
          caption: '24 Stunden',
          bullets: ['Bis zu 3 passende Profile, von uns handverlesen für deine Situation.'],
        },
        {
          icon: <CalendarCheck className="h-5 w-5" />,
          title: 'Du entscheidest',
          caption: 'Direkter Kontakt',
          bullets: ['Wunschtherapeut:in wählen und direkt Termin vereinbaren.'],
        },
      ]
    : [
        {
          icon: <MessageCircle className="h-5 w-5" />,
          title: 'Deine Präferenzen',
          caption: '3 Minuten',
          bullets: ['Du sagst uns, was dir wichtig ist — online oder vor Ort, zeitliche Verfügbarkeit, was dich belastet.'],
        },
        {
          icon: <UserCheck className="h-5 w-5" />,
          title: 'Passende Ergebnisse',
          caption: 'Sofort',
          bullets: ['Wir zeigen dir bis zu 3 passende Profile aus unserem geprüften Netzwerk.'],
        },
        {
          icon: <CalendarCheck className="h-5 w-5" />,
          title: 'Termin buchen',
          caption: 'Direkt online',
          bullets: ['Buche deinen ersten Termin direkt online. Keine Überweisung nötig. Start als Selbstzahler:in.'],
        },
      ];

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <ProcessTimeline
        heading={heading}
        tagline={tagline}
        items={items}
      />
    );
  }

  return (
    <ProcessTimeline
      heading={heading}
      tagline={tagline}
      items={items}
    />
  );
}
