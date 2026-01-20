import type { Metadata } from "next";
import { MODALITIES } from "@/features/therapies/modalityConfig";

// Campaign landing pages are noindex - they're for paid traffic only
export async function generateMetadata({ params }: { params: Promise<{ modality: string }> }): Promise<Metadata> {
  const { modality } = await params;
  const modalityConfig = Object.values(MODALITIES).find(m => m.slug === modality);

  const title = modalityConfig
    ? `${modalityConfig.name} Therapeut:in finden | Kaufmann Health`
    : 'Therapeut:in finden | Kaufmann Health';

  return {
    title,
    robots: { index: false, follow: false }, // Campaign pages - no SEO
  };
}

export default function CampaignLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
