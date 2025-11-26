"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import CtaLink from '@/components/CtaLink';
import type { ReactNode } from 'react';

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
    '✓ Körperorientierte Psychotherapie',
    '✓ Vor Ort in Berlin oder online',
  ],
  noBackground = false,
  icon,
  backgroundBlurClass = 'object-cover scale-105 blur-[2px]',
}: {
  title: string;
  subtitle?: string;
  supportLine?: string;
  ctaLabel?: string;
  ctaHref?: string;
  backgroundSrc?: string;
  valueProps?: string[];
  noBackground?: boolean;
  icon?: ReactNode;
  backgroundBlurClass?: string;
}) {
  const titleClass = noBackground
    ? "text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl lg:text-7xl leading-tight"
    : "text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl leading-tight drop-shadow-lg";
  const subtitleClass = noBackground
    ? "mt-5 max-w-3xl text-lg sm:text-xl md:text-2xl leading-relaxed text-gray-700"
    : "mt-5 max-w-3xl text-xl text-white/95 sm:text-2xl md:text-3xl leading-relaxed drop-shadow-md";
  const supportClass = noBackground
    ? "mt-3 max-w-2xl text-base sm:text-lg md:text-xl leading-relaxed text-gray-600"
    : "mt-3 max-w-2xl text-base text-white/90 sm:text-lg md:text-xl leading-relaxed drop-shadow-md";
  const valuePropsClass = noBackground
    ? "mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-base sm:text-lg text-gray-700"
    : "mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-base sm:text-lg text-white/95 drop-shadow-md";

  return (
    <section
      aria-labelledby="kh-hero-heading"
      className={`relative isolate rounded-3xl border border-slate-200/60 ${
        noBackground ? 'shadow-lg bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60' : 'shadow-xl'
      }`}
    >
      {/* Background variants - overflow-hidden only on background container */}
      {!noBackground ? (
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
          <Image
            src={backgroundSrc}
            alt="Freudiger Moment in der Natur"
            fill
            priority
            sizes="100vw"
            className={backgroundBlurClass}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-black/45 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(99,102,241,0.1),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,rgba(14,165,233,0.08),transparent_65%)]" />
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-200/20 to-transparent blur-3xl" />
        </>
      )}

      <div className={`mx-auto w-full max-w-7xl px-6 sm:px-8 ${noBackground ? 'py-14 sm:py-16 lg:px-8 lg:py-20' : 'grid min-h-[520px] grid-rows-[1fr] py-16 sm:min-h-[640px] sm:py-24 lg:px-10 lg:py-28'}`}>
        <div className="flex flex-col justify-center w-full lg:w-1/2 max-w-2xl">
          {icon ? (
            <div className="mb-4 sm:mb-6">{icon}</div>
          ) : null}
          <h1 id="kh-hero-heading" className={titleClass}>
            {title}
          </h1>
          {subtitle ? (
            <p className={subtitleClass}>{subtitle}</p>
          ) : null}
          {supportLine ? (
            <p className={supportClass}>{supportLine}</p>
          ) : null}

          <div className="mt-10">
            <Button
              asChild
              size="lg"
              className="h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-xl shadow-emerald-900/30 hover:shadow-2xl hover:shadow-emerald-900/40 transition-all duration-200 hover:scale-[1.02] max-w-full"
              data-cta="hero-primary"
            >
              <CtaLink href={ctaHref} eventType="cta_click" aria-label={ctaLabel} data-cta="hero-primary" className="truncate">
                {ctaLabel}
              </CtaLink>
            </Button>
          </div>
        </div>

        {valueProps?.length ? (
          <div className={valuePropsClass}>
            {valueProps.map((vp, i) => (
              <span key={i} className="inline-flex items-center font-medium">
                {vp}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default HeroNoForm;
