import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CtaLink from "@/components/CtaLink";

export type Tier = {
  title: string;
  priceLabel: string;
  sublabel?: string;
  bullets?: string[];
  highlight?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
};

export function InvestmentSection({
  heading = "Deine Investition",
  intro,
  mode = "note",
  tiers,
  noteItems,
  defaultCtaHref = "#top-form",
  id,
}: {
  heading?: string;
  intro?: string;
  mode?: "tiers" | "note";
  tiers?: Tier[];
  noteItems?: string[];
  defaultCtaHref?: string;
  id?: string;
}) {
  if (mode === "tiers") {
    const effectiveTiers: Tier[] = tiers && tiers.length > 0 ? tiers : defaultTiers(defaultCtaHref);
    return (
      <section id={id || "pricing"} aria-labelledby="pricing-heading" className="scroll-mt-24 mt-10 sm:mt-14">
        <h2 id="pricing-heading" className="text-2xl font-semibold tracking-tight">{heading}</h2>
        {intro ? <p className="mt-3 max-w-2xl text-gray-700">{intro}</p> : null}
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {effectiveTiers.map((t, i) => (
            <Card key={i} className={t.highlight ? "border-emerald-200 hover:shadow-md transition-all duration-200" : "hover:shadow-md transition-all duration-200"}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  {t.highlight ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Beliebt</span>
                  ) : null}
                  <CardTitle>{t.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{t.priceLabel}</div>
                {t.sublabel ? <div className="text-sm text-gray-600">{t.sublabel}</div> : null}
                {t.bullets && t.bullets.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
                    {t.bullets.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                ) : null}
                <div className="mt-5">
                  <Button asChild size="lg">
                    <CtaLink href={t.ctaHref || defaultCtaHref} eventType="cta_click">
                      {t.ctaLabel || "Passende Therapeut:innen finden"}
                    </CtaLink>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-sm text-gray-600">Alle Preise inkl. MwSt. | Termine flexibel vereinbar | Absagen bis 24h vorher kostenfrei</p>
      </section>
    );
  }

  // note mode
  const items = noteItems && noteItems.length > 0 ? noteItems : defaultNoteItems();
  return (
    <section id={id} aria-labelledby="investment-heading" className="scroll-mt-24 mt-10 sm:mt-14">
      <h2 id="investment-heading" className="text-2xl font-semibold tracking-tight">{heading}</h2>
      {intro ? <p className="mt-3 max-w-2xl text-gray-700">{intro}</p> : null}
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </section>
  );
}

function defaultTiers(defaultCtaHref: string): Tier[] {
  return [
    {
      title: "Einzelsitzung",
      priceLabel: "120€",
      sublabel: "pro Sitzung (60 Minuten)",
      bullets: ["Flexibel buchbar", "Ideal zum Kennenlernen"],
      ctaHref: defaultCtaHref,
    },
    {
      title: "Paket „Zurück ins Spüren“",
      priceLabel: "1.000€",
      sublabel: "10 Sitzungen",
      highlight: true,
      bullets: ["200€ Ersparnis", "Für nachhaltige Veränderung"],
      ctaHref: defaultCtaHref,
    },
    {
      title: "Intensivbegleitung",
      priceLabel: "1.800€",
      sublabel: "20 Sitzungen",
      bullets: ["600€ Ersparnis", "Tiefgreifende Transformation"],
      ctaHref: defaultCtaHref,
    },
  ];
}

function defaultNoteItems(): string[] {
  return [
    "80–120€ pro Sitzung (60 Minuten)",
    "Sofort starten: keine 3–9 Monate Wartezeit",
    "Volle Diskretion: keine Kassenabrechnung, keine Diagnose",
    "Termine flexibel vereinbar",
  ];
}

export default InvestmentSection;
