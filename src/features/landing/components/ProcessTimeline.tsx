import React from 'react';
import { cn } from '@/lib/utils';

export type TimelineItem = {
  icon: React.ReactNode;
  title: string;
  caption?: string; // small label under icon (e.g., "5 Minuten")
  bullets?: string[];
};

export function ProcessTimeline({
  heading = 'So funktioniert deine Vermittlung',
  tagline,
  items,
  className,
}: {
  heading?: string;
  tagline?: string;
  items: TimelineItem[];
  className?: string;
}) {
  return (
    <section
      aria-labelledby="timeline-heading"
      className={cn(
        'relative mt-10 overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:mt-14 sm:p-8',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(36rem_16rem_at_110%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(28rem_14rem_at_-10%_90%,rgba(14,165,233,0.08),transparent_60%)]" />

      <div className="text-center">
        <h2 id="timeline-heading" className="text-2xl font-semibold tracking-tight">
          {heading}
        </h2>
        {tagline ? (
          <p className="mt-2 text-base text-slate-700">{tagline}</p>
        ) : null}
      </div>

      {/* Mobile: stacked timeline */}
      <div className="mt-8 sm:hidden">
        <ol role="list" className="relative border-l border-slate-200 pl-4">
          {items.map((it, idx) => (
            <li key={idx} className="relative pb-6">
              <span className="absolute -left-3.5 mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500 text-white shadow ring-2 ring-white">
                <span className="sr-only">Schritt {idx + 1}</span>
                <span className="text-[11px] font-semibold">{idx + 1}</span>
              </span>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">{it.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{it.title}</h3>
                    {it.caption ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                        {it.caption}
                      </span>
                    ) : null}
                  </div>
                  {it.bullets && it.bullets.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {it.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Desktop: three columns with connectors */}
      <div className="mt-8 hidden sm:grid sm:grid-cols-3 sm:gap-6">
        {items.map((it, idx) => (
          <div key={idx} className="relative">
            {/* connector */}
            {idx < items.length - 1 ? (
              <div className="pointer-events-none absolute right-[-12px] top-10 hidden h-1 w-6 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 sm:block" />
            ) : null}
            <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  {it.icon}
                </div>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-white text-sm font-semibold text-indigo-600 shadow-sm">
                  <span>{idx + 1}</span>
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-lg font-semibold text-slate-900">{it.title}</h3>
                {it.caption ? (
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                    {it.caption}
                  </span>
                ) : null}
              </div>
              {it.bullets && it.bullets.length ? (
                <ul className="mt-2 flex-1 space-y-1.5 text-sm text-slate-700">
                  {it.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500" />
                      <span className="leading-snug">{b}</span>
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
