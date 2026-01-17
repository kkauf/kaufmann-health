/**
 * CalBookingConfirm - Native booking UI (EARTH-272)
 *
 * Handles the booking and success steps for native Cal.com booking.
 * Shows booking in-progress spinner and success confirmation.
 * 
 * Note: The confirm step was removed to streamline the flow - users now
 * go directly from verification to booking.
 */

'use client';

import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Video, ExternalLink } from 'lucide-react';
import type { CalBookingState, CalBookingActions } from '../hooks/useCalBooking';
import type { CalBookingKind } from '@/contracts/cal';

interface CalBookingConfirmProps {
  state: CalBookingState;
  actions: CalBookingActions;
  therapistName: string;
  bookingKind: CalBookingKind;
  sessionPrice?: number | null;
  supportsInPerson?: boolean;
  practiceAddress?: string;
}

/**
 * Format date for German display
 */
function formatDateGerman(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function CalBookingConfirm({
  state,
  actions,
}: CalBookingConfirmProps) {
  const { step, selectedSlot, bookingResult } = state;

  // Booking in progress
  if (step === 'booking') {
    return (
      <div className="text-center py-12 space-y-4">
        <Loader2 className="h-12 w-12 mx-auto text-emerald-600 animate-spin" />
        <div>
          <p className="text-lg font-medium text-gray-900">Termin wird gebucht...</p>
          <p className="text-sm text-gray-500 mt-1">Einen Moment bitte</p>
        </div>
      </div>
    );
  }

  // Success step
  if (step === 'success' && bookingResult) {
    return (
      <div className="space-y-6">
        {/* Success header */}
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Dein Termin ist gebucht!</h3>
          <p className="text-sm text-gray-500 mt-2">
            {formatDateGerman(selectedSlot?.date_iso || '')} um {selectedSlot?.time_label} Uhr
          </p>
        </div>

        {/* Next steps */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3">
          <p className="text-sm font-medium text-emerald-900">Du erhältst in Kürze:</p>
          <ul className="space-y-2 text-sm text-emerald-800">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>Eine Bestätigung per E-Mail</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>Eine Kalendereinladung mit Video-Link</span>
            </li>
          </ul>
        </div>

        {/* Video link if available */}
        {bookingResult.metadata?.videoCallUrl && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
            <p className="text-xs font-medium text-sky-700 uppercase tracking-wide mb-2">Video-Link</p>
            <a
              href={bookingResult.metadata.videoCallUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-sky-700 hover:text-sky-900 font-medium"
            >
              <Video className="h-4 w-4" />
              <span className="truncate">{bookingResult.metadata.videoCallUrl}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
          </div>
        )}

        {/* Close button */}
        <Button
          onClick={actions.reset}
          variant="outline"
          className="w-full"
        >
          Schließen
        </Button>
      </div>
    );
  }

  // Fallback - shouldn't reach here
  return null;
}
