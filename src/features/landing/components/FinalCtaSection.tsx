import VariantGate from "@/components/VariantGate";
import { Button } from "@/components/ui/button";
import CtaLink from "@/components/CtaLink";

export function FinalCtaSection({
  heading = "Der erste Schritt",
  subtitle,
  quote,
  buttonLabel = "Passende Therapeut:innen finden",
  targetId = "#top-form",
  className,
}: {
  heading?: string;
  subtitle?: string;
  quote?: string;
  buttonLabel?: string;
  targetId?: string;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className={(className ? className + " " : "") + "mt-12 sm:mt-16 relative overflow-hidden rounded-2xl border bg-gradient-to-b from-slate-50 to-white p-6 sm:p-8"}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(36rem_16rem_at_110%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(28rem_14rem_at_-10%_90%,rgba(14,165,233,0.08),transparent_60%)]" />
      <h2 id="final-cta-heading" className="text-2xl font-semibold tracking-tight">{heading}</h2>
      {subtitle ? <p className="mt-3 max-w-2xl text-gray-700">{subtitle}</p> : null}
      {quote ? (
        <div className="mt-3 rounded-lg border bg-white/60 p-4 text-sm text-slate-700">{quote}</div>
      ) : null}

      <div className="mt-6">
        <Button asChild size="lg" data-cta="final-primary">
          <CtaLink href={targetId} eventType="cta_click" aria-label={buttonLabel}>
            {buttonLabel}
          </CtaLink>
        </Button>
        <VariantGate show="B"><p className="mt-3 text-sm text-gray-600">Noch 3 Therapeut:innen mit freien Terminen diese Woche.</p></VariantGate>
      </div>

      <p className="mt-4 text-sm text-gray-700">Kostenlos &amp; unverbindlich. Antwort innerhalb von 24 Stunden.</p>
    </section>
  );
}

export default FinalCtaSection;
