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
    '✓ Handverlesene Therapeuten',
    '✓ Termine in 24 Stunden',
    '✓ Somatische Therapie',
    '✓ Vor Ort in Berlin oder online',
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
    <section aria-labelledby="kh-hero-heading" className="relative isolate overflow-hidden rounded-3xl border border-slate-200/60 shadow-xl">
      {/* Background image with enhanced overlay and blur */}
      <div className="absolute inset-0 -z-10">
        <Image
          src={backgroundSrc}
          alt="Freudiger Moment in der Natur"
          fill
          priority
          sizes="100vw"
          className="object-cover scale-105 blur-[2px]"
        />
        {/* Enhanced gradient overlay for better text legibility */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-black/45 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>

      <div className="mx-auto grid min-h-[520px] w-full max-w-7xl grid-rows-[1fr] px-6 py-20 sm:min-h-[640px] sm:py-24 lg:px-8 lg:py-28">
        <div className="flex flex-col justify-center">
          <h1 id="kh-hero-heading" className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl leading-tight drop-shadow-lg">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-5 max-w-3xl text-xl text-white/95 sm:text-2xl md:text-3xl leading-relaxed drop-shadow-md">{subtitle}</p>
          ) : null}
          {supportLine ? (
            <p className="mt-3 max-w-2xl text-base text-white/90 sm:text-lg md:text-xl leading-relaxed drop-shadow-md">{supportLine}</p>
          ) : null}

          <div className="mt-10">
            <Button
              asChild
              size="lg"
              className="h-14 px-8 text-base sm:text-lg font-semibold shadow-xl shadow-emerald-900/30 hover:shadow-2xl hover:shadow-emerald-900/40 transition-all duration-200 hover:scale-[1.02]"
              data-cta="hero-primary"
            >
              <CtaLink href={ctaHref} eventType="cta_click" aria-label={ctaLabel} data-cta="hero-primary">
                {ctaLabel}
              </CtaLink>
            </Button>
          </div>

          {valueProps?.length ? (
            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-base sm:text-lg text-white/95 drop-shadow-md">
              {valueProps.map((vp, i) => (
                <span key={i} className="inline-flex items-center font-medium">
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
