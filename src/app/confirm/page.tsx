import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResendConfirmationForm } from '@/components/ResendConfirmationForm';
import ConfirmSuccessFallback from '@/components/ConfirmSuccessFallback';

export const metadata = {
  title: 'Bestätigung | Kaufmann Health',
  description: 'E-Mail-Bestätigung für Klient:innen.',
  robots: { index: false, follow: false },
};

function getStateContent(state?: string) {
  switch (state) {
    case 'success':
      return {
        title: 'E‑Mail bestätigt – Formular fortsetzen',
        description:
          'Falls du nicht automatisch weitergeleitet wirst, klicke auf „Zum Fragebogen“.',
        showResend: false,
      } as const;
    case 'invalid':
      return {
        title: 'Bestätigungslink ungültig',
        description:
          'Der Link ist ungültig oder unvollständig. Bitte öffne die E‑Mail erneut und klicke auf den Bestätigungs‑Button.',
        showResend: false,
      } as const;
    case 'expired':
      return {
        title: 'Bestätigungslink abgelaufen',
        description:
          'Der Link ist abgelaufen (24 Stunden gültig). Du kannst dir die Bestätigungs‑E‑Mail erneut zusenden lassen.',
        showResend: true,
      } as const;
    case 'error':
    default:
      return {
        title: 'Es ist ein Fehler aufgetreten',
        description: 'Bitte versuche es später erneut oder schreibe uns kurz.',
        showResend: false,
      } as const;
  }
}


export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const state = typeof sp?.state === 'string' ? sp.state : undefined;
  const { title, description, showResend } = getStateContent(state);
  const isSuccess = state === 'success';

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <ConfirmSuccessFallback />
          ) : (
            <>
              {showResend ? <ResendConfirmationForm /> : null}
              <div className="mt-4 flex gap-3">
                <Button asChild>
                  <Link href="/">Zur Startseite</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/therapie-finden">Therapie empfehlen lassen</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
