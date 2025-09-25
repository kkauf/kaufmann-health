import TherapistPreview from "@/components/TherapistPreview";
import { getTherapistsByIds, getTherapistsForLanding } from "../lib/therapists";

export async function TherapistTeaserSection({
  title = "Deine Expert:innen",
  subtitle = "Durchschnittlich 7+ Jahre Erfahrung",
  ids,
  filters,
  limit = 3,
  randomize = true,
  className,
}: {
  title?: string;
  subtitle?: string;
  ids?: string[];
  filters?: { city?: string; accepting_new?: boolean };
  limit?: number;
  randomize?: boolean;
  className?: string;
}) {
  const therapists = ids && ids.length > 0
    ? await getTherapistsByIds(ids)
    : await getTherapistsForLanding({ ...filters, limit });

  const displayed = (() => {
    if (ids && ids.length > 0) return therapists.slice(0, limit);
    if (!randomize) return therapists.slice(0, limit);
    const copy = [...therapists];
    // Fisher–Yates shuffle for stable randomization on each render
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, limit);
  })();

  return (
    <section aria-labelledby="trust-previews" className={(className ? className + " " : "") + "mt-10 sm:mt-14"}>
      <h2 id="trust-previews" className="text-2xl font-semibold tracking-tight">{title}</h2>
      {subtitle ? <p className="mt-2 max-w-2xl text-gray-700">{subtitle}</p> : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayed.map((t) => (
          <TherapistPreview key={t.id} therapist={t} />
        ))}
      </div>
    </section>
  );
}

export default TherapistTeaserSection;
