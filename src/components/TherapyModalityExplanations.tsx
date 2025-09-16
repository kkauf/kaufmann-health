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
          <div className="h-7 w-16 shrink-0 rounded-md border bg-slate-50 text-slate-600 grid place-items-center text-xs font-medium">
            {fallback}
          </div>
        )}
        <h3 className="text-lg font-medium">{alt}</h3>
      </div>
    );
  }
  return (
    <section aria-labelledby="modalities" className="mt-12 sm:mt-16">
      <h2 id="modalities" className="text-2xl font-semibold">Körperorientierte Therapieverfahren erklärt</h2>
      <p className="mt-2 max-w-3xl text-gray-700">
        Vier bewährte Ansätze, die direkt mit dem Nervensystem arbeiten. Kurz erklärt, damit Sie die passende
        Herangehensweise finden.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2 lg:gap-8">
        <div className="rounded-xl border bg-white p-5 h-full flex flex-col">
          <Logo src="/logos/Modalities/NARM.png" alt="NARM (Neuroaffektives Beziehungsmodell)" fallback="NARM" />
          <p className="mt-2 text-sm text-gray-600 break-words">
            NARM fokussiert auf Entwicklungstraumata und die Fähigkeit zur Selbstregulation. Der Ansatz verbindet
            achtsame Körperwahrnehmung mit der Arbeit an Mustern in Beziehungen – ohne re-traumatisierende
            Detailschilderungen.
          </p>
          <a
            href="https://narmtraining.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
            aria-label="Mehr über NARM erfahren (öffnet in neuem Tab)"
          >
            Mehr erfahren
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        <div className="rounded-xl border bg-white p-5 h-full flex flex-col">
          <Logo src="/logos/Modalities/Somatic-Experiencing.png" alt="Somatic Experiencing (SE)" fallback="SE" />
          <p className="mt-2 text-sm text-gray-600 break-words">
            SE arbeitet mit der natürlichen Stressreaktion des Körpers. Durch fein dosierte Annäherung an belastende
            Empfindungen wird das Nervensystem behutsam entladen, sodass festgehaltene Energie wieder in Fluss kommt.
          </p>
          <a
            href="https://traumahealing.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
            aria-label="Mehr über Somatic Experiencing erfahren (öffnet in neuem Tab)"
          >
            Mehr erfahren
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        <div className="rounded-xl border bg-white p-5 h-full flex flex-col">
          <Logo src="/logos/Modalities/Hakomi.png" alt="Hakomi" fallback="Hakomi" />
          <p className="mt-2 text-sm text-gray-600 break-words">
            Hakomi ist eine achtsamkeitsbasierte Methode, die unbewusste Muster über den Körper erfahrbar macht.
            In respektvoller, langsamer Arbeit entstehen neue Erfahrungen, die alte Überzeugungen sanft verändern.
          </p>
          <a
            href="https://hakomi.de/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
            aria-label="Mehr über Hakomi erfahren (öffnet in neuem Tab)"
          >
            Mehr erfahren
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        <div className="rounded-xl border bg-white p-5 h-full flex flex-col">
          <Logo src="/logos/Modalities/Core-Energetics.png" alt="Core Energetics" fallback="CE" />
          <p className="mt-2 text-sm text-gray-600 break-words">
            Core Energetics verbindet körperliche Ausdrucksarbeit mit emotionaler Integration. Über Haltung, Atmung und
            Bewegung werden festgehaltene Spannungen gelöst und Lebendigkeit sowie Kontaktfähigkeit gestärkt.
          </p>
          <a
            href="https://coreenergetics.nl/en/core-energetics/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 text-sm text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
            aria-label="Mehr über Core Energetics erfahren (öffnet in neuem Tab)"
          >
            Mehr erfahren
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>
      <small className="mt-3 block text-xs text-gray-500">Kurzbeschreibungen dienen der Information und ersetzen keine individuelle therapeutische Beratung.</small>
    </section>
  );
}
