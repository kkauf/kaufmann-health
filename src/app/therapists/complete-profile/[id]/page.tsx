import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import ProfileForm from './ProfileForm';
import { OnboardingProgress } from '@/components/OnboardingProgress';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const { data: row } = await supabaseServer
    .from('therapists')
    .select('id, status, first_name, last_name, gender, city, accepting_new, photo_url, metadata')
    .eq('id', id)
    .single();

  if (!row) return notFound();
  const status = (row as { status?: string }).status || 'pending_verification';
  // Allow both pending_verification and rejected (Rückfrage) to complete profile
  if (status !== 'pending_verification' && status !== 'rejected') {
    // Do not 404 to avoid confusion when therapists revisit the email link later.
    // Keep the content generic to avoid information leakage.
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Profil vervollständigen</h1>
        <div className="mt-6 rounded-lg border bg-white p-4">
          <p className="text-sm">Dieser Link ist nicht mehr aktiv oder dein Profil wurde bereits bearbeitet.</p>
          <p className="text-sm mt-2">
            Wenn du Unterstützung brauchst, schreib uns bitte an{' '}
            <a className="underline" href="mailto:hallo@kaufmann-health.de">hallo@kaufmann-health.de</a>.
          </p>
        </div>
      </main>
    );
  }

  function isObject(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null; }
  const meta = (row as { metadata?: unknown }).metadata;
  const metaObj: Record<string, unknown> = isObject(meta) ? (meta as Record<string, unknown>) : {};
  const profileUnknown = (metaObj as { profile?: unknown }).profile;
  const profile: Record<string, unknown> = isObject(profileUnknown) ? (profileUnknown as Record<string, unknown>) : {};

  const gender = (row as { gender?: string | null }).gender ?? null;
  const city = (row as { city?: string | null }).city ?? null;
  const accepting_new = (row as { accepting_new?: boolean | null }).accepting_new ?? null;
  const approach_text = (profile as { approach_text?: string | null }).approach_text ?? null;
  const photo_pending_path = (profile as { photo_pending_path?: string | null }).photo_pending_path ?? null;
  const photo_url = (row as { photo_url?: string | null }).photo_url ?? null;

  const showGender = !(gender === 'male' || gender === 'female' || gender === 'diverse');
  const showCity = !city;
  const showAcceptingNew = accepting_new === null;
  // Skip approach_text during onboarding - therapists complete this in the portal after verification
  const showApproachText = false;
  const showProfilePhoto = !photo_url && !photo_pending_path;

  const name = [ (row as { first_name?: string | null }).first_name || '', (row as { last_name?: string | null }).last_name || '' ].join(' ').trim();

  const defaults = { gender, city, accepting_new, approach_text } as const;

  const totalMissing = [showGender, showCity, showAcceptingNew, showProfilePhoto].filter(Boolean).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <OnboardingProgress currentStep={1} />
      
      <h1 className="text-2xl font-semibold">Schritt 1: Profil vervollständigen</h1>
      {name ? <p className="mt-2 text-sm text-gray-700">Therapeut/in: {name}</p> : null}
      
      <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-900">
          ✨ <span className="font-medium">Fast geschafft:</span> Füge dein Foto und deine Basisdaten hinzu. Im nächsten Schritt laden wir dann die offiziellen Dokumente hoch.
        </p>
      </div>

      {totalMissing === 0 ? (
        <div className="mt-6 rounded-lg border bg-white p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900">Profildaten vollständig</h2>
              <p className="mt-1 text-sm text-slate-600">
                {status === 'rejected' 
                  ? 'Bitte lade jetzt die fehlenden Dokumente hoch, damit wir dein Profil freischalten können.'
                  : 'Weiter zum Dokumenten-Upload.'}
              </p>
              <a 
                href={`/therapists/upload-documents/${id}`}
                className="mt-4 inline-flex items-center justify-center rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                Dokumente hochladen →
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <ProfileForm
            therapistId={id}
            showGender={showGender}
            showCity={showCity}
            showAcceptingNew={showAcceptingNew}
            showApproachText={showApproachText}
            showProfilePhoto={showProfilePhoto}
            defaults={defaults}
          />
        </div>
      )}
    </main>
  );
}
