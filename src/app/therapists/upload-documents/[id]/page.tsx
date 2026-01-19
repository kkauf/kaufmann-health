import { notFound } from 'next/navigation';
import UploadForm from './UploadForm';
import { supabaseServer } from '@/lib/supabase-server';
import { OnboardingProgress } from '@/components/OnboardingProgress';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page(props: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await props.params;
  const sp = (await (props.searchParams || Promise.resolve({}))) as Record<string, string | string[] | undefined>;
  const stepRaw = sp?.['step'];
  const step = Array.isArray(stepRaw) ? stepRaw[0] : stepRaw;

  // Basic validation: therapist must exist and be in pending state
  const { data: row } = await supabaseServer
    .from('therapists')
    .select('id, status, first_name, last_name, photo_url, metadata')
    .eq('id', id)
    .single();

  if (!row) return notFound();
  // EARTH-71 note: Linear mentions `pending_documents`, our schema uses `pending_verification`.
  // Allow both pending_verification and rejected (Rückfrage) to upload documents
  const status = (row as { status?: string }).status || 'pending_verification';
  if (status !== 'pending_verification' && status !== 'rejected') {
    // Show a simple 404 to avoid information leak
    return notFound();
  }

  function isObject(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null; }
  const metaUnknown = (row as { metadata?: unknown }).metadata;
  const metadata = isObject(metaUnknown) ? (metaUnknown as Record<string, unknown>) : {};
  const docsUnknown = (metadata as { documents?: unknown }).documents;
  const documents = isObject(docsUnknown) ? (docsUnknown as Record<string, unknown>) : {};
  const hasLicense = typeof (documents as { license?: unknown }).license === 'string' && Boolean((documents as { license?: string }).license);
  const specialization = (documents as { specialization?: Record<string, string[]> }).specialization || {};
  const certCount = Object.values(specialization).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  const hasCert = certCount > 0;

  // Profile completeness signals to help redirect users who landed on the wrong step
  const profileUnknown = (metadata as { profile?: unknown }).profile;
  const profile = isObject(profileUnknown) ? (profileUnknown as Record<string, unknown>) : {};
  const approachText = (profile as { approach_text?: string | null }).approach_text ?? null;
  const photoPendingPath = (profile as { photo_pending_path?: string | null }).photo_pending_path ?? null;
  const approvedPhoto = (row as { photo_url?: string | null }).photo_url ?? null;
  const missingPhoto = !(approvedPhoto || photoPendingPath);
  const missingApproach = !approachText || String(approachText).trim().length === 0;

  const name = [
    (row as { first_name?: string }).first_name || '',
    (row as { last_name?: string }).last_name || '',
  ].join(' ').trim();

  const forceCertsStep = step === 'certs';

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <OnboardingProgress currentStep={2} />
      
      <h1 className="text-2xl font-semibold">Schritt 2: Dokumente hochladen</h1>
      {name ? (
        <p className="mt-2 text-sm text-gray-700">Therapeut/in: {name}</p>
      ) : null}
      {(missingPhoto || missingApproach) ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            Fehlen noch Profilangaben (Foto oder Beschreibung)? Hier entlang:
            {' '}
            <a className="underline font-medium" href={`/therapists/complete-profile/${id}`}>
              Profil vervollständigen
            </a>
          </p>
        </div>
      ) : null}
      {!hasLicense && !forceCertsStep ? (
        <>
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">📋 Staatliche Zulassung erforderlich</p>
            <p className="mt-1 text-sm text-blue-800">
              Lade deine staatlich anerkannte Psychotherapie-Berechtigung hoch (PDF oder Bild, max. 4MB).
            </p>
          </div>
          <div className="mt-6">
            <UploadForm therapistId={id} mode="license" />
          </div>
        </>
      ) : !hasCert ? (
        <>
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">✅ Zulassung hochgeladen</p>
            <p className="mt-1 text-sm text-blue-800">
              Jetzt bitte mindestens ein Abschlusszertifikat deiner Spezialisierung hochladen (NARM, Hakomi, Somatic Experiencing, Core Energetics). Je Datei max. 4MB.
            </p>
          </div>
          <div className="mt-6">
            <UploadForm therapistId={id} mode="certs" />
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600">
              <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-emerald-900">Dokumente hochgeladen!</h2>
              <p className="text-sm text-emerald-800 mt-1">Deine Zulassung und Zertifikate wurden übermittelt.</p>
              <a
                href={`/therapists/onboarding-complete/${id}`}
                className="mt-4 inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Weiter zur Bestätigung →
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
