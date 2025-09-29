"use client";

import Link from "next/link";
import RevealContainer from "@/components/RevealContainer";
import { THERAPY_PAGES } from "@/features/therapy/lib/pages";

export default function RelatedTreatments({ currentSlug }: { currentSlug: string }) {
  const items = THERAPY_PAGES.filter((p) => p.slug !== currentSlug);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="mt-12 sm:mt-16">
      <div className="relative rounded-2xl border bg-white p-6 sm:p-8">
        <h2 id="related-heading" className="text-2xl font-semibold">Weitere Verfahren</h2>
        <RevealContainer>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it, i) => (
              <Link
                key={it.slug}
                href={`/therapie/${it.slug}`}
                className="block rounded-lg border bg-white p-4 shadow-sm opacity-0 translate-y-2 transition-all duration-500 hover:shadow-md"
                data-reveal
                style={{ transitionDelay: `${i * 60}ms` }}
                aria-label={it.title}
              >
                <div className="text-base font-medium">{it.title}</div>
                <div className="mt-1 text-sm text-gray-600">{it.description}</div>
              </Link>
            ))}
          </div>
        </RevealContainer>
      </div>
    </section>
  );
}
