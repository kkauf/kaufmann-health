import VariantGate from "@/components/VariantGate";
import CheckList from "@/components/CheckList";

export function PrivacySelfPaySection({
  titleA = "Therapie ohne Krankenkasseneintrag",
  titleB = "Therapie ohne Krankenkasseneintrag",
  titleC = "Coaching & Begleitung – ohne Krankenkasseneintrag",
  intro = "Deine mentale Gesundheit, deine Privatsphäre.",
  items = [
    "Keine S‑Nummer: kein Eintrag bei der Krankenkasse, keine ICD‑10‑Diagnose in der Kassenakte",
    "Karrierefreundlich: relevant für Verbeamtung sowie Lebens‑/Berufsunfähigkeitsversicherung",
    "Sofort starten: keine 3–9 Monate Wartezeit, kein Gutachterverfahren",
  ],
  className,
}: {
  titleA?: string;
  titleB?: string;
  titleC?: string;
  intro?: string;
  items?: string[];
  className?: string;
}) {
  return (
    <section aria-labelledby="privacy-benefit" className={"mt-10 sm:mt-14 rounded-2xl border bg-white p-5 sm:p-6 " + (className || '')}>
      <VariantGate show="C">
        <h2 id="privacy-benefit" className="text-2xl font-semibold tracking-tight">{titleC}</h2>
      </VariantGate>
      <VariantGate show="A">
        <h2 id="privacy-benefit" className="text-2xl font-semibold tracking-tight">{titleA}</h2>
      </VariantGate>
      <VariantGate show="B">
        <h2 id="privacy-benefit" className="text-2xl font-semibold tracking-tight">{titleB}</h2>
      </VariantGate>
      <p className="mt-2 max-w-2xl text-gray-700">{intro}</p>
      <div className="mt-4">
        <CheckList items={items} />
      </div>
    </section>
  );
}

export default PrivacySelfPaySection;
