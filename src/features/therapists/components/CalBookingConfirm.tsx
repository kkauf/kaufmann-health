/**
 * CalBookingConfirm - Native booking confirmation UI (EARTH-272)
 *
 * Handles the confirm, booking, and success steps for native Cal.com booking.
 * Shows booking summary, location toggle, and success/error states.
 */

'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, Video, MapPin, AlertCircle, ArrowLeft, Calendar, ExternalLink } from 'lucide-react';
import type { CalBookingState, CalBookingActions, BookingLocationType } from '../hooks/useCalBooking';
import type { CalBookingKind } from '@/contracts/cal';
import { cn } from '@/lib/utils';

interface CalBookingConfirmProps {
  state: CalBookingState;
  actions: CalBookingActions;
  therapistName: string;
  bookingKind: CalBookingKind;
  sessionPrice?: number | null;
  /** Whether therapist supports in-person sessions */
  supportsInPerson?: boolean;
  /** Therapist's practice address for in-person */
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

/**
 * Calculate end time from start time and duration
 */
function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const endMinutes = (hours * 60 + minutes + durationMinutes) % (24 * 60);
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
}

export function CalBookingConfirm({
  state,
  actions,
  therapistName,
  bookingKind,
  sessionPrice,
  supportsInPerson = false,
  practiceAddress,
}: CalBookingConfirmProps) {
  const { step, selectedSlot, locationType, bookingLoading, bookingError, bookingResult } = state;

  const isIntro = bookingKind === 'intro';
  const duration = isIntro ? 15 : 50;
  const sessionTitle = isIntro ? 'Kostenloses Kennenlerngespräch' : 'Therapiesitzung';

  // Confirmation step
  if (step === 'confirm') {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          type="button"
          onClick={actions.backToVerify}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors -mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </button>

        {/* Header */}
        <div className="text-center">
          <Calendar className="h-10 w-10 mx-auto mb-3 text-emerald-600" />
          <h3 className="text-lg font-semibold text-gray-900">Termin bestätigen</h3>
          <p className="text-sm text-gray-500 mt-1">Überprüfe die Details und bestätige deinen Termin</p>
        </div>

        {/* Booking summary card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
          {/* What */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Was</p>
            <p className="text-sm text-gray-900 font-medium">
              {sessionTitle} ({duration} Min.)
            </p>
            <p className="text-sm text-gray-600">
              zwischen {therapistName} und {state.name || 'dir'}
            </p>
          </div>

          {/* When */}
          {selectedSlot && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Wann</p>
              <p className="text-sm text-gray-900 font-medium">
                {formatDateGerman(selectedSlot.date_iso)}
              </p>
              <p className="text-sm text-gray-600">
                {selectedSlot.time_label} - {calculateEndTime(selectedSlot.time_label, duration)} Uhr (Europe/Berlin)
              </p>
            </div>
          )}

          {/* Where - Location toggle */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Wo</p>
            
            {isIntro ? (
              // Intro sessions are always online
              <div className="flex items-center gap-2 text-sm text-gray-900">
                <Video className="h-4 w-4 text-sky-600" />
                <span>Online-Videogespräch</span>
              </div>
            ) : supportsInPerson ? (
              // Full sessions with location toggle
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => actions.setLocationType('video')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all',
                      locationType === 'video'
                        ? 'border-sky-400 bg-sky-50 text-sky-900'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <Video className="h-4 w-4" />
                    Online
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.setLocationType('in_person')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all',
                      locationType === 'in_person'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <MapPin className="h-4 w-4" />
                    Vor Ort
                  </button>
                </div>
                
                {locationType === 'in_person' && practiceAddress && (
                  <p className="text-sm text-gray-600 flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-gray-400" />
                    {practiceAddress}
                  </p>
                )}
                
                {locationType === 'video' && (
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Video className="h-4 w-4 text-sky-500" />
                    Cal Video (Link folgt per E-Mail)
                  </p>
                )}
              </div>
            ) : (
              // Full sessions online only
              <div className="flex items-center gap-2 text-sm text-gray-900">
                <Video className="h-4 w-4 text-sky-600" />
                <span>Online-Videogespräch</span>
              </div>
            )}
          </div>

          {/* Price (for full sessions) */}
          {!isIntro && sessionPrice && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Preis</p>
              <p className="text-sm text-gray-900">{sessionPrice}€ pro Sitzung</p>
            </div>
          )}
        </div>

        {/* Notes for therapist */}
        <div>
          <label htmlFor="booking-notes" className="text-sm font-medium text-gray-700 block mb-2">
            Notiz für {therapistName.split(' ')[0]} (optional)
          </label>
          <Textarea
            id="booking-notes"
            value={state.notes}
            onChange={(e) => actions.setNotes(e.target.value)}
            placeholder="z.B. Ich interessiere mich besonders für Somatic Experiencing..."
            maxLength={500}
            rows={3}
            className="resize-none text-sm"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            {state.notes.length}/500 Zeichen
          </p>
        </div>

        {/* Error message */}
        {bookingError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{bookingError}</span>
          </div>
        )}

        {/* Confirm button */}
        <Button
          onClick={actions.createNativeBooking}
          disabled={bookingLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-6"
        >
          {bookingLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Wird gebucht...
            </>
          ) : (
            'Termin bestätigen'
          )}
        </Button>
      </div>
    );
  }

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
