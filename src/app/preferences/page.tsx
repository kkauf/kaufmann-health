import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PreferencesForm } from '@/components/PreferencesForm';
import { PreferencesViewTracker } from '@/components/PreferencesViewTracker';

export const metadata = {
  title: 'Präferenzen | Kaufmann Health',
  description: 'Sagen Sie uns kurz, was Ihnen wichtig ist – wir finden passende Empfehlungen.',
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const confirm = typeof sp?.confirm === 'string' ? sp.confirm : undefined;
  const id = typeof sp?.id === 'string' ? sp.id : undefined;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PreferencesViewTracker leadId={id} />
      {confirm === '1' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>E‑Mail bestätigt</CardTitle>
            <CardDescription>
              Danke! Ihre E‑Mail‑Adresse ist bestätigt. Damit wir die besten Therapeut:innen für dich finden können, benötigen wir noch ein paar wenige Informationen von dir. Deine Präferenzen werden vertraulich behandelt und werden und nur an Therapeut:innen weitergegeben, mit denen du zusammenarbeiten möchtest. 
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {id ? (
        <PreferencesForm leadId={id} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Link unvollständig</CardTitle>
            <CardDescription>
              Uns fehlt eine Kennung, um fortzufahren. Bitte öffnen Sie den Link aus Ihrer E‑Mail erneut oder starten Sie den Vorgang neu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/therapie-finden" className="underline">Neu starten</Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
