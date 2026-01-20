'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TherapistProfile } from '@/features/therapists/components/TherapistProfile';
import { TherapistDetailModal } from '@/features/therapists/components/TherapistDetailModal';
import type { TherapistData } from '@/lib/therapist-mapper';
import PageAnalytics from '@/components/PageAnalytics';

interface TherapistProfilePageProps {
  therapist: TherapistData;
  slug: string;
}

export function TherapistProfilePage({ therapist, slug }: TherapistProfilePageProps) {
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingKind, setBookingKind] = useState<'intro' | 'full_session'>('intro');

  const handleBookIntro = useCallback(() => {
    setBookingKind('intro');
    setShowBookingModal(true);
  }, []);

  const handleBookSession = useCallback(() => {
    setBookingKind('full_session');
    setShowBookingModal(true);
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <PageAnalytics qualifier={`therapist-profile-${slug}`} />
      
      {/* Back link */}
      <div className="mb-6">
        <Link 
          href="/therapeuten" 
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Übersicht
        </Link>
      </div>

      {/* Profile content */}
      <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <TherapistProfile
          therapist={therapist}
          onBookIntro={handleBookIntro}
          onBookSession={handleBookSession}
          centered
        />
      </article>

      {/* Directory CTA */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-600 mb-3">
          Nicht der/die richtige Therapeut:in für dich?
        </p>
        <Button variant="outline" asChild>
          <Link href="/therapeuten">
            Alle Therapeut:innen ansehen
          </Link>
        </Button>
      </div>

      {/* Booking Modal - uses TherapistDetailModal for full Cal.com booking flow */}
      {showBookingModal && (
        <TherapistDetailModal
          therapist={therapist}
          open={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          initialViewMode="cal-booking"
          initialCalBookingKind={bookingKind}
        />
      )}
    </main>
  );
}
