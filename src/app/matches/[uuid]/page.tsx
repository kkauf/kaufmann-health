import type { Metadata } from 'next';
import PageAnalytics from '@/components/PageAnalytics';
import DirectoryAnalytics from '@/features/therapists/components/DirectoryAnalytics';
import { TherapistDirectory } from '@/features/therapists/components/TherapistDirectory';
import type { TherapistData } from '@/features/therapists/components/TherapistDirectory';
import { CheckCircle, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Ihre persönlichen Empfehlungen – Kaufmann Health',
    description: 'Sehen Sie Ihre handverlesenen Therapie‑Empfehlungen und kontaktieren Sie Ihre bevorzugte Therapeut:in ohne erneute Verifizierung.',
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid: raw } = await params;
  const uuid = (raw || '').trim();
  if (!uuid) return null;

  const base = process.env.NEXT_PUBLIC_BASE_URL
    ? process.env.NEXT_PUBLIC_BASE_URL
    : (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : '');
  let modalityMatters = false;
  let initialTherapists: TherapistData[] = [];
  let matchedIds: string[] = [];
  try {
    const res = await fetch(`${base}/api/public/matches/${encodeURIComponent(uuid)}`, { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as { data?: { therapists?: any[]; patient?: { modality_matters?: boolean } } };
      const ts = Array.isArray(json?.data?.therapists) ? (json!.data!.therapists as any[]) : [];
      matchedIds = ts.map((t) => String(t.id));
      modalityMatters = Boolean(json?.data?.patient?.modality_matters);
      // Map therapists from matches API to TherapistData shape expected by directory
      initialTherapists = ts.map((t) => ({
        id: String(t.id),
        first_name: String(t.first_name || ''),
        last_name: String(t.last_name || ''),
        photo_url: t.photo_url || undefined,
        city: String(t.city || ''),
        modalities: Array.isArray(t.modalities) ? (t.modalities as string[]) : [],
        session_preferences: Array.isArray(t.session_preferences) ? (t.session_preferences as string[]) : [],
        accepting_new: t.accepting_new === false ? false : true,
        approach_text: String(t.approach_text || ''),
        typical_rate: typeof t.typical_rate === 'number' ? t.typical_rate : undefined,
        availability: Array.isArray(t.availability) ? (t.availability as { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string }[]) : [],
      }));

      // If more than one therapist overall AND more than one with booking slots,
      // show only those with availability (direct booking possible).
      const withAvailability = initialTherapists.filter(
        (t) => Array.isArray(t.availability) && t.availability.length > 0,
      );
      if (initialTherapists.length > 1 && withAvailability.length > 1) {
        initialTherapists = withAvailability;
        const allowed = new Set(withAvailability.map((t) => t.id));
        matchedIds = matchedIds.filter((id) => allowed.has(id));
      }
    }
  } catch {}

  const isDirectBookingFlow = (process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW || '').toLowerCase() === 'true';

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <PageAnalytics qualifier="Matches-Directory" />
        <DirectoryAnalytics />

        <section aria-labelledby="matches-directory-heading" className="mb-4">
          <h1 id="matches-directory-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {isDirectBookingFlow ? 'Deine passenden Ergebnisse' : 'Deine persönlichen Empfehlungen'}
          </h1>
          <p className="mt-1 text-base text-gray-600">
            {isDirectBookingFlow
              ? 'Basierend auf deinen Angaben und aktueller Verfügbarkeit'
              : 'Katherine und Konstantin haben basierend auf deiner Anfrage ausgewählt'}
          </p>
        </section>

        {/* Banners */}
        {!isDirectBookingFlow && (
          <div className="mb-8 rounded-xl border border-slate-200/60 bg-gradient-to-br from-slate-50/80 to-white p-6 shadow-md">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Warum diese Auswahl?
            </h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                <span>Wir haben uns deiner Anfrage persönlich angenommen.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                <span>Die Auswahl basiert auf deinen individuellen Präferenzen und Bedürfnissen.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                <span>Wir prüfen die Qualifikationen der Therapeut:innen gründlich.</span>
              </li>
              {modalityMatters && (
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span>Spezielle Ausbildungen (NARM, Somatic Experiencing, Hakomi, Core Energetics) sind in den farbigen Abzeichen sichtbar.</span>
                </li>
              )}
            </ul>
            <p className="mt-4 font-semibold text-gray-900">Sorgfältig geprüfte Profile – persönlich ausgewählt.</p>
          </div>
        )}

        {isDirectBookingFlow && (
          <div className="mb-8 rounded-xl border border-slate-200/60 bg-gradient-to-br from-slate-50/80 to-white p-6 shadow-md">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Warum diese Ergebnisse?
            </h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                <span>Basierend auf deinen Präferenzen und aktueller Verfügbarkeit.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                <span>Profile und Qualifikationen verifiziert.</span>
              </li>
              {modalityMatters && (
                <li className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  <span>Spezielle Ausbildungen (NARM, Somatic Experiencing, Hakomi, Core Energetics) sind in den farbigen Abzeichen sichtbar.</span>
                </li>
              )}
            </ul>
            <p className="mt-4 font-semibold text-gray-900">Sorgfältig geprüfte Profile.</p>
          </div>
        )}

        <TherapistDirectory
          initialTherapists={initialTherapists}
          disableClientFetch={initialTherapists.length > 0}
          restrictToIds={matchedIds}
          emptyState={{
            title: 'Keine passenden Therapeuten gefunden',
            ctaHref: '/therapeuten',
            ctaText: 'Alle Therapeuten ansehen',
          }}
        />
      </main>
    </>
  );
}
