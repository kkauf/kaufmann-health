'use client';

import { memo, useCallback } from 'react';
import { TherapistCard } from './TherapistCard';
import type { TherapistData } from '@/lib/therapist-mapper';

/**
 * Memoized card wrapper — stable callbacks per therapist prevent
 * every card from re-rendering when directory filter state changes.
 */
export const MemoizedCardWrapper = memo(function MemoizedCardWrapper({
  therapist,
  setInitialModalViewMode,
  setInitialCalBookingKind,
  setSelectedTherapist,
}: {
  therapist: TherapistData;
  setInitialModalViewMode: (v: 'profile' | 'booking' | 'cal-booking') => void;
  setInitialCalBookingKind: (v: 'intro' | 'full_session') => void;
  setSelectedTherapist: (t: TherapistData) => void;
}) {
  const handleViewDetails = useCallback(() => {
    setInitialModalViewMode('profile');
    setSelectedTherapist(therapist);
  }, [therapist, setInitialModalViewMode, setSelectedTherapist]);

  const handleContactClick = useCallback((type: 'booking' | 'consultation') => {
    const isCal = therapist.cal_enabled && therapist.cal_username;
    setInitialModalViewMode(isCal ? 'cal-booking' : 'booking');
    setInitialCalBookingKind(type === 'consultation' ? 'intro' : 'full_session');
    setSelectedTherapist(therapist);
  }, [therapist, setInitialModalViewMode, setInitialCalBookingKind, setSelectedTherapist]);

  return (
    <TherapistCard
      therapist={therapist}
      showSchwerpunkte
      onViewDetails={handleViewDetails}
      onContactClick={handleContactClick}
      requiresIntroBeforeBooking={therapist.requires_intro_before_booking}
    />
  );
});
