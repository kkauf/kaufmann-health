import Image from 'next/image';

export function FoundersValuesSection({
  heading = 'Was uns auszeichnet',
  imageSrc = '/images/katherine and konstantin.PNG',
}: {
  heading?: string;
  imageSrc?: string;
}) {
  return (
    <section aria-labelledby="founders-heading" className="relative mt-14 rounded-2xl border border-gray-200/60 bg-white shadow-md p-8 sm:mt-20 sm:p-10 lg:mt-24">
      {/* Optional subtle overlay */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent to-slate-50/30 rounded-2xl" />

      <h2 id="founders-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{heading}</h2>

      <div className="mt-8 sm:mt-10 grid gap-8 lg:grid-cols-[380px_1fr] lg:gap-10">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-slate-300/50">
          <Image
            src={imageSrc}
            alt="Katherine und Konstantin von Kaufmann Health"
            fill
            sizes="(min-width: 1024px) 380px, 100vw"
            className="object-cover"
            priority
          />
        </div>

        <div className="space-y-8">
          <div>
            <p className="text-base sm:text-lg leading-relaxed text-slate-700">
              Wir sind Katherine und Konstantin – ein familiengeführtes Team, das Therapie‑, Technologie‑ und
              Rechtskompetenz vereint.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
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
    <div className="group rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <h3 className="text-base sm:text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-700">{children}</p>
    </div>
  );
}

export default FoundersValuesSection;
