import { notFound } from 'next/navigation';
import UploadForm from './UploadForm';
import { supabaseServer } from '@/lib/supabase-server';

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
    .select('id, status, first_name, last_name, metadata')
    .eq('id', id)
    .single();

  if (!row) return notFound();
  // EARTH-71 note: Linear mentions `pending_documents`, our schema uses `pending_verification`.
  const status = (row as { status?: string }).status || 'pending_verification';
  if (status !== 'pending_verification') {
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

  const name = [
    (row as { first_name?: string }).first_name || '',
    (row as { last_name?: string }).last_name || '',
  ].join(' ').trim();

  const forceCertsStep = step === 'certs';

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Dokumente hochladen</h1>
      {name ? (
        <p className="mt-2 text-sm text-gray-700">Therapeut/in: {name}</p>
      ) : null}
      {!hasLicense && !forceCertsStep ? (
        <>
          <p className="mt-4 text-sm text-gray-700">
            Bitte laden Sie zuerst Ihre staatliche Psychotherapie-Berechtigung hoch. PDF oder Bilddatei, maximal 4MB pro Datei.
          </p>
          <div className="mt-6">
            <UploadForm therapistId={id} mode="license" />
          </div>
        </>
      ) : !hasCert ? (
        <>
          <p className="mt-4 text-sm text-gray-700">
            Danke. Als nächstes laden Sie bitte mindestens ein Abschlusszertifikat Ihrer Therapieverfahren hoch (je Datei max. 4MB).
          </p>
          <div className="mt-6">
            <UploadForm therapistId={id} mode="certs" />
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-lg border bg-white p-4">
          <p className="text-sm text-gray-700">Ihre Zulassung und mindestens ein Zertifikat sind hinterlegt.</p>
          <p className="text-sm text-gray-700 mt-2">
            Nächster Schritt: <a className="underline" href={`/therapists/complete-profile/${id}`}>Profil vervollständigen</a>
          </p>
        </div>
      )}
    </main>
  );
}
