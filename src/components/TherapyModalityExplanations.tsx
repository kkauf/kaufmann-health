'use client';
import React from 'react';
import { ExternalLink, HeartHandshake, Shell, Wind, Target } from 'lucide-react';

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
          Vier bewährte Ansätze, die direkt mit dem Nervensystem arbeiten. Kurz erklärt, damit Sie die passende
          Herangehensweise finden.
        </p>
        
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
              NARM fokussiert auf Entwicklungstraumata und die Fähigkeit zur Selbstregulation. Der Ansatz verbindet
              achtsame Körperwahrnehmung mit der Arbeit an Mustern in Beziehungen – ohne re-traumatisierende
              Detailschilderungen.
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
              SE arbeitet mit der natürlichen Stressreaktion des Körpers. Durch fein dosierte Annäherung an belastende
              Empfindungen wird das Nervensystem behutsam entladen, sodass festgehaltene Energie wieder in Fluss kommt.
            </p>
            <a
              href="https://traumahealing.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors duration-150"
              aria-label="Mehr über Somatic Experiencing erfahren (öffnet in neuem Tab)"
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
              Hakomi ist eine achtsamkeitsbasierte Methode, die unbewusste Muster über den Körper erfahrbar macht.
              In respektvoller, langsamer Arbeit entstehen neue Erfahrungen, die alte Überzeugungen sanft verändern.
            </p>
            <a
              href="https://hakomi.de/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors duration-150"
              aria-label="Mehr über Hakomi erfahren (öffnet in neuem Tab)"
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
              Core Energetics verbindet körperliche Ausdrucksarbeit mit emotionaler Integration. Über Haltung, Atmung und
              Bewegung werden festgehaltene Spannungen gelöst und Lebendigkeit sowie Kontaktfähigkeit gestärkt.
            </p>
            <a
              href="https://coreenergetics.nl/en/core-energetics/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700 transition-colors duration-150"
              aria-label="Mehr über Core Energetics erfahren (öffnet in neuem Tab)"
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
