import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, Briefcase, Layers, LineChart, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import CtaLink from "@/components/CtaLink";
import PageAnalytics from "@/components/PageAnalytics";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Beratung – Digitale Infrastruktur für Gesundheits- & Bildungsunternehmen | Kaufmann Health",
  description:
    "Beratung für digitale Infrastruktur in Gesundheit & Bildung: schnelle Produktentwicklung, Buchungs- und Zahlungssysteme, Kursplattformen und Praxis-Tools – von Idee bis funktionsfähigem Produkt.",
  openGraph: {
    title: "Beratung – Digitale Infrastruktur für Gesundheits- & Bildungsunternehmen | Kaufmann Health",
    description:
      "Konstantin Kaufmann unterstützt Gesundheits- und Bildungsunternehmen bei der Entwicklung maßgeschneiderter digitaler Lösungen – von MVP bis laufendem Betrieb.",
    url: "https://www.kaufmann-health.de/beratung",
    siteName: "Kaufmann Health",
    locale: "de_DE",
    type: "website",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.kaufmann-health.de/beratung" },
};

export default function BeratungPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
      <PageAnalytics qualifier="Beratung" />

      {/* Hero */}
      <section
        aria-labelledby="consulting-hero"
        className="relative overflow-hidden rounded-3xl border border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-emerald-50/90 via-white to-sky-50/80 p-8 sm:p-10 lg:p-12"
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,rgba(99,102,241,0.1),transparent_70%),radial-gradient(30rem_16rem_at_100%_100%,rgba(16,185,129,0.08),transparent_65%)]" />
        <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-200/30 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-200/30 to-transparent blur-3xl" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1
            id="consulting-hero"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight"
          >
            Digitale Lösungen für Gesundheits- und Bildungsunternehmen
          </h1>
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-full ring-2 ring-emerald-200/70 shadow-md">
              <Image
                src="/profile-pictures/konstantin.JPEG"
                alt="Konstantin Kaufmann"
                fill
                sizes="80px"
                className="object-cover"
                priority
              />
            </div>
            <div className="text-sm sm:text-base text-gray-700">
              <p className="font-semibold text-gray-900">Konstantin Kaufmann</p>
              <p className="text-gray-600">Beratung &amp; Produktentwicklung</p>
            </div>
          </div>
          <p className="mt-6 text-base sm:text-lg leading-relaxed text-gray-700">
            Ich entwickle maßgeschneiderte digitale Infrastruktur für kleine und mittelständische Unternehmen,
            die technologische Umsetzung brauchen, aber keine eigenen Entwicklungsressourcen haben. Fokus:
            schnelle Produktentwicklung mit modernen Tech-Stacks – von der Idee zum funktionsfähigen Produkt in
            Wochen statt Monaten.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02]"
            >
              <CtaLink
                href="mailto:hello@kkauf.com?subject=Projektanfrage%20Digitale%20Infrastruktur"
                eventType="cta_click"
                eventId="beratung-hero-contact"
              >
                Projekt anfragen
              </CtaLink>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold border-2 hover:bg-gray-50 transition-all duration-200"
            >
              <a
                href="https://kkauf.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <span>Profil &amp; CV auf kkauf.com</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Aktuell arbeite ich mit 2–3 Projekten parallel und nehme nur Aufträge an, bei denen ich echten
            Mehrwert liefern kann.
          </p>
        </div>
      </section>

      {/* Aktuelle Projekte */}
      <section aria-labelledby="projects-heading" className="mt-14 sm:mt-20 lg:mt-24">
        <h2
          id="projects-heading"
          className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 text-left sm:text-center"
        >
          Aktuelle Projekte
        </h2>
        <div className="mt-8 sm:mt-10 grid gap-6 sm:grid-cols-2 lg:gap-8">
          <div className="group relative flex flex-col rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 text-emerald-600 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                <Rocket className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Kaufmann Health – Therapie-Plattform</h3>
                <p className="text-xs sm:text-sm text-gray-600">Marketplace-Plattform für Körperpsychotherapie</p>
              </div>
            </div>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-700">
              Komplette Plattform mit Buchungssystem, Zahlungsintegration (Stripe), SMS-Verifizierung (Twilio),
              automatisiertem E-Mail-System (Resend) und Datenbank-Backend (Supabase). Entwickelt in rund drei
              Monaten mit Next.js und responsivem Design – DSGVO-konform und auf Wachstum ausgelegt.
            </p>
          </div>

          <div className="group relative flex flex-col rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-3 text-indigo-600 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                <Briefcase className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Digitalisierung einer Heilpraktiker-Praxis</h3>
                <p className="text-xs sm:text-sm text-gray-600">Kurse &amp; Praxisorganisation aus einem Guss</p>
              </div>
            </div>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-700">
              Aufbau von Online-Kurs-Infrastruktur und digitaler Praxisverwaltung für eine selbstständige
              Heilpraktikerin (Psychotherapie). Kombination aus Projektmanagement und technischer Umsetzung –
              von der Tool-Auswahl bis zur Integration in bestehende Abläufe.
            </p>
          </div>
        </div>
      </section>

      {/* Leistungen */}
      <section aria-labelledby="services-heading" className="mt-14 sm:mt-20 lg:mt-24">
        <div className="relative rounded-3xl border border-slate-200/60 bg-gradient-to-br from-slate-50/90 via-white to-emerald-50/70 shadow-lg shadow-slate-100/50 p-8 sm:p-10 lg:p-12 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(32rem_18rem_at_0%_0%,rgba(99,102,241,0.06),transparent_65%),radial-gradient(28rem_16rem_at_100%_100%,rgba(16,185,129,0.08),transparent_65%)] rounded-3xl" />

          <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 max-w-5xl mx-auto">
            <div>
              <h2 id="services-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                Leistungen
              </h2>
              <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
                Ich verbinde Produktstrategie, technische Umsetzung und operative Erfahrung. Für Kunden, die
                wissen, was sie brauchen – aber nicht wissen, wie sie es technisch umsetzen.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/40 p-4 flex items-start gap-3 text-sm shadow-sm hover:shadow-md transition-shadow">
                  <div className="mt-1 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-2 text-emerald-600 shadow-sm">
                    <Rocket className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                      Rapid Prototyping &amp; MVP-Entwicklung
                    </h3>
                    <p className="mt-1 text-gray-700">
                      Von der Geschäftsidee zum funktionsfähigen Prototyp – schnell, iterativ und mit
                      KI-gestützter Entwicklung.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/40 p-4 flex items-start gap-3 text-sm shadow-sm hover:shadow-md transition-shadow">
                  <div className="mt-1 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-2 text-emerald-600 shadow-sm">
                    <Layers className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                      Digitale Infrastruktur für Gesundheits- &amp; Bildungsanbieter
                    </h3>
                    <p className="mt-1 text-gray-700">
                      Buchungs- und Zahlungssysteme, Online-Kurs-Plattformen, Kunden- und Praxisverwaltung sowie
                      E-Mail-Automatisierung und CRM-Integration.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/30 p-4 flex items-start gap-3 text-sm shadow-sm">
                  <div className="mt-1 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-2 text-emerald-600 shadow-sm">
                    <LineChart className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base">
                      Technische Umsetzung &amp; Projektführung
                    </h3>
                    <p className="mt-1 text-gray-700">
                      Ich übernehme Entwicklung und Projektmanagement – inklusive Tool-Auswahl, Roadmap und
                      Abstimmung mit Stakeholdern.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-bold text-gray-900">Typische Projekte</h3>
              <ul className="space-y-3 text-sm sm:text-base text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-emerald-600" />
                  <span>Buchungs- und Zahlungssysteme für Therapiepraxen, Coaching- und Kursangebote</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-emerald-600" />
                  <span>Online-Kurs-Plattformen mit Zugriffsbeschränkungen, Bezahlstrecken und E-Mail-Flows</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-emerald-600" />
                  <span>Kunden- und Praxisverwaltung mit Supabase/PostgreSQL als Datenbasis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-emerald-600" />
                  <span>E-Mail-Automatisierung (Onboarding, Erinnerungen, Kampagnen) und CRM-Integration</span>
                </li>
              </ul>

              <div className="mt-4 rounded-xl border border-gray-200/60 bg-white/90 backdrop-blur-sm p-5 shadow-sm">
                <p className="text-sm sm:text-base text-gray-700">
                  <span className="font-semibold text-gray-900">Laufzeit:</span> meist 4–12 Wochen pro Projekt –
                  mit klaren Zwischenzielen und greifbaren Ergebnissen statt abstrakter Konzeptfolien.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hintergrund */}
      <section aria-labelledby="background-heading" className="mt-14 sm:mt-20 lg:mt-24">
        <div className="relative rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-pink-50/35 p-8 sm:p-10 lg:p-12 shadow-lg shadow-indigo-100/40 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />

          <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 max-w-5xl mx-auto">
            <div>
              <h2 id="background-heading" className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
                Hintergrund
              </h2>
              <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-700">
                Ich bringe operative Erfahrung aus schnell wachsenden Tech-Unternehmen und Produktverantwortung in
                regulierten Umfeldern mit – kombiniert mit einem eigenen Gesundheitsprojekt (Kaufmann Health).
              </p>

              <div className="mt-6 rounded-xl border border-indigo-200/60 bg-white/80 backdrop-blur-sm p-5 shadow-md">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Berufserfahrung (Auszug)</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-indigo-600" />
                    <span>Head of Academy, Franklin Institute of Applied Sciences</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-indigo-600" />
                    <span>Lead Product Manager, Urban Sports Group</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-indigo-600" />
                    <span>Product Owner, N26</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-indigo-200/60 bg-white/80 backdrop-blur-sm p-5 shadow-md">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Technische Expertise</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-indigo-600" />
                    <span>Full-Stack-Entwicklung mit Next.js, React, Supabase und PostgreSQL</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-indigo-600" />
                    <span>API-Integrationen (z.&nbsp;B. Twilio, Stripe, Resend und weitere SaaS-Systeme)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-indigo-600" />
                    <span>KI-gestützte Produktentwicklung, Datenanalyse und Performance-Optimierung</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-indigo-200/60 bg-white/80 backdrop-blur-sm p-5 shadow-sm">
                <p className="text-sm sm:text-base text-gray-700">
                  <span className="font-semibold text-gray-900">Aktuell:</span> Executive MBA (EMBA) an der
                  Quantic School of Business &amp; Technology.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Zusammenarbeit & Kontakt */}
      <section aria-labelledby="collaboration-heading" className="mt-14 sm:mt-20 lg:mt-24">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/60 shadow-xl shadow-emerald-100/20 bg-gradient-to-br from-emerald-50/90 via-teal-50/70 to-cyan-50/60 p-8 sm:p-12 lg:p-16">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_-10%,rgba(16,185,129,0.12),transparent_70%),radial-gradient(32rem_18rem_at_80%_100%,rgba(6,182,212,0.08),transparent_65%)]" />
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-emerald-200/30 to-transparent blur-3xl" />

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <h2
              id="collaboration-heading"
              className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent leading-tight"
            >
              Zusammenarbeit
            </h2>
            <p className="mt-5 text-base sm:text-lg leading-relaxed text-gray-700">
              Ich arbeite in der Regel mit 2–3 Projekten gleichzeitig. Typische Laufzeit: 4–12 Wochen, mit
              klaren Zwischenzielen und regelmäßigen Updates. Am Ende steht ein funktionsfähiges Produkt – nicht
              nur ein Konzept.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                asChild
                size="lg"
                className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 transition-all duration-200 hover:scale-[1.02]"
              >
                <CtaLink
                  href="mailto:hello@kkauf.com?subject=Projektanfrage%20Kaufmann%20Health%20Beratung"
                  eventType="cta_click"
                  eventId="beratung-collaboration-contact"
                >
                  Projekt besprechen
                </CtaLink>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold border-2 hover:bg-gray-50 transition-all duration-200"
              >
                <a
                  href="https://www.linkedin.com/in/kkauf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <span>Mit mir auf LinkedIn vernetzen</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            </div>

            <p className="mt-5 text-sm sm:text-base text-gray-700">
              Oder schreib direkt an <a href="mailto:hello@kkauf.com" className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-800 hover:decoration-emerald-600 transition-colors">hello@kkauf.com</a>.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
