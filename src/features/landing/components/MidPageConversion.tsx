'use client';

import React from 'react';
import CtaLink from '@/components/CtaLink';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

export interface MidPageConversionProps {
  className?: string;
}

const EXPERIENCE_OPTIONS = [
  {
    value: 'yes',
    label: 'Ja, bereits Erfahrung',
    href: '/fragebogen?experience=yes',
  },
  {
    value: 'no',
    label: 'Nein, erste Therapie',
    href: '/fragebogen?experience=no',
  },
  {
    value: 'unsure',
    label: 'Bin mir unsicher',
    href: '/fragebogen?experience=unsure',
  },
] as const;

export function MidPageConversion({ className }: MidPageConversionProps) {
  return (
    <section
      aria-labelledby="midpage-conversion-heading"
      className={cn('mt-14 sm:mt-20 lg:mt-24 py-12 sm:py-16', className)}
    >
      <div className="mx-auto max-w-3xl text-center">
        {/* Section headline */}
        <h2
          id="midpage-conversion-heading"
          className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900"
        >
          Bereit, deine Therapeut:in zu finden?
        </h2>

        {/* Question */}
        <p className="mt-4 sm:mt-5 text-lg sm:text-xl text-gray-700">
          Hast du bereits Therapie gemacht?
        </p>

        {/* Answer buttons - desktop: horizontal, mobile: stacked */}
        <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto">
          {EXPERIENCE_OPTIONS.map((option) => (
            <CtaLink
              key={option.value}
              href={option.href}
              eventType="cta_click"
              data-cta={`midpage-conversion-${option.value}`}
              className="group relative flex items-center justify-center min-h-[44px] sm:min-h-[48px] px-6 py-3 rounded-xl border-2 border-teal-600 bg-white text-teal-700 font-semibold text-base sm:text-lg shadow-md hover:bg-teal-600 hover:text-white hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
            >
              {option.label}
            </CtaLink>
          ))}
        </div>

        {/* Time indicator */}
        <div className="mt-5 sm:mt-6 flex items-center justify-center gap-2 text-sm sm:text-base text-gray-600">
          <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
          <span>5-Minuten Fragebogen</span>
        </div>
      </div>
    </section>
  );
}

export default MidPageConversion;
