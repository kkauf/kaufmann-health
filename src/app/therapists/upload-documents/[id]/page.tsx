import { notFound } from 'next/navigation';
import UploadForm from './UploadForm';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  // Basic validation: therapist must exist and be in pending state
  const { data: row } = await supabaseServer
    .from('therapists')
    .select('id, status, first_name, last_name')
    .eq('id', id)
    .single();

  if (!row) return notFound();
  // EARTH-71 note: Linear mentions `pending_documents`, our schema uses `pending_verification`.
  const status = (row as { status?: string }).status || 'pending_verification';
  if (status !== 'pending_verification') {
    // Show a simple 404 to avoid information leak
    return notFound();
  }

  const name = [
    (row as { first_name?: string }).first_name || '',
    (row as { last_name?: string }).last_name || '',
  ].join(' ').trim();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Dokumente hochladen</h1>
      {name ? (
        <p className="mt-2 text-sm text-gray-700">Therapeut/in: {name}</p>
      ) : null}
      <p className="mt-4 text-sm text-gray-700">
        Bitte laden Sie Ihre staatliche Psychotherapie-Berechtigung und mindestens ein Abschlusszertifikat eines Therapieverfahrens hoch. PDF oder Bilddatei, maximal 10MB pro Datei.
      </p>
      <div className="mt-6">
        <UploadForm therapistId={id} />
      </div>
    </main>
  );
}
