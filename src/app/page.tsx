import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import TherapyModalityExplanations from "@/components/TherapyModalityExplanations";
import { ShieldCheck, Lock, UserCheck } from "lucide-react";
import { COOKIES_ENABLED } from "@/lib/config";

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.kaufmann-health.de";

export const metadata: Metadata = {
  title: "Therapeut:innen-Empfehlung – Sorgfältig geprüfte Therapeut:innen in deiner Nähe | Kaufmann Health",
  description: "Therapeuten finden in 24 Stunden. Persönlich ausgewählt für dich. Online oder vor Ort. Ohne Wartezeit.",
  alternates: {
    canonical: `${baseUrl}/`,
  },
  openGraph: {
    title: "Finde geprüfte körperorientierte Trauma-Therapeut:innen | Kaufmann Health",
    description: "Therapeuten finden in 24 Stunden. Persönlich ausgewählt für dich. Online oder vor Ort. Ohne Wartezeit.",
    url: `${baseUrl}/`,
    siteName: "Kaufmann Health",
    locale: "de_DE",
    type: "website",
    images: [
      {
        url: `${baseUrl}/images/hero.jpg`,
        width: 1200,
        height: 630,
        alt: "Kaufmann Health – Körperorientierte Psychotherapie",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Finde geprüfte körperorientierte Trauma-Therapeut:innen",
    description: "Therapeuten finden in 24 Stunden. Persönlich ausgewählt für dich. Online oder vor Ort. Ohne Wartezeit.",
    images: [`${baseUrl}/images/hero.jpg`],
  },
};

export default function Home() {
  const variant = process.env.NEXT_PUBLIC_EXPERIMENT_HOME_VARIANT || "dual";
  const showTherapistSection = variant !== "patient-only";

  return (
    <div className="min-h-screen bg-white" data-variant={variant}>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-18">
        {/* Announcement Bar */}
        <div className="mb-8">
          <div className="inline-flex items-center rounded-full border border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-2 text-xs sm:text-sm font-medium text-emerald-700 shadow-sm">
            Neu in Berlin, München und Hamburg
          </div>
        </div>

        {/* Hero Section (Patient-Focused) */}
        <section
          aria-labelledby="hero-heading"
          className="mb-14 sm:mb-20 lg:mb-24 relative overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-slate-50/80 via-white to-slate-50/60 p-8 sm:p-10 lg:p-12"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(99,102,241,0.1),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,rgba(14,165,233,0.08),transparent_65%)]" />
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-200/20 to-transparent blur-3xl" />
          <h1
            id="hero-heading"
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent"
          >
            Finde geprüfte körperorientierte Trauma‑Therapeut:innen
          </h1>
          <p className="mt-4 sm:mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-gray-700">
            Handverlesene Therapeut:innen-Empfehlungen.
            Persönlich ausgewählt und geprüft – für eine Empfehlung, der du vertrauen kannst.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              asChild
              data-cta="patients-primary"
              data-audience="patients"
              className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02]"
            >
              <Link href="/therapie-finden">Therapeut:innen finden</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              data-cta="therapists-secondary"
              data-audience="therapists"
              className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold border-2 hover:bg-gray-50 transition-all duration-200"
            >
              <Link href="/fuer-therapeuten">Für Therapeut:innen</Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:text-base text-gray-700" aria-label="Vertrauen">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Geprüfte Profile
            </span>
            {!COOKIES_ENABLED && (
              <span className="inline-flex items-center gap-2">
                <Lock className="h-5 w-5 text-slate-700" />
                Keine Cookies
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-indigo-600" />
              Transparente Datenverarbeitung
            </span>
          </div>
        </section>


        {/* Social Proof */}
        <section aria-labelledby="social-proof" className="mb-14 sm:mb-20">
          <h2 id="social-proof" className="text-sm sm:text-base font-medium text-gray-700">
            Unsere sorgfältig geprüften Therapeut:innen sind zertifiziert in:
          </h2>
          <div className="mt-6 rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md p-6 sm:p-8">
            <div className="grid grid-cols-2 items-center gap-8 sm:gap-12 sm:grid-cols-4">
              <Image
                src="/logos/Modalities/NARM.png"
                alt="NARM"
                width={240}
                height={80}
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
                className="h-20 w-auto object-contain opacity-80"
              />
              <Image
                src="/logos/Modalities/Hakomi.png"
                alt="Hakomi"
                width={240}
                height={80}
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
                className="h-20 w-auto object-contain opacity-80"
              />
              <Image
                src="/logos/Modalities/Somatic-Experiencing.png"
                alt="Somatic Experiencing"
                width={240}
                height={80}
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
                className="h-20 w-auto object-contain opacity-80"
              />
              <Image
                src="/logos/Modalities/Core-Energetics.png"
                alt="Core Energetics"
                width={240}
                height={80}
                loading="lazy"
                placeholder="blur"
                blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 240px"
                className="h-20 w-auto object-contain opacity-80"
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features" className="mb-14 sm:mb-20 lg:mb-24">
          <h2 id="features" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Was unsere Empfehlungen auszeichnet
          </h2>
          <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 p-5 sm:p-6">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
              <h3 className="text-xl font-semibold text-gray-900">Spezialisierte Expertise</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Ausschließlich körperorientierte Trauma-Therapeut:innen mit
                nachgewiesener Ausbildung in NARM, Hakomi, Core Energetics oder Somatic
                Experiencing.
              </p>
            </div>
            <div className="relative rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 p-5 sm:p-6">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
              <h3 className="text-xl font-semibold text-gray-900">Persönlich ausgewählte Therapeut:innen‑Empfehlungen</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Wir kennen jede:n Therapeut:in persönlich und wählen basierend auf
                deinen Bedürfnissen und deren Spezialisierung passende Kandidat:innen aus.
              </p>
            </div>
            <div className="relative rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 p-5 sm:p-6">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white to-gray-50/50 rounded-xl" />
              <h3 className="text-xl font-semibold text-gray-900">Gezielte Auswahl</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Du erhältst Kontaktdaten zu 2–3 passenden Therapeut:innen und wählst selbst aus, wen du kontaktieren möchtest. Direkter Kontakt, keine Umwege.
              </p>
            </div>
          </div>
        </section>

        {/* Trust Promise */}
        <section aria-labelledby="trust-promise" className="mb-14 sm:mb-20 lg:mb-24">
          <div className="relative rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:p-10">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30" />
            <h2 id="trust-promise" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Unser Vertrauensversprechen</h2>
            <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 sm:grid-cols-3">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200/60 bg-gradient-to-br from-emerald-50/40 to-white p-4 shadow-sm">
                <ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">Geprüfte Therapeut:innen</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">Qualifikationen und Spezialisierungen werden manuell verifiziert.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-slate-200/60 bg-gradient-to-br from-slate-50/40 to-white p-4 shadow-sm">
                <Lock className="mt-0.5 h-6 w-6 text-slate-700 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">{COOKIES_ENABLED ? 'Datenschutzfreundlich' : 'Keine Cookies'}</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{COOKIES_ENABLED ? 'Minimales Conversion‑Signal; keine Analytics‑Cookies.' : 'Keine Tracking‑Cookies. DSGVO‑konforme, transparente Prozesse.'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-indigo-200/60 bg-gradient-to-br from-indigo-50/40 to-white p-4 shadow-sm">
                <UserCheck className="mt-0.5 h-6 w-6 text-indigo-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">Kontrolle über deine Daten</p>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">Nutzung deiner Angaben ausschließlich zur Kontaktaufnahme mit ausgewählten Therapeut:innen.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Therapy Modalities (Education) */}
        <div className="mb-14 sm:mb-20 lg:mb-24">
          <TherapyModalityExplanations />
        </div>

        {/* Therapist Section (Secondary) */}
        {showTherapistSection && (
          <section
            aria-labelledby="therapists"
            className="mb-14 sm:mb-20 relative overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-6 sm:p-8 lg:p-10 shadow-lg shadow-indigo-100/30"
          >
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-center">
              <div>
                <h2 id="therapists" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                  Bewirb dich für unser Therapeuten-Netzwerk
                </h2>
                <p className="mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
                  Wir suchen ausgewählte Heilpraktiker:innen für Psychotherapie mit Spezialisierung auf körperorientierte Verfahren. Erfolgsbasierte Vergütung.
                </p>
              </div>
              <div className="justify-self-start lg:justify-self-end">
                <Button
                  size="lg"
                  asChild
                  data-cta="therapists-primary"
                  data-audience="therapists"
                  className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-lg shadow-indigo-600/20 hover:shadow-xl hover:shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] bg-indigo-600 hover:bg-indigo-700"
                >
                  <Link href="/fuer-therapeuten">
                    Mehr erfahren →
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
