import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata = {
  title: 'Auswahl bestätigt | Kaufmann Health',
  description: 'Bestätigung Ihrer Therapie-Auswahl.',
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
  let description = 'Vielen Dank! Wir haben Ihre Auswahl erhalten und benachrichtigen jetzt den/die Therapeut:in. Sie erhalten in der Regel innerhalb von 24 Stunden eine Antwort.';

  if (!ok && error) {
    title = 'Auswahl nicht möglich';
    description =
      error === 'missing'
        ? 'Der Link ist unvollständig. Bitte öffnen Sie die E‑Mail erneut und klicken Sie auf den Button bei Ihrer/Ihrem bevorzugte:n Therapeut:in.'
        : error === 'missing_therapist'
        ? 'Es fehlt die Angabe des/der Therapeut:in. Bitte klicken Sie in der E‑Mail erneut direkt auf den Auswahl‑Button.'
        : error === 'not_found'
        ? 'Der Link ist ungültig oder abgelaufen.'
        : error === 'unavailable'
        ? 'Diese Auswahl ist nicht mehr verfügbar. Es kann sein, dass der Vorschlag zurückgezogen wurde.'
        : error === 'update_failed'
        ? 'Ihre Auswahl konnte nicht gespeichert werden. Bitte versuchen Sie es später erneut.'
        : 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.';
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
