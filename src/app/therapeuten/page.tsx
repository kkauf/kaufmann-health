import type { Metadata } from 'next';
import PageAnalytics from '@/components/PageAnalytics';
import { TherapistDirectory } from '@/features/therapists/components/TherapistDirectory';
import type { TherapistData } from '@/features/therapists/components/TherapistDirectory';
import { TherapistMatchCallout } from '@/features/therapists/components/TherapistMatchCallout';
import { buildLandingMetadata } from '@/lib/seo';
import DirectoryAnalytics from '@/features/therapists/components/DirectoryAnalytics';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.kaufmann-health.de';

export const metadata: Metadata = {
  ...buildLandingMetadata({
    baseUrl,
    path: '/therapeuten',
    title: 'Therapeuten-Verzeichnis – Kaufmann Health',
    description: 'Finde den passenden Therapeuten für dich. Filtere nach Standort, Online-Therapie und Modalität.',
  }),
  robots: { index: false, follow: false },
};

export default async function TherapeutenPage() {
  let initialTherapists: TherapistData[] = [];
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ? process.env.NEXT_PUBLIC_BASE_URL : ''}/api/public/therapists`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = (await res.json()) as { therapists?: TherapistData[] };
      if (Array.isArray(json?.therapists)) initialTherapists = json.therapists as TherapistData[];
    }
  } catch {}

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <PageAnalytics qualifier="Therapeuten-Directory" />
        <DirectoryAnalytics />

        <section aria-labelledby="directory-heading" className="mb-4">
          <h1 id="directory-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Unsere Therapeut:innen
          </h1>
          <p className="mt-1 text-base text-gray-600">
            Persönlich ausgewählte Spezialist:innen für körperorientierte Psychotherapie
          </p>
        </section>
        
        <TherapistDirectory initialTherapists={initialTherapists} />

        {/* Moved below results to reduce header height */}
        <div className="mt-10">
          <TherapistMatchCallout />
        </div>
      </main>
    </>
  );
}
