import { getTherapistsByIds, getTherapistsForLanding } from "../lib/therapists";
import { TherapistTeaserClient } from './TherapistTeaserClient';

export async function TherapistTeaserSection({
  title = "Deine Expert:innen",
  subtitle = "Durchschnittlich 7+ Jahre Erfahrung",
  ids,
  filters,
  limit = 3,
  randomize = true,
  className,
  showViewAllButton = false,
  viewAllButtonText = "Alle Therapeut:innen ansehen",
  viewAllButtonHref = "/therapeuten",
  showSchwerpunkte = false,
}: {
  title?: string;
  subtitle?: string;
  ids?: string[];
  filters?: { city?: string; accepting_new?: boolean; modalities?: string[] };
  limit?: number;
  randomize?: boolean;
  className?: string;
  showViewAllButton?: boolean;
  viewAllButtonText?: string;
  viewAllButtonHref?: string;
  /** When true, show schwerpunkte badges instead of modality badges */
  showSchwerpunkte?: boolean;
}) {
  // Fetch therapists on the server
  const data = ids && ids.length > 0
    ? await getTherapistsByIds(ids)
    : await getTherapistsForLanding({ ...filters, limit });
  
  const displayed = (() => {
    if (ids && ids.length > 0) return data.slice(0, limit);
    if (!randomize) return data.slice(0, limit);
    const copy = [...data];
    // Fisher–Yates shuffle
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, limit);
  })();

  return (
    <TherapistTeaserClient
      therapists={displayed}
      title={title}
      subtitle={subtitle}
      className={className}
      showViewAllButton={showViewAllButton}
      viewAllButtonText={viewAllButtonText}
      viewAllButtonHref={viewAllButtonHref}
      showSchwerpunkte={showSchwerpunkte}
    />
  );
}

export default TherapistTeaserSection;
