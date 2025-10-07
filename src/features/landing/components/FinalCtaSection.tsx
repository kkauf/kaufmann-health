import VariantGate from "@/components/VariantGate";
import { Button } from "@/components/ui/button";
import CtaLink from "@/components/CtaLink";

export function FinalCtaSection({
  heading = "Der erste Schritt",
  subtitle,
  quote,
  buttonLabel = "Passende Therapeut:innen finden",
  targetId = "#top-form",
  footnoteText = "Kostenlos & unverbindlich. Antwort innerhalb von 24 Stunden.",
  variant = 'default',
  align = 'left',
  showAvailabilityNote = true,
  className,
}: {
  heading?: string;
  subtitle?: string;
  quote?: string;
  buttonLabel?: string;
  targetId?: string;
  footnoteText?: string;
  variant?: 'default' | 'tinted';
  align?: 'left' | 'center';
  showAvailabilityNote?: boolean;
  className?: string;
}) {
  const bgClass = variant === 'tinted'
    ? 'bg-emerald-50/70'
    : 'bg-gradient-to-b from-slate-50 to-white';
  const alignClass = align === 'center' ? 'text-center' : '';
  const sectionClass = (className ? className + ' ' : '') +
    `mt-12 sm:mt-16 relative overflow-hidden rounded-2xl border ${bgClass} p-6 sm:p-8 ${alignClass}`;
  return (
    <section
      aria-labelledby="final-cta-heading"
      className={sectionClass}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(36rem_16rem_at_110%_10%,rgba(99,102,241,0.08),transparent_60%),radial-gradient(28rem_14rem_at_-10%_90%,rgba(14,165,233,0.08),transparent_60%)]" />
      <h2 id="final-cta-heading" className="text-2xl font-semibold tracking-tight">{heading}</h2>
      {subtitle ? <p className="mt-3 max-w-2xl text-gray-700">{subtitle}</p> : null}
      {quote ? (
        <div className="mt-3 rounded-lg border bg-white/60 p-4 text-sm text-slate-700">{quote}</div>
      ) : null}

      <div className={`mt-6 ${align === 'center' ? 'flex justify-center' : ''}`}>
        <Button asChild size="lg" data-cta="final-primary" className={align === 'center' ? 'mx-auto' : ''}>
          <CtaLink href={targetId} eventType="cta_click" aria-label={buttonLabel}>
            {buttonLabel}
          </CtaLink>
        </Button>
        {showAvailabilityNote ? (
          <VariantGate show="B"><p className="mt-3 text-sm text-gray-600">Noch 3 Therapeut:innen mit freien Terminen diese Woche.</p></VariantGate>
        ) : null}
      </div>

      <p className="mt-4 text-sm text-gray-700">{footnoteText}</p>
    </section>
  );
}

export default FinalCtaSection;
