'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import CtaLink from '@/components/CtaLink';
import Image from 'next/image';

const LS_KEYS = {
  data: 'kh_wizard_data',
  step: 'kh_wizard_step',
} as const;

/**
 * Subtle callout inviting users to use the questionnaire for better matching.
 * Placed at the top of the therapeuten directory to offer help without being intrusive.
 * 
 * Always initiates concierge flow. If user previously completed self-service,
 * skips to the "Was bringt dich zur Therapie?" step (step 2).
 */
export function TherapistMatchCallout() {
  const [href, setHref] = React.useState<string>('/fragebogen?variant=concierge');
  React.useEffect(() => {
    try {
      // Always use concierge variant for Katherine's CTA
      const params = new URLSearchParams();
      params.set('variant', 'concierge');

      // Check if user has previously completed self-service flow
      // If so, skip to step 2 ("Was bringt dich zur Therapie?") which is the concierge-specific step
      const savedData = localStorage.getItem(LS_KEYS.data);
      const savedStep = Number(localStorage.getItem(LS_KEYS.step) || '0');
      
      if (savedData || savedStep > 1) {
        try {
          const parsed = savedData ? JSON.parse(savedData) : {};
          // User has progressed past step 1, or has self-service data (schwerpunkte)
          // Skip to step 2 so they can add the open text for concierge curation
          const hasSelfServiceData = parsed.schwerpunkte?.length > 0 || 
                                     parsed.modality_matters !== undefined ||
                                     parsed.methods?.length > 0 ||
                                     parsed.city ||
                                     parsed.session_preference;
          
          if (hasSelfServiceData || savedStep > 1) {
            params.set('startStep', '2');
          }
        } catch {}
      }

      setHref(`/fragebogen?${params.toString()}`);
    } catch {}
  }, []);

  return (
    <section
      aria-labelledby="match-callout-heading"
      className="relative mb-8 overflow-hidden rounded-2xl border border-emerald-200/40 bg-white shadow-md p-5 sm:p-6"
    >
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-emerald-50/30 via-white to-teal-50/20" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          {/* Founder photo */}
          <div className="flex-shrink-0">
            <Image
              src="/profile-pictures/katherine-clear.jpg"
              alt="Katherine Kaufmann"
              width={56}
              height={56}
              className="rounded-full object-cover object-center shadow-sm ring-2 ring-emerald-100"
              style={{ objectPosition: '50% 30%' }}
            />
          </div>

          {/* Content */}
          <div className="flex-1">
            <h2 id="match-callout-heading" className="text-base sm:text-lg font-semibold text-gray-900">
              Unsicher, wer wirklich zu dir passt?
            </h2>
            <p className="mt-1 text-sm sm:text-base text-gray-600 leading-relaxed">
              Ich schaue mir deine Anfrage persönlich an und helfe dir dabei, die richtige Therapeut:in für dich zu finden.
            </p>
            <p className="mt-2 text-xs sm:text-sm text-gray-500 italic">
              – Katherine Kaufmann, Gründerin und Therapeutin
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex-shrink-0">
          <Button
            asChild
            size="default"
            data-cta="therapeuten-callout-fragebogen"
            className="w-full sm:w-auto h-11 px-5 text-sm sm:text-base font-semibold shadow-md shadow-emerald-600/10 hover:shadow-lg hover:shadow-emerald-600/20 transition-all duration-200"
          >
            <CtaLink
              href={href}
              eventType="cta_click"
              eventId="therapeuten-callout-fragebogen"
              aria-label="Jetzt Therapeut:in finden"
            >
              Jetzt Therapeut:in finden
            </CtaLink>
          </Button>
        </div>
      </div>
    </section>
  );
}
