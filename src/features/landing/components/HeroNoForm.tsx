"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import CtaLink from '@/components/CtaLink';

export function HeroNoForm({
  title,
  subtitle,
  supportLine,
  ctaLabel = 'Jetzt Therapeut:in finden',
  ctaHref = '/fragebogen',
  backgroundSrc = '/images/hero.jpg',
  valueProps = [
    '✓ Persönlich ausgewählt',
    '✓ Termine in 24 Stunden',
    '✓ Trauma-informiert',
    '✓ Online oder Berlin',
  ],
}: {
  title: string;
  subtitle?: string;
  supportLine?: string;
  ctaLabel?: string;
  ctaHref?: string;
  backgroundSrc?: string;
  valueProps?: string[];
}) {
  return (
    <section aria-labelledby="kh-hero-heading" className="relative isolate overflow-hidden rounded-2xl border">
      {/* Background image */}
      <div className="absolute inset-0 -z-10">
        <Image
          src={backgroundSrc}
          alt="Freudiger Moment in der Natur"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="mx-auto grid min-h-[500px] w-full max-w-7xl grid-rows-[1fr] px-6 py-16 sm:min-h-[600px] sm:py-20 lg:px-8">
        <div className="flex flex-col justify-center">
          <h1 id="kh-hero-heading" className="text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-4 max-w-3xl text-2xl text-white/90 sm:text-3xl">{subtitle}</p>
          ) : null}
          {supportLine ? (
            <p className="mt-2 max-w-2xl text-lg text-white/85 sm:text-xl">{supportLine}</p>
          ) : null}

          <div className="mt-8">
            <Button asChild size="lg" className="h-12 px-6 text-base font-semibold" data-cta="hero-primary">
              <CtaLink href={ctaHref} eventType="cta_click" aria-label={ctaLabel}>
                {ctaLabel}
              </CtaLink>
            </Button>
          </div>

          {valueProps?.length ? (
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-base text-white/90">
              {valueProps.map((vp, i) => (
                <span key={i} className="inline-flex items-center">
                  {vp}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default HeroNoForm;
