/**
 * CalBookingConfirm - Native booking UI (EARTH-272)
 *
 * Handles the booking and success steps for native Cal.com booking.
 * Shows booking in-progress spinner and success confirmation.
 *
 * After booking success, prompts for missing contact info:
 * - Phone-only users: asks for email (sends booking confirmation)
 * - Email users: optionally asks for phone (for SMS reminders)
 *
 * Note: The confirm step was removed to streamline the flow - users now
 * go directly from verification to booking.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Video, ExternalLink, Mail, Phone } from 'lucide-react';
import { VerifiedPhoneInput } from '@/components/VerifiedPhoneInput';
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

/**
 * Post-booking contact collection form.
 * Phone-only users: collects email (required for booking confirmation).
 * Email users: collects phone (optional for SMS reminders).
 */
function ContactCollect({
  isPhoneOnly,
  bookingUid,
  onDone,
}: {
  isPhoneOnly: boolean;
  bookingUid: string;
  onDone: () => void;
}) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return null;

  const canSubmit = isPhoneOnly
    ? value.includes('@') && value.length > 3
    : value.length >= 5;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, string> = {};
      if (isPhoneOnly) {
        body.email = value.trim();
        body.booking_uid = bookingUid;
      } else {
        body.phone_number = value.trim();
      }

      const res = await fetch('/api/public/patient/update-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setSubmitted(true);
        onDone();
      }
    } catch {
      setError('Verbindungsfehler. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  if (isPhoneOnly) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Mail className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-900">E-Mail-Adresse hinzufügen</p>
            <p className="text-xs text-amber-700 mt-0.5">Für deine Buchungsbestätigung und den Video-Link.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="max@beispiel.de"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 h-9 text-sm"
            disabled={loading}
          />
          <Button
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 h-9 px-4"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Senden'}
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // Email user → optional phone for SMS reminders
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Phone className="h-4 w-4 shrink-0 mt-0.5 text-gray-500" />
        <div>
          <p className="text-sm font-medium text-gray-900">SMS-Erinnerungen erhalten?</p>
          <p className="text-xs text-gray-500 mt-0.5">Wir erinnern dich per SMS an deinen Termin.</p>
        </div>
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label htmlFor="phone-collect" className="sr-only">Handynummer</Label>
          <VerifiedPhoneInput
            value={value}
            onChange={setValue}
            disabled={loading}
            id="phone-collect"
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
          size="sm"
          className="h-9 px-4"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setSubmitted(true)}
        className="text-xs text-gray-400 hover:text-gray-600 underline"
      >
        Nein danke
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function CalBookingConfirm({
  state,
  actions,
}: CalBookingConfirmProps) {
  const { step, selectedSlot, bookingResult } = state;
  const [contactDone, setContactDone] = useState(false);

  // Determine if user is phone-only (needs email) or email (optionally wants phone)
  // session.contact_method is set for returning verified users;
  // state.contactMethod is set for users who just verified in this flow
  const isPhoneOnly =
    state.session?.contact_method === 'phone' ||
    (!state.session?.verified && state.contactMethod === 'phone');

  // Email users who already have a phone number don't need the prompt
  const hasPhone = state.session?.contact_method === 'phone';
  const hasEmail = state.session?.contact_method === 'email' ||
    (!state.session?.verified && state.contactMethod === 'email');

  // Show contact collect: phone-only always needs email; email users optionally add phone
  const showContactCollect = !contactDone && (isPhoneOnly || (hasEmail && !hasPhone));

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

        {/* Contact collection: email for phone-only, phone for email users */}
        {showContactCollect && (
          <ContactCollect
            isPhoneOnly={isPhoneOnly}
            bookingUid={bookingResult.uid}
            onDone={() => setContactDone(true)}
          />
        )}

        {/* Next steps — adapt messaging based on whether they have email */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3">
          <p className="text-sm font-medium text-emerald-900">
            {isPhoneOnly && !contactDone ? 'Nach Eingabe deiner E-Mail erhältst du:' : 'Du erhältst in Kürze:'}
          </p>
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
