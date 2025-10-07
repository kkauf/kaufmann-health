import Image from 'next/image';

export function FoundersValuesSection({
  heading = 'Was uns auszeichnet',
  imageSrc = '/images/katherine and konstantin.PNG',
}: {
  heading?: string;
  imageSrc?: string;
}) {
  return (
    <section aria-labelledby="founders-heading" className="mt-10 rounded-2xl border bg-white p-6 sm:mt-14 sm:p-8">
      <h2 id="founders-heading" className="text-2xl font-semibold tracking-tight">{heading}</h2>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl ring-1 ring-slate-200">
          <Image
            src={imageSrc}
            alt="Katherine und Konstantin von Kaufmann Health"
            fill
            sizes="(min-width: 1024px) 360px, 100vw"
            className="object-cover"
            priority
          />
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-slate-700">
              Wir sind Katherine und Konstantin – ein familiengeführtes Team, das Therapie‑, Technologie‑ und
              Rechtskompetenz vereint.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Point title="Familiengeführt">
              Katherine ist Heilpraktikerin für Psychotherapie, Konstantin bringt Erfahrung aus Tech und Product.
              Gemeinsam verbinden wir Menschen mit den richtigen Therapeut:innen – persönlich statt algorithmisch.
            </Point>
            <Point title="Persönliche Kuration">
              Wir kennen jede:n Therapeut:in persönlich und prüfen jede Anfrage individuell. Keine automatischen
              Matches – nur durchdachte Empfehlungen.
            </Point>
            <Point title="Trauma‑informiert">
              Alle Therapeut:innen arbeiten mit körperorientierten, trauma‑informierten Ansätzen – weil echte Veränderung
              mehr braucht als Verstehen allein.
            </Point>
            <Point title="Privatsphäre zuerst">
              Keine Krankenkassen‑Diagnose, keine Datenweitergabe, keine Werbepartner. DSGVO‑konform und SSL‑verschlüsselt.
            </Point>
          </div>
        </div>
      </div>
    </section>
  );
}

function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-4">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{children}</p>
    </div>
  );
}

export default FoundersValuesSection;
