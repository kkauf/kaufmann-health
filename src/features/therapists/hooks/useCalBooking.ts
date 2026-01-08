/**
 * useCalBooking - Shared hook for Cal.com booking flow (EARTH-256)
 *
 * Handles:
 * - Cal slot fetching via KH API proxy
 * - Session verification check
 * - Verification form state for unverified users
 * - Cal redirect with prefill data
 *
 * Used by TherapistDetailModal for in-modal Cal booking.
 */

import { useState, useEffect, useCallback } from 'react';
import type { CalNormalizedSlot, CalBookingKind } from '@/contracts/cal';
import { buildCalBookingUrl } from '@/lib/cal/booking-url';
import { getAttribution } from '@/lib/attribution';

interface SessionData {
  verified: boolean;
  name?: string;
  contact_method?: 'email' | 'phone';
  contact_value?: string;
  patient_id?: string;
}

type BookingStep = 'slots' | 'verify' | 'code' | 'email-sent' | 'fallback';

// EARTH-262: Timeout configuration
const SLOTS_FETCH_TIMEOUT_MS = 5000;

interface UseCalBookingOptions {
  therapistId: string;
  calUsername: string;
  bookingKind: CalBookingKind;
  enabled?: boolean;
}

export interface CalBookingState {
  // Slot state
  slots: CalNormalizedSlot[];
  slotsLoading: boolean;
  slotsError: string | null;
  slotsUnavailable: boolean; // EARTH-262: Cal.com is unreachable
  selectedSlot: CalNormalizedSlot | null;
  
  // Session state
  session: SessionData | null;
  sessionLoading: boolean;
  
  // Booking step state
  step: BookingStep;
  
  // Verification form state
  name: string;
  contactMethod: 'email' | 'phone';
  contactValue: string;
  verificationCode: string;
  verifyLoading: boolean;
  verifyError: string | null;
  
  // EARTH-262: Retry state
  bookingRetryCount: number;
}

export interface CalBookingActions {
  selectSlot: (slot: CalNormalizedSlot) => void;
  clearSlot: () => void;
  
  // Step navigation
  proceedToVerify: () => void;
  backToSlots: () => void;
  goToFallback: () => void; // EARTH-262: Switch to contact fallback
  
  // Verification form
  setName: (name: string) => void;
  setContactMethod: (method: 'email' | 'phone') => void;
  setContactValue: (value: string) => void;
  setVerificationCode: (code: string) => void;
  
  // Actions
  sendCode: () => Promise<void>;
  verifyCode: () => Promise<void>;
  redirectToCal: (prefillName?: string, prefillEmail?: string, patientId?: string) => void;
  
  // Main booking handler (checks session, redirects or shows verify)
  handleBooking: () => void;
  
  // EARTH-262: Retry slots fetch
  retrySlotsFetch: () => void;
  
  // Reset state
  reset: () => void;
}

