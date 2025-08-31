import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default function Home() {
  const variant = process.env.NEXT_PUBLIC_EXPERIMENT_HOME_VARIANT || "dual";
  const showTherapistSection = variant !== "patient-only";

  return (
    <div className="min-h-screen bg-white" data-variant={variant}>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:py-16">
        {/* Announcement Bar */}
        <div className="mb-6">
          <div className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            Neu in Berlin, München und Hamburg
          </div>
        </div>

        {/* Hero Section (Patient-Focused) */}
        <section
          aria-labelledby="hero-heading"
          className="mb-10 sm:mb-14 relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_120%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(30rem_16rem_at_-20%_80%,rgba(14,165,233,0.08),transparent_60%)]" />
          <h1
            id="hero-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl"
          >
            Finden Sie körperorientierte Trauma-Therapeuten
          </h1>
          <p className="mt-4 max-w-2xl text-base text-gray-600 sm:text-lg">
          Persönlich kuratierte Therapeuten-Empfehlungen.
          Handverlesen und persönlich geprüft, für eine Empfehlung, der Sie vertrauen können.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              asChild
              data-cta="patients-primary"
              data-audience="patients"
            >
              <Link href="/therapie-finden">Therapeuten finden</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              data-cta="therapists-secondary"
              data-audience="therapists"
            >
              <Link href="/fuer-therapeuten">Für Therapeuten</Link>
            </Button>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Persönlich kuratierte Therapeuten-Empfehlungen
          </p>
        </section>

      
        {/* Social Proof */}
        <section aria-labelledby="social-proof" className="mb-12">
          <h2 id="social-proof" className="text-sm font-medium text-gray-700">
            Unsere sorgfältig geprüften Therapeuten sind zertifiziert in:
          </h2>
          <div className="mt-4 grid grid-cols-2 items-center gap-6 sm:grid-cols-4 lg:grid-cols-4">
            <Image
              src="/logos/Modalities/NARM.png"
              alt="NARM"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Modalities/Hakomi.png"
              alt="Hakomi"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Modalities/Somatic-Experiencing.png"
              alt="Somatic Experiencing"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
            <Image
              src="/logos/Modalities/Core-Energetics.png"
              alt="Core Energetics"
              width={240}
              height={80}
              unoptimized
              className="h-20 w-auto object-contain opacity-80"
            />
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features" className="mb-14">
          <h2 id="features" className="text-2xl font-semibold">
            Was unsere Empfehlungen auszeichnet
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-white p-5 transition-all duration-200 hover:shadow-md">
              <h3 className="text-lg font-medium">Spezialisierte Expertise</h3>
              <p className="mt-2 text-sm text-gray-600">
                Ausschließlich körperorientierte Trauma-Therapeuten mit
                nachgewiesener Ausbildung in NARM, Hakomi, Core Energetics oder Somatic
                Experiencing.
              </p>
            </div>
            <div className="rounded-lg border bg-white p-5 transition-all duration-200 hover:shadow-md">
              <h3 className="text-lg font-medium">Expertenbasierte Therapeuten-Auswahl</h3>
              <p className="mt-2 text-sm text-gray-600">
                Als Experten für körperorientierte Therapie kennen wir jeden 
                Therapeuten persönlich und wählen basierend auf Ihrer Situation 
                den passenden aus.
              </p>
            </div>
            <div className="rounded-lg border bg-white p-5 transition-all duration-200 hover:shadow-md">
              <h3 className="text-lg font-medium">Gezielte Auswahl</h3>
              <p className="mt-2 text-sm text-gray-600">
                Sie erhalten Kontaktdaten zu 2-3 passenden Therapeuten und wählen selbst aus, wen Sie kontaktieren möchten. Direkter Kontakt, keine Umwege.
              </p>
            </div>
          </div>
        </section>

        {/* Therapist Section (Secondary) */}
        {showTherapistSection && (
          <section
            aria-labelledby="therapists"
            className="mb-4 rounded-xl border bg-slate-50 p-6 sm:p-8"
          >
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-center">
              <div>
                <h2 id="therapists" className="text-2xl font-semibold">
                  Neue Klienten für Ihre Praxis
                </h2>
                <p className="mt-2 text-gray-600">
                  Werden Sie Teil unseres kuratierten Netzwerks. Zahlen Sie
                  nur eine Erfolgsgebühr, wenn Klienten über unsere Plattform zu
                  Ihnen finden.
                </p>
              </div>
              <div className="justify-self-start lg:justify-self-end">
                <Button
                  size="lg"
                  asChild
                  data-cta="therapists-primary"
                  data-audience="therapists"
                >
                  <Link href="/fuer-therapeuten">
                    In Netzwerk aufnehmen lassen →
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
