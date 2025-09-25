import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AutoRedirect } from './AutoRedirect';

export const metadata: Metadata = {
  title: 'E-Mail bestätigt – Kaufmann Health',
  description: 'Deine E-Mail-Adresse wurde bestätigt. Wir bereiten deine persönlichen Empfehlungen vor.',
  robots: { index: false, follow: false },
};

export default async function ConfirmedPage({ searchParams }: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const name = undefined;
  const params = (await searchParams) || {};
  const fsParam = (params['fs'] ?? '') as string | string[];
  const fs = Array.isArray(fsParam) ? fsParam[0] : fsParam;
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <h1 className="text-3xl font-semibold">✓ Deine E-Mail-Adresse ist bestätigt</h1>
      <p>
        Vielen Dank{typeof name === 'string' && name ? `, ${name}` : ''}! Wir prüfen deine Angaben und senden dir innerhalb von 24 Stunden
        persönlich kuratierte Therapeut:innen-Vorschläge.
      </p>
      <div className="rounded-md border p-4 bg-emerald-50 border-emerald-200">
        <p className="font-medium">Was als Nächstes passiert</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Wir gleichen deine Präferenzen mit unserem Netzwerk ab</li>
          <li>Du erhältst eine E-Mail mit deiner Auswahl und einem 1‑Klick‑Bestätigungslink</li>
          <li>Du wählst deine:n Therapeut:in innerhalb von 48 Stunden</li>
        </ul>
      </div>
      {!!fs && (
        <div className="space-y-2">
          <AutoRedirect href={`/fragebogen?fs=${encodeURIComponent(fs)}`} />
          <Button asChild className="h-11">
            <Link href={`/fragebogen?fs=${encodeURIComponent(fs)}`}>Formular fortsetzen</Link>
          </Button>
        </div>
      )}
      <p className="text-sm text-muted-foreground">Keine E‑Mail bekommen? Schau im Spam‑Ordner nach oder probiere es in ein paar Minuten erneut.</p>
    </div>
  );
}
