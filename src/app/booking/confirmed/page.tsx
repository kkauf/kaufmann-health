'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Calendar, ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const therapistId = searchParams.get('therapist');
  const bookingKind = searchParams.get('kind') as 'intro' | 'full_session' | null;

  const [therapistName, setTherapistName] = useState<string | null>(null);

  useEffect(() => {
    if (therapistId) {
      fetch(`/api/public/therapists?id=${therapistId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.therapists?.[0]?.name) {
            setTherapistName(data.therapists[0].name);
          }
        })
        .catch(() => {});
    }
  }, [therapistId]);

  const kindLabel = bookingKind === 'intro' 
    ? 'Kostenloses Kennenlernen' 
    : bookingKind === 'full_session' 
      ? 'Therapiesitzung' 
      : 'Termin';

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-xl border-0">
        <CardContent className="pt-8 pb-6 px-6 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Buchung bestätigt!
            </h1>
            <p className="text-gray-600">
              Ihr {kindLabel}
              {therapistName && <> mit <span className="font-semibold">{therapistName}</span></>}
              {' '}wurde erfolgreich gebucht.
            </p>
          </div>

          <div className="bg-emerald-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-emerald-800">
              <Calendar className="w-5 h-5" />
              <span className="font-medium">Bestätigung per E-Mail</span>
            </div>
            <p className="text-sm text-emerald-700 mt-2">
              Sie erhalten in Kürze eine E-Mail mit allen Details zu Ihrem Termin.
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/therapeuten" className="block">
              <Button variant="outline" className="w-full h-12" size="lg">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zur Therapeutensuche
              </Button>
            </Link>
            <Link href="/" className="block">
              <Button variant="ghost" className="w-full" size="lg">
                <Home className="mr-2 h-4 w-4" />
                Zur Startseite
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BookingConfirmedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Laden...</div>
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