export function useCalBooking({
  therapistId,
  calUsername,
  bookingKind,
  enabled = true,
}: UseCalBookingOptions): [CalBookingState, CalBookingActions] {
  // Slot state
  const [slots, setSlots] = useState<CalNormalizedSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CalNormalizedSlot | null>(null);
  
  // Session state
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  
  // Step state
  const [step, setStep] = useState<BookingStep>('slots');
  
  // Verification form state
  const [name, setName] = useState('');
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('email');
  const [contactValue, setContactValue] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  
  // EARTH-262: Unavailable and retry state
  const [slotsUnavailable, setSlotsUnavailable] = useState(false);
  const [bookingRetryCount, setBookingRetryCount] = useState(0);
  const [slotsFetchTrigger, setSlotsFetchTrigger] = useState(0); // Trigger re-fetch

  // Check session on mount
  useEffect(() => {
    if (!enabled) {
      setSessionLoading(false);
      return;
    }
    
    async function checkSession() {
      try {
        const res = await fetch('/api/public/session');
        const json = await res.json();
        setSession(json.data || { verified: false });
      } catch {
        setSession({ verified: false });
      } finally {
        setSessionLoading(false);
      }
    }
    checkSession();
  }, [enabled]);

  // Fetch Cal slots with EARTH-262 timeout handling
  useEffect(() => {
    if (!enabled || !therapistId) {
      return;
    }

    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout>;

    async function fetchSlots() {
      setSlotsLoading(true);
      setSlotsError(null);
      setSlotsUnavailable(false);

      // EARTH-262: Set up timeout
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, SLOTS_FETCH_TIMEOUT_MS);

      try {
        const today = new Date();
        const start = today.toISOString().split('T')[0];
        const end7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

        const url = new URL('/api/public/cal/slots', window.location.origin);
        url.searchParams.set('therapist_id', therapistId);
        url.searchParams.set('kind', bookingKind);
        url.searchParams.set('start', start);
        url.searchParams.set('end', end7);

        const res = await fetch(url.toString(), { signal: abortController.signal });
        clearTimeout(timeoutId);
        
        // EARTH-262: Handle non-OK responses as unavailable
        if (!res.ok) {
          setSlotsUnavailable(true);
          setSlotsError('Terminkalender vorübergehend nicht verfügbar');
          return;
        }
        
        let json: unknown;
        try {
          json = await res.json();
        } catch {
          // EARTH-262: Malformed response
          console.error('[useCalBooking] Malformed JSON response');
          setSlotsUnavailable(true);
          setSlotsError('Terminkalender vorübergehend nicht verfügbar');
          return;
        }
        
        // EARTH-262: Validate response structure
        if (!json || typeof json !== 'object') {
          console.error('[useCalBooking] Invalid response structure');
          setSlotsUnavailable(true);
          setSlotsError('Terminkalender vorübergehend nicht verfügbar');
          return;
        }
        
        const typedJson = json as { error?: string; data?: { slots?: unknown[] } };

        if (typedJson.error) {
          // EARTH-262: Treat backend errors as unavailable for graceful degradation
          setSlotsUnavailable(true);
          setSlotsError('Terminkalender vorübergehend nicht verfügbar');
          return;
        }

        // EARTH-262: Validate slots array
        const rawSlots = typedJson.data?.slots;
        if (!Array.isArray(rawSlots)) {
          console.error('[useCalBooking] Slots is not an array:', typeof rawSlots);
          setSlotsUnavailable(true);
          setSlotsError('Terminkalender vorübergehend nicht verfügbar');
          return;
        }

        let fetchedSlots: CalNormalizedSlot[] = rawSlots as CalNormalizedSlot[];

        // If sparse, extend to 14 days
        if (fetchedSlots.length < 3) {
          const end14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          url.searchParams.set('end', end14);
          
          try {
            const res14 = await fetch(url.toString(), { signal: abortController.signal });
            if (res14.ok) {
              const json14 = await res14.json() as { error?: string; data?: { slots?: CalNormalizedSlot[] } };
              if (!json14.error && Array.isArray(json14.data?.slots)) {
                fetchedSlots = json14.data.slots;
              }
            }
          } catch {
            // EARTH-262: Ignore extended fetch errors, use what we have
          }
        }

        setSlots(fetchedSlots);
        setSlotsUnavailable(false);

        // Track fetch
        try {
          const attrs = getAttribution();
          navigator.sendBeacon?.(
            '/api/events',
            new Blob([JSON.stringify({
              type: 'cal_slots_viewed',
              ...attrs,
              properties: { therapist_id: therapistId, kind: bookingKind, slot_count: fetchedSlots.length },
            })], { type: 'application/json' })
          );
        } catch {}
      } catch (e) {
        clearTimeout(timeoutId);
        const isAbort = e instanceof Error && e.name === 'AbortError';
        console.error('[useCalBooking] Failed to fetch slots:', isAbort ? 'timeout' : e);
        
        // EARTH-262: Mark as unavailable on timeout or network error
        setSlotsUnavailable(true);
        setSlotsError(isAbort 
          ? 'Terminkalender vorübergehend nicht verfügbar' 
          : 'Terminkalender vorübergehend nicht verfügbar'
        );
        
        // Track error
        try {
          const attrs = getAttribution();
          navigator.sendBeacon?.(
            '/api/events',
            new Blob([JSON.stringify({
              type: 'cal_slots_fetch_failed',
              ...attrs,
              properties: { 
                therapist_id: therapistId, 
                kind: bookingKind, 
                error_type: isAbort ? 'timeout' : 'network',
                error_message: e instanceof Error ? e.message : 'unknown',
              },
            })], { type: 'application/json' })
          );
        } catch {}
      } finally {
        setSlotsLoading(false);
      }
    }

    fetchSlots();
    
    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [enabled, therapistId, bookingKind, slotsFetchTrigger]);

  // Redirect to Cal with prefill
  const redirectToCal = useCallback((prefillName?: string, prefillEmail?: string, patientId?: string) => {
    if (!selectedSlot) return;

    const attrs = getAttribution();

    // Track handoff
    try {
      navigator.sendBeacon?.(
        '/api/events',
        new Blob([JSON.stringify({
          type: 'cal_handoff_initiated',
          ...attrs,
          properties: {
            therapist_id: therapistId,
            kind: bookingKind,
            date_iso: selectedSlot.date_iso,
            time_label: selectedSlot.time_label,
            verified: Boolean(session?.verified),
            patient_id: patientId || session?.patient_id,
          },
        })], { type: 'application/json' })
      );
    } catch {}

    const calUrl = buildCalBookingUrl({
      calUsername,
      eventType: bookingKind,
      metadata: {
        kh_therapist_id: therapistId,
        kh_patient_id: patientId || session?.patient_id,
        kh_booking_kind: bookingKind,
        kh_source: 'directory',
        kh_gclid: attrs.gclid,
        kh_utm_source: attrs.utm_source,
        kh_utm_medium: attrs.utm_medium,
        kh_utm_campaign: attrs.utm_campaign,
      },
      prefillName,
      prefillEmail,
      redirectBack: true,
      slot: selectedSlot.time_utc,
    });

    window.location.href = calUrl;
  }, [selectedSlot, therapistId, calUsername, bookingKind, session]);

  // Handle booking button - check session first
  const handleBooking = useCallback(() => {
    if (!selectedSlot) return;

    if (session?.verified) {
      const email = session.contact_method === 'email' ? session.contact_value : undefined;
      redirectToCal(session.name, email, session.patient_id);
      return;
    }

    setStep('verify');
  }, [selectedSlot, session, redirectToCal]);

  // Send verification code
  const sendCode = useCallback(async () => {
    if (!name.trim() || !contactValue.trim()) {
      setVerifyError('Bitte fülle alle Felder aus');
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);

    try {
      const res = await fetch('/api/public/verification/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          contact_type: contactMethod,
          contact: contactValue.trim(),
          draft_booking: selectedSlot ? {
            therapist_id: therapistId,
            date_iso: selectedSlot.date_iso,
            time_label: selectedSlot.time_label,
            format: 'online',
          } : undefined,
        }),
      });

      const json = await res.json();
      if (json.error) {
        setVerifyError(json.error);
        return;
      }

      // Email uses magic link (no code entry), SMS uses code entry
      setStep(contactMethod === 'email' ? 'email-sent' : 'code');
    } catch {
      setVerifyError('Fehler beim Senden des Codes');
    } finally {
      setVerifyLoading(false);
    }
  }, [name, contactMethod, contactValue, selectedSlot, therapistId]);

  // Verify code and redirect
  const verifyCode = useCallback(async () => {
    if (!verificationCode.trim()) {
      setVerifyError('Bitte gib den Code ein');
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);

    try {
      const res = await fetch('/api/public/verification/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_type: contactMethod,
          contact: contactValue.trim(),
          code: verificationCode.trim(),
        }),
      });

      const json = await res.json();
      if (json.error) {
        setVerifyError(json.error);
        return;
      }

      const patientId = json.data?.patient_id;
      const email = contactMethod === 'email' ? contactValue.trim() : undefined;
      redirectToCal(name.trim(), email, patientId);
    } catch {
      setVerifyError('Fehler bei der Verifizierung');
    } finally {
      setVerifyLoading(false);
    }
  }, [verificationCode, contactMethod, contactValue, name, redirectToCal]);

  // EARTH-262: Retry slots fetch
  const retrySlotsFetch = useCallback(() => {
    setSlotsFetchTrigger((t) => t + 1);
  }, []);

  // EARTH-262: Go to fallback (contact form)
  const goToFallback = useCallback(() => {
    setStep('fallback');
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setSelectedSlot(null);
    setStep('slots');
    setName('');
    setContactValue('');
    setVerificationCode('');
    setVerifyError(null);
    setSlotsUnavailable(false);
    setBookingRetryCount(0);
  }, []);

  const state: CalBookingState = {
    slots,
    slotsLoading,
    slotsError,
    slotsUnavailable,
    selectedSlot,
    session,
    sessionLoading,
    step,
    name,
    contactMethod,
    contactValue,
    verificationCode,
    verifyLoading,
    verifyError,
    bookingRetryCount,
  };

  const actions: CalBookingActions = {
    selectSlot: setSelectedSlot,
    clearSlot: () => setSelectedSlot(null),
    proceedToVerify: () => setStep('verify'),
    backToSlots: () => { setStep('slots'); setVerifyError(null); },
    goToFallback,
    setName,
    setContactMethod,
    setContactValue,
    setVerificationCode,
    sendCode,
    verifyCode,
    redirectToCal,
    handleBooking,
    retrySlotsFetch,
    reset,
  };

  return [state, actions];
}

// Utility: Group slots by day
export function groupSlotsByDay(slots: CalNormalizedSlot[]): Map<string, CalNormalizedSlot[]> {
  const map = new Map<string, CalNormalizedSlot[]>();
  for (const slot of slots) {
    const existing = map.get(slot.date_iso) || [];
    existing.push(slot);
    map.set(slot.date_iso, existing);
  }
  return map;
}
