import type { Metadata } from 'next';
import PageAnalytics from '@/components/PageAnalytics';
import { TherapistDirectory } from '@/features/therapists/components/TherapistDirectory';
import { TherapistMatchCallout } from '@/features/therapists/components/TherapistMatchCallout';
import { buildLandingMetadata } from '@/lib/seo';

export const revalidate = 3600;

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

export default function TherapeutenPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <PageAnalytics qualifier="Therapeuten-Directory" />

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Unsere Therapeut:innen
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          Persönlich ausgewählte Spezialist:innen für körperorientierte Psychotherapie
        </p>
      </div>

      <TherapistMatchCallout />

      <TherapistDirectory />
    </main>
  );
}
