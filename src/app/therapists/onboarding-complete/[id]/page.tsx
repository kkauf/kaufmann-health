import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const { data: row } = await supabaseServer
    .from('therapists')
    .select('id, status, first_name, last_name')
    .eq('id', id)
    .single();

  if (!row) return notFound();
  const status = (row as { status?: string }).status || 'pending_verification';

  const name = [
    (row as { first_name?: string }).first_name || '',
    (row as { last_name?: string }).last_name || '',
  ].join(' ').trim();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900">Registrierung abgeschlossen!</h1>
        {name && <p className="mt-2 text-gray-600">Danke, {name}.</p>}
        
        <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-semibold text-emerald-900">Was passiert jetzt?</h2>
          <div className="mt-4 space-y-3 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-200 text-sm font-semibold text-emerald-800">
                1
              </div>
              <div className="text-sm text-emerald-900">
                <span className="font-medium">Prüfung durch unser Team</span>
                <p className="mt-1 text-emerald-800">Wir prüfen deine Unterlagen innerhalb von 2 Werktagen.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-200 text-sm font-semibold text-emerald-800">
                2
              </div>
              <div className="text-sm text-emerald-900">
                <span className="font-medium">Bestätigung per E-Mail</span>
                <p className="mt-1 text-emerald-800">Du erhältst eine E-Mail, sobald dein Profil freigeschaltet ist.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-200 text-sm font-semibold text-emerald-800">
                3
              </div>
              <div className="text-sm text-emerald-900">
                <span className="font-medium">Klienten-Anfragen empfangen</span>
                <p className="mt-1 text-emerald-800">Sobald du freigeschaltet bist, können wir dir passende Klient:innen vermitteln.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6 text-left">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Fragen oder Änderungen?</span><br />
            Schreib uns gerne an{' '}
            <a href="mailto:hallo@kaufmann-health.de" className="text-emerald-600 underline">
              hallo@kaufmann-health.de
            </a>
          </p>
        </div>

        <p className="mt-8 text-sm text-gray-500">Du kannst dieses Fenster jetzt schließen.</p>
      </div>
    </main>
  );
}
