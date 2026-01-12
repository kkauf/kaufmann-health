'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Calendar, ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Support both our params and Cal.com's callback params
  const therapistId = searchParams.get('therapist') || searchParams.get('metadata[kh_therapist_id]');
  const bookingKind = (searchParams.get('kind') || searchParams.get('metadata[kh_booking_kind]')) as 'intro' | 'full_session' | null;
  const returnTo = searchParams.get('returnTo');
  
  // Cal.com provides these directly in callback URL
  const calHostName = searchParams.get('hostName');
  const calStartTime = searchParams.get('startTime') || searchParams.get('attendeeStartTime');

  const [therapistName, setTherapistName] = useState<string | null>(calHostName);
  const [redirecting, setRedirecting] = useState(false);
  
  // Format the booking time for display
  const formattedTime = calStartTime ? new Date(calStartTime).toLocaleString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }) : null;

  useEffect(() => {
    // Only fetch if we don't have the name from Cal.com params
    if (therapistId && !calHostName) {
      fetch(`/api/public/therapists?id=${therapistId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.therapists?.[0]?.name) {
            setTherapistName(data.therapists[0].name);
          }
        })
        .catch(() => {});
    }
  }, [therapistId, calHostName]);

  // EARTH-256: Auto-redirect to origin after short delay with confirmation param
  useEffect(() => {
    if (returnTo && !redirecting) {
      setRedirecting(true);
      const timer = setTimeout(() => {
        const url = new URL(returnTo, window.location.origin);
        url.searchParams.set('booking', 'confirmed');
        if (therapistId) url.searchParams.set('therapist', therapistId);
        if (bookingKind) url.searchParams.set('kind', bookingKind);
        router.push(url.pathname + url.search);
      }, 2500); // Show confirmation briefly before redirecting
      return () => clearTimeout(timer);
    }
  }, [returnTo, therapistId, bookingKind, router, redirecting]);

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

          {formattedTime && (
            <div className="bg-white border border-emerald-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-gray-800">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold">{formattedTime} Uhr</span>
              </div>
            </div>
          )}

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
