'use client';
import React from 'react';
import { ExternalLink, HeartHandshake, Shell, Wind, Target, HandHelping } from 'lucide-react';
import CtaLink from '@/components/CtaLink';

export default function TherapyModalityExplanations() {
  return (
    <section aria-labelledby="modalities" className="mt-14 sm:mt-20 lg:mt-24">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
        {/* Subtle gradient overlay for depth */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
        
        <h2 id="modalities" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Körperorientierte Therapieverfahren erklärt
        </h2>
        <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-gray-700">
          Vier bewährte Ansätze, die direkt mit dem Nervensystem arbeiten. Kurz erklärt, damit du die passende
          Herangehensweise findest.
        </p>
        {/* Escape route CTA for overwhelmed users */}
        <div className="mt-6 sm:mt-8 flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <p className="text-sm sm:text-base text-gray-700">
            Noch nicht sicher, welche Methode für dich die richtige ist?
          </p>
          <CtaLink
            href="/fragebogen?v=concierge"
            eventType="cta_click"
            eventId="modalities-escape-concierge"
            data-cta="modalities-escape"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-5 py-3 text-sm sm:text-base font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200 min-h-[44px]"
          >
            <HandHelping className="h-4 w-4" aria-hidden />
            Wir helfen dir gerne dabei
          </CtaLink>
        </div>

        <div className="mt-8 sm:mt-10 grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-2">
          <div className="relative rounded-xl border border-teal-200/60 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-5 sm:p-6 h-full flex flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-teal-50/30 rounded-xl" />
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100/60 p-3 text-teal-600 shadow-sm">
                <HeartHandshake className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">NARM</h3>
                <p className="text-sm text-teal-700 font-medium mt-0.5">Neuroaffektives Beziehungsmodell</p>
              </div>
            </div>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-gray-600">
              NARM ist ein therapeutischer Ansatz für Entwicklungstrauma — frühe Verletzungen, die unsere Beziehungs- und
              Regulationsfähigkeit geprägt haben. In der Arbeit verbinden sich Gespräch und Körperwahrnehmung, um alte
              Überlebensmuster zu erkennen und zu verändern. Ohne belastende Detailschilderungen.
            </p>
            <a
              href="/therapie/narm"
              className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors duration-150"
              aria-label="Mehr über NARM erfahren"
            >
              Mehr erfahren
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
          
          <div className="relative rounded-xl border border-amber-200/60 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-5 sm:p-6 h-full flex flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-amber-50/30 rounded-xl" />
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/60 p-3 text-amber-600 shadow-sm">
                <Shell className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">Somatic Experiencing</h3>
                <p className="text-sm text-amber-700 font-medium mt-0.5">(SE)</p>
              </div>
            </div>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-gray-600">
              SE ist eine körperorientierte Traumatherapie, die auf der Neurobiologie von Stress aufbaut. Der Ansatz hilft,
              im Nervensystem gebundene Stressreaktionen schrittweise zu lösen — besonders bei Schock, Unfällen oder
              chronischer Überforderung. Die Arbeit erfolgt behutsam und im eigenen Tempo.
            </p>
            <a
              href="/therapie/somatic-experiencing"
              className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors duration-150"
              aria-label="Mehr über Somatic Experiencing erfahren"
            >
              Mehr erfahren
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
          
          <div className="relative rounded-xl border border-emerald-200/60 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-5 sm:p-6 h-full flex flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-emerald-50/30 rounded-xl" />
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 text-emerald-600 shadow-sm">
                <Wind className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">Hakomi</h3>
              </div>
            </div>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-gray-600">
              Hakomi ist eine achtsamkeitsbasierte Psychotherapie, die unbewusste Überzeugungen und Schutzmuster über den
              Körper zugänglich macht. Im therapeutischen Gespräch entstehen neue Erfahrungen, die tief verankerte Muster
              verändern können — ohne Konfrontation oder Druck.
            </p>
            <a
              href="/therapie/hakomi"
              className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors duration-150"
              aria-label="Mehr über Hakomi erfahren"
            >
              Mehr erfahren
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
          
          <div className="relative rounded-xl border border-fuchsia-200/60 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-5 sm:p-6 h-full flex flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-fuchsia-50/30 rounded-xl" />
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded-xl bg-gradient-to-br from-fuchsia-50 to-fuchsia-100/60 p-3 text-fuchsia-600 shadow-sm">
                <Target className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">Core Energetics</h3>
              </div>
            </div>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-gray-600">
              Core Energetics ist eine tiefenpsychologisch fundierte Körperpsychotherapie. Sie verbindet die Arbeit mit
              Emotionen, Körperhaltung und Atem, um verdrängte Gefühle bewusst zu machen und zu integrieren. Der Ansatz
              eignet sich besonders für Menschen, die emotionale Blockaden oder chronische Anspannung lösen möchten.
            </p>
            <a
              href="/therapie/core-energetics"
              className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700 transition-colors duration-150"
              aria-label="Mehr über Core Energetics erfahren"
            >
              Mehr erfahren
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
