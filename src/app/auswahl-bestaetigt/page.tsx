import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata = {
  title: 'Auswahl bestätigt | Kaufmann Health',
  description: 'Bestätigung deiner Therapie‑Auswahl.',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ok = sp?.ok === '1';
  const error = typeof sp?.error === 'string' ? sp.error : undefined;

  let title = 'Auswahl bestätigt';
  let description = 'Vielen Dank! Wir haben deine Auswahl erhalten und benachrichtigen jetzt den/die Therapeut:in. Du erhältst in der Regel innerhalb von 24 Stunden eine Antwort.';

  if (!ok && error) {
    title = 'Auswahl nicht möglich';
    description =
      error === 'missing'
        ? 'Der Link ist unvollständig. Bitte öffne die E‑Mail erneut und klicke auf den Button bei deiner/deinem bevorzugte:n Therapeut:in.'
        : error === 'missing_therapist'
        ? 'Es fehlt die Angabe des/der Therapeut:in. Bitte klicke in der E‑Mail erneut direkt auf den Auswahl‑Button.'
        : error === 'not_found'
        ? 'Der Link ist ungültig oder abgelaufen.'
        : error === 'unavailable'
        ? 'Diese Auswahl ist nicht mehr verfügbar. Es kann sein, dass der Vorschlag zurückgezogen wurde.'
        : error === 'update_failed'
        ? 'Deine Auswahl konnte nicht gespeichert werden. Bitte versuche es später erneut.'
        : 'Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.';
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/">Zur Startseite</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
