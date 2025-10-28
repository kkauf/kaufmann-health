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
        
        <TherapistDirectory />

        {/* Moved below results to reduce header height */}
        <div className="mt-10">
          <TherapistMatchCallout />
        </div>
      </main>
      <FloatingWhatsApp />
    </>
  );
}
