import React from 'react';
import { cn } from '@/lib/utils';

export type TimelineItem = {
  icon?: React.ReactNode; // optional - if not provided, shows number only
  title: string;
  description?: string; // simple text description (alternative to bullets)
  caption?: string; // small label (e.g., "5 Minuten")
  bullets?: string[];
};

export function ProcessTimeline({
  heading = "So funktioniert's",
  tagline,
  items,
  className,
  variant = 'default',
}: {
  heading?: string;
  tagline?: string;
  items: TimelineItem[];
  className?: string;
  /** 'minimal' uses simpler centered layout without cards - good for homepages */
  variant?: 'default' | 'minimal';
}) {
  // Minimal variant: clean, centered layout without cards
  if (variant === 'minimal') {
    return (
      <section aria-labelledby="timeline-heading" className={cn('mt-14 sm:mt-20', className)}>
        <h2 id="timeline-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 text-center">
          {heading}
        </h2>
        {tagline ? (
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-700 max-w-3xl mx-auto text-center">{tagline}</p>
        ) : null}

        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {items.map((it, idx) => (
            <div key={idx} className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-lg font-bold shadow-lg">
                {idx + 1}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{it.title}</h3>
              {it.description ? (
                <p className="mt-2 text-sm text-gray-600">{it.description}</p>
              ) : null}
              {it.caption ? (
                <span className="mt-2 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  {it.caption}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Default variant: full cards with icons, bullets, connectors
  return (
    <section
      aria-labelledby="timeline-heading"
      className={cn(
        'relative mt-14 overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:mt-20 sm:p-10 lg:p-12',
        className,
      )}
    >
      {/* Enhanced gradient overlays */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(99,102,241,0.1),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,rgba(14,165,233,0.08),transparent_65%)]" />

      {/* Optional decorative blur */}
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-200/20 to-transparent blur-3xl" />

      <div className="text-center">
        <h2 id="timeline-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          {heading}
        </h2>
        {tagline ? (
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-700 max-w-3xl mx-auto">{tagline}</p>
        ) : null}
      </div>

      {/* Mobile: stacked timeline */}
      <div className="mt-10 sm:hidden">
        <ol role="list" className="space-y-6">
          {items.map((it, idx) => (
            <li key={idx} className="relative">
              <div className="flex gap-4">
                {/* Icon bubble with number badge */}
                <div className="relative flex-shrink-0">
                  {it.icon ? (
                    <>
                      <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm">
                        {it.icon}
                      </div>
                      <span className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-xs font-bold shadow-md ring-2 ring-white">
                        {idx + 1}
                      </span>
                    </>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-base font-bold shadow-lg">
                      {idx + 1}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-slate-900">{it.title}</h3>
                    {it.caption ? (
                      <span className="rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200/60 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-300/50 shadow-sm">
                        {it.caption}
                      </span>
                    ) : null}
                  </div>
                  {it.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{it.description}</p>
                  ) : null}
                  {it.bullets && it.bullets.length ? (
                    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                      {it.bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              {/* Connector line to next item */}
              {idx < items.length - 1 ? (
                <div className={cn(
                  "absolute bottom-[-24px] w-0.5 bg-gradient-to-b from-slate-300 to-slate-200",
                  it.icon ? "left-[26px] top-[56px]" : "left-[20px] top-[48px]"
                )} />
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      {/* Desktop: three columns with connectors */}
      <div className="mt-10 hidden sm:grid sm:grid-cols-3 sm:gap-6 lg:gap-8">
        {items.map((it, idx) => (
          <div key={idx} className="relative pt-4">
            {/* Step number badge - positioned outside card */}
            <div className="absolute top-0 left-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-base font-bold shadow-lg ring-4 ring-white">
              <span>{idx + 1}</span>
            </div>

            {/* Enhanced connector */}
            {idx < items.length - 1 ? (
              <div className="pointer-events-none absolute right-[-12px] top-16 hidden h-1 w-6 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 sm:block lg:right-[-16px] lg:w-8 rounded-full shadow-sm" />
            ) : null}

            <div className="group relative flex h-full flex-col rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm p-5 sm:p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              {it.icon ? (
                <div className="flex items-center justify-between pt-2">
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                    {it.icon}
                  </div>
                </div>
              ) : null}

              <div className={it.icon ? "mt-4" : "mt-2"}>
                <h3 className="text-xl font-semibold text-slate-900">{it.title}</h3>
                {it.caption ? (
                  <span className="mt-2 inline-block rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200/60 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-300/50 shadow-sm">
                    {it.caption}
                  </span>
                ) : null}
              </div>

              {it.description ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{it.description}</p>
              ) : null}

              {it.bullets && it.bullets.length ? (
                <ul className="mt-4 flex-1 space-y-2 text-sm leading-relaxed text-slate-700">
                  {it.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1.5 inline-block h-2 w-2 flex-none rounded-full bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500 shadow-sm" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ProcessTimeline;
