import type { Metadata } from 'next';
import PageAnalytics from '@/components/PageAnalytics';
import { TherapistDirectory } from '@/features/therapists/components/TherapistDirectory';
import { TherapistMatchCallout } from '@/features/therapists/components/TherapistMatchCallout';
import { buildLandingMetadata } from '@/lib/seo';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';
import DirectoryAnalytics from '@/features/therapists/components/DirectoryAnalytics';

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
    <>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        <PageAnalytics qualifier="Therapeuten-Directory" />
        <DirectoryAnalytics />

        <section aria-labelledby="directory-heading" className="mb-8">
          <h1 id="directory-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Unsere Therapeut:innen
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Persönlich ausgewählte Spezialist:innen für körperorientierte Psychotherapie
          </p>
        </section>

        <TherapistMatchCallout />

        <TherapistDirectory />
      </main>
      <FloatingWhatsApp />
    </>
  );
}
