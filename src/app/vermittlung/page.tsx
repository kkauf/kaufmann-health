import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import CtaLink from '@/components/CtaLink';
import { ProcessSteps, FinalCtaSection } from '@/features/landing/components';
import { buildLandingMetadata, buildLocalBusinessJsonLd } from '@/lib/seo';
import { MessageCircle, UserCheck, PhoneCall } from 'lucide-react';

export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';

export const metadata = async ({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }): Promise<Metadata> => {
  const title = 'Therapie‑Vermittlung – So funktioniert’s | Kaufmann Health';
  const description = 'In drei Schritten zu passenden Therapeut:innen: Anliegen teilen, handverlesene Vorschläge erhalten, direkt Termine vereinbaren. 80–120€ pro Sitzung, diese Woche verfügbar.';
  const v = (searchParams?.v as string) || undefined;
  return buildLandingMetadata({
    baseUrl,
    path: '/vermittlung',
    title,
    description,
    searchParams: { v },
  });
};

export default async function VermittlungPage() {
  const businessSchema = buildLocalBusinessJsonLd({ baseUrl, path: '/vermittlung', areaServed: { type: 'Country', name: 'Deutschland', addressCountry: 'DE' } });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      {/* Minimal intro with CTAs to /fragebogen */}
      <section aria-labelledby="hero-lite-heading" className="relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(36rem_16rem_at_110%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(28rem_14rem_at_-10%_90%,rgba(14,165,233,0.08),transparent_60%)]" />
        <h1 id="hero-lite-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl sm:flex sm:flex-wrap sm:items-baseline sm:gap-2">
          <span className="block sm:inline">Therapeuten‑Vermittlung</span>
          <span className="block sm:inline">– Einfach starten</span>
        </h1>
        <p className="mt-3 max-w-2xl text-gray-700">Wir wählen bis zu 3 passende Therapeut:innen für dich aus. Du wählst und vereinbarst direkt Termine.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" asChild className="w-full bg-black text-white hover:bg-black/90 sm:w-auto" data-cta="hero-primary">
            <CtaLink href="/fragebogen" eventType="cta_click">Zum Fragebogen</CtaLink>
          </Button>
          <Button size="lg" variant="outline" asChild className="w-full sm:w-auto" data-cta="hero-secondary">
            <CtaLink href="#ablauf" eventType="cta_click">So funktioniert’s</CtaLink>
          </Button>
        </div>
      </section>

      {/* Ablauf / Prozess */}
      <section id="ablauf" className="scroll-mt-24">
        <ProcessSteps
          heading="So funktioniert’s"
          items={[
            { step: 1, title: 'Du schilderst dein Anliegen', icon: <MessageCircle className="h-5 w-5" />, bullets: ['Stadt oder online, Zeitfenster, besondere Themen'] },
            { step: 2, title: 'Wir wählen bis zu 3 Profile aus', icon: <UserCheck className="h-5 w-5" />, bullets: ['Geprüfte Qualifikationen, passende Methoden, echte Verfügbarkeit'] },
            { step: 3, title: 'Du wählst & vereinbarst Termine', icon: <PhoneCall className="h-5 w-5" />, bullets: ['Direkter Kontakt, konkrete Vorschläge in 24h'] },
          ]}
        />
      </section>

      {/* Final CTA linking to /fragebogen */}
      <FinalCtaSection
        heading="Bereit? Starte mit 3 Fragen"
        subtitle="Der erste Schritt dauert weniger als 2 Minuten."
        buttonLabel="Zum Fragebogen"
        targetId="/fragebogen"
      />

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }} />
    </main>
  );
}
