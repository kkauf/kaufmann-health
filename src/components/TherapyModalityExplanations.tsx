'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';

export default function TherapyModalityExplanations() {
  function Logo({ src, alt, fallback }: { src: string; alt: string; fallback: string }) {
    const [failed, setFailed] = useState(false);
    return (
      <div className="flex items-center gap-3">
        {!failed ? (
          <Image
            src={src}
            alt={alt}
            width={96}
            height={32}
            loading="lazy"
            sizes="(max-width: 640px) 25vw, 96px"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
            className="h-6 w-auto object-contain opacity-80"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="h-7 w-16 shrink-0 rounded-lg border border-slate-200/60 bg-gradient-to-br from-slate-50 to-slate-100/60 text-slate-700 grid place-items-center text-xs font-medium shadow-sm">
            {fallback}
          </div>
        )}
        <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">{alt}</h3>
      </div>
    );
  }
  return (
    <section aria-labelledby="modalities" className="mt-14 sm:mt-20 lg:mt-24">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
        {/* Subtle gradient overlay for depth */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
        
        <h2 id="modalities" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
          Körperorientierte Therapieverfahren erklärt
        </h2>
        <p className="mt-4 sm:mt-6 max-w-3xl text-base sm:text-lg leading-relaxed text-gray-700">
          Vier bewährte Ansätze, die direkt mit dem Nervensystem arbeiten. Kurz erklärt, damit Sie die passende
          Herangehensweise finden.
        </p>
        
        <div className="mt-8 sm:mt-10 grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-2">
          <div className="relative rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-5 sm:p-6 h-full flex flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <Logo src="/logos/Modalities/NARM.png" alt="NARM (Neuroaffektives Beziehungsmodell)" fallback="NARM" />
            <p className="mt-3 sm:mt-4 text-sm sm:text-base leading-relaxed text-gray-600 break-words">
              NARM fokussiert auf Entwicklungstraumata und die Fähigkeit zur Selbstregulation. Der Ansatz verbindet
              achtsame Körperwahrnehmung mit der Arbeit an Mustern in Beziehungen – ohne re-traumatisierende
              Detailschilderungen.
            </p>
            <a
              href="https://narmtraining.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors duration-150"
              aria-label="Mehr über NARM erfahren (öffnet in neuem Tab)"
            >
              Mehr erfahren
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
          
          <div className="relative rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-5 sm:p-6 h-full flex flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <Logo src="/logos/Modalities/Somatic-Experiencing.png" alt="Somatic Experiencing (SE)" fallback="SE" />
            <p className="mt-3 sm:mt-4 text-sm sm:text-base leading-relaxed text-gray-600 break-words">
              SE arbeitet mit der natürlichen Stressreaktion des Körpers. Durch fein dosierte Annäherung an belastende
              Empfindungen wird das Nervensystem behutsam entladen, sodass festgehaltene Energie wieder in Fluss kommt.
            </p>
            <a
              href="https://traumahealing.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors duration-150"
              aria-label="Mehr über Somatic Experiencing erfahren (öffnet in neuem Tab)"
            >
              Mehr erfahren
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
          
          <div className="relative rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-5 sm:p-6 h-full flex flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <Logo src="/logos/Modalities/Hakomi.png" alt="Hakomi" fallback="Hakomi" />
            <p className="mt-3 sm:mt-4 text-sm sm:text-base leading-relaxed text-gray-600 break-words">
              Hakomi ist eine achtsamkeitsbasierte Methode, die unbewusste Muster über den Körper erfahrbar macht.
              In respektvoller, langsamer Arbeit entstehen neue Erfahrungen, die alte Überzeugungen sanft verändern.
            </p>
            <a
              href="https://hakomi.de/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors duration-150"
              aria-label="Mehr über Hakomi erfahren (öffnet in neuem Tab)"
            >
              Mehr erfahren
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
          
          <div className="relative rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 p-5 sm:p-6 h-full flex flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
            <Logo src="/logos/Modalities/Core-Energetics.png" alt="Core Energetics" fallback="CE" />
            <p className="mt-3 sm:mt-4 text-sm sm:text-base leading-relaxed text-gray-600 break-words">
              Core Energetics verbindet körperliche Ausdrucksarbeit mit emotionaler Integration. Über Haltung, Atmung und
              Bewegung werden festgehaltene Spannungen gelöst und Lebendigkeit sowie Kontaktfähigkeit gestärkt.
            </p>
            <a
              href="https://coreenergetics.nl/en/core-energetics/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors duration-150"
              aria-label="Mehr über Core Energetics erfahren (öffnet in neuem Tab)"
            >
              Mehr erfahren
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
        
        <small className="mt-6 block text-xs sm:text-sm text-gray-500">
          Kurzbeschreibungen dienen der Information und ersetzen keine individuelle therapeutische Beratung.
        </small>
      </div>
    </section>
  );
}
