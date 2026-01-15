/**
 * useCalBooking - Shared hook for Cal.com booking flow (EARTH-256)
 *
 * Handles:
 * - Cal slot fetching via KH API proxy
 * - Session verification check
 * - Verification via shared useVerification hook (single source of truth)
 * - Cal redirect with prefill data
 *
 * Used by TherapistDetailModal for in-modal Cal booking.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CalNormalizedSlot, CalBookingKind, CalBookingResult, CalBookingSuccessResponse } from '@/contracts/cal';
import { USE_NATIVE_BOOKING } from '@/lib/cal/book';
import { buildCalBookingUrl } from '@/lib/cal/booking-url';
import { getAttribution } from '@/lib/attribution';
import { useVerification } from '@/lib/verification/useVerification';

interface SessionData {
  verified: boolean;
  name?: string;
  contact_method?: 'email' | 'phone';
  contact_value?: string;
  patient_id?: string;
}

type BookingStep = 'slots' | 'verify' | 'code' | 'email-sent' | 'confirm' | 'booking' | 'success' | 'fallback';

// Location type for booking
export type BookingLocationType = 'video' | 'in_person';

// EARTH-262: Timeout configuration
// Increased from 5s to 10s to handle Vercel cold starts + Cal DB pool init
const SLOTS_FETCH_TIMEOUT_MS = 10000;

interface UseCalBookingOptions {
  therapistId: string;
  calUsername: string;
  bookingKind: CalBookingKind;
  enabled?: boolean;
  /** Redirect path for email magic link confirmation (e.g., '/therapeuten?tid=xxx') */
  emailRedirectPath?: string;
}

export interface CalBookingState {
  // Slot state
  slots: CalNormalizedSlot[];
  slotsLoading: boolean;
  slotsError: string | null;
  slotsUnavailable: boolean; // EARTH-262: Cal.com is unreachable
  selectedSlot: CalNormalizedSlot | null;
  hasAttemptedFetch: boolean; // True after first fetch attempt completes

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

  // EARTH-272: Native booking state
  locationType: BookingLocationType;
  bookingLoading: boolean;
  bookingError: string | null;
  bookingResult: CalBookingSuccessResponse | null;
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

  // EARTH-272: Native booking actions
  setLocationType: (type: BookingLocationType) => void;
  createNativeBooking: () => Promise<void>;
  proceedToConfirm: () => void;
  backToVerify: () => void;

  // Reset state
  reset: () => void;
}

export function useCalBooking({
  therapistId,
  calUsername,
  bookingKind,
  enabled = true,
  emailRedirectPath,
}: UseCalBookingOptions): [CalBookingState, CalBookingActions] {
  // Slot state
  const [slots, setSlots] = useState<CalNormalizedSlot[]>([]);
  // Start as true when enabled, so fallback logic waits for fetch to complete
  const [slotsLoading, setSlotsLoading] = useState(enabled);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CalNormalizedSlot | null>(null);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  // Session state
  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Step state (slots vs verification flow)
  const [step, setStep] = useState<BookingStep>('slots');

  // EARTH-262: Unavailable and retry state
  const [slotsUnavailable, setSlotsUnavailable] = useState(false);
  const [bookingRetryCount, setBookingRetryCount] = useState(0);
  const [slotsFetchTrigger, setSlotsFetchTrigger] = useState(0); // Trigger re-fetch

  // EARTH-272: Native booking state
  const [locationType, setLocationType] = useState<BookingLocationType>(
    bookingKind === 'intro' ? 'video' : 'video' // Default to video, can be overridden
  );
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<CalBookingSuccessResponse | null>(null);

  // Track current fetch to avoid aborting on re-renders (EARTH-262 fix)
  const currentFetchRef = useRef<{ therapistId: string; bookingKind: CalBookingKind } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use shared verification hook (single source of truth for verification logic)
  const verification = useVerification({
    initialContactMethod: 'email',
  });

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

    // EARTH-262 fix: Only abort if therapist/kind ACTUALLY changed, not on re-renders
    const isSameFetch = currentFetchRef.current?.therapistId === therapistId &&
                        currentFetchRef.current?.bookingKind === bookingKind;
    
    if (isSameFetch && abortControllerRef.current && !slotsUnavailable) {
      // Same fetch already in progress, don't abort and restart
      return;
    }

    // Abort any previous fetch for DIFFERENT therapist/kind
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    currentFetchRef.current = { therapistId, bookingKind };
    
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
        // Extended window: 14 days initially (up from 7)
        const end14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

        const url = new URL('/api/public/cal/slots', window.location.origin);
        url.searchParams.set('therapist_id', therapistId);
        url.searchParams.set('kind', bookingKind);
        url.searchParams.set('start', start);
        url.searchParams.set('end', end14);

        const res = await fetch(url.toString(), { signal: abortController.signal });
        clearTimeout(timeoutId);

        // EARTH-262: Handle non-OK responses as unavailable
        if (!res.ok) {
          setSlotsUnavailable(true);
          setSlotsError('Terminkalender vorübergehend nicht verfügbar');
          setSlotsLoading(false);
          setHasAttemptedFetch(true);
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
          setSlotsLoading(false);
          setHasAttemptedFetch(true);
          return;
        }

        // EARTH-262: Validate response structure
        if (!json || typeof json !== 'object') {
          console.error('[useCalBooking] Invalid response structure');
          setSlotsUnavailable(true);
          setSlotsError('Terminkalender vorübergehend nicht verfügbar');
          setSlotsLoading(false);
          setHasAttemptedFetch(true);
          return;
        }

        const typedJson = json as { error?: string; data?: { slots?: unknown[] } };

        if (typedJson.error) {
          // EARTH-262: Treat backend errors as unavailable for graceful degradation
          setSlotsUnavailable(true);
          setSlotsError('Terminkalender vorübergehend nicht verfügbar');
          setSlotsLoading(false);
          setHasAttemptedFetch(true);
          return;
        }

        // EARTH-262: Validate slots array
        const rawSlots = typedJson.data?.slots;
        if (!Array.isArray(rawSlots)) {
          console.error('[useCalBooking] Slots is not an array:', typeof rawSlots);
          setSlotsUnavailable(true);
          setSlotsError('Terminkalender vorübergehend nicht verfügbar');
          setSlotsLoading(false);
          setHasAttemptedFetch(true);
          return;
        }

        let fetchedSlots: CalNormalizedSlot[] = rawSlots as CalNormalizedSlot[];

        // If sparse (fewer than 5 slots), extend to 28 days
        if (fetchedSlots.length < 5) {
          const end28 = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          url.searchParams.set('end', end28);

          try {
            const res28 = await fetch(url.toString(), { signal: abortController.signal });
            if (res28.ok) {
              const json28 = await res28.json() as { error?: string; data?: { slots?: CalNormalizedSlot[] } };
              if (!json28.error && Array.isArray(json28.data?.slots)) {
                fetchedSlots = json28.data.slots;
              }
            }
          } catch {
            // EARTH-262: Ignore extended fetch errors, use what we have
          }
        }

        setSlots(fetchedSlots);
        setSlotsUnavailable(false);
        setSlotsLoading(false);
        setHasAttemptedFetch(true);

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
        } catch { }
      } catch (e) {
        clearTimeout(timeoutId);
        const isAbort = e instanceof Error && e.name === 'AbortError';
        
        // Distinguish real timeout from premature abort (cleanup due to re-render)
        const isRealFailure = !isAbort || abortControllerRef.current === abortController;
        
        // Only show error + set unavailable for REAL failures
        if (isRealFailure) {
          console.error('[useCalBooking] ERROR: Cal.com slots fetch failed', {
            therapist_id: therapistId,
            kind: bookingKind,
            error_type: isAbort ? 'timeout' : 'network',
            error: e instanceof Error ? e.message : String(e),
          });

          setSlotsUnavailable(true);
          setSlotsError('Terminkalender vorübergehend nicht verfügbar');
          setSlotsLoading(false);
          setHasAttemptedFetch(true);

          // Track ERROR-level event for monitoring
          try {
            const attrs = getAttribution();
            navigator.sendBeacon?.(
              '/api/events',
              new Blob([JSON.stringify({
                type: 'cal_slots_fetch_failed',
                level: 'error', // For alerting
                ...attrs,
                properties: {
                  therapist_id: therapistId,
                  kind: bookingKind,
                  error_type: isAbort ? 'timeout' : 'network',
                  error_message: e instanceof Error ? e.message : 'unknown',
                },
              })], { type: 'application/json' })
            );
          } catch { }
        }
        // For aborts (not real failures), don't set hasAttemptedFetch - let the new fetch set it
      }
    }

    fetchSlots();

    return () => {
      clearTimeout(timeoutId);
      // Only abort on unmount, not on re-renders (refs handle the deduplication)
      if (abortControllerRef.current === abortController) {
        abortController.abort();
        currentFetchRef.current = null;
        abortControllerRef.current = null;
      }
    };
  }, [enabled, therapistId, bookingKind, slotsFetchTrigger, slotsUnavailable]);

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
    } catch { }

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

  // Send verification code using shared hook
  const sendCode = useCallback(async () => {
    const result = await verification.sendCode({
      name: verification.state.name,
      redirect: emailRedirectPath,
      draftBooking: selectedSlot ? {
        therapist_id: therapistId,
        date_iso: selectedSlot.date_iso,
        time_label: selectedSlot.time_label,
        format: 'online',
        // Include Cal.com slot reference for auto-redirect after email confirmation
        cal_slot_utc: selectedSlot.time_utc,
        cal_username: calUsername,
        cal_booking_kind: bookingKind,
      } : undefined,
    });

    if (result.success) {
      // Map verification step to booking step
      setStep(result.useMagicLink ? 'email-sent' : 'code');
    }
  }, [verification, selectedSlot, therapistId, emailRedirectPath, calUsername, bookingKind]);

  // EARTH-272: Navigate to confirm step (defined early for use in verifyCode)
  const proceedToConfirm = useCallback(() => {
    setStep('confirm');
    setBookingError(null);
  }, []);

  // Verify code and proceed to native booking or redirect
  const verifyCode = useCallback(async () => {
    const result = await verification.verifyCode();

    if (result.success) {
      // EARTH-272: Use native booking when feature flag is enabled
      if (USE_NATIVE_BOOKING) {
        proceedToConfirm();
      } else {
        const email = verification.state.contactMethod === 'email'
          ? verification.state.email
          : undefined;
        redirectToCal(verification.state.name, email, result.patientId);
      }
    }
  }, [verification, redirectToCal, proceedToConfirm]);

  // EARTH-262: Retry slots fetch
  const retrySlotsFetch = useCallback(() => {
    // Clear refs to force a new fetch
    currentFetchRef.current = null;
    abortControllerRef.current = null;
    setSlotsFetchTrigger((t) => t + 1);
  }, []);

  // EARTH-262: Go to fallback (contact form)
  const goToFallback = useCallback(() => {
    setStep('fallback');
  }, []);

  // EARTH-272: Create native booking via KH API
  const createNativeBooking = useCallback(async () => {
    if (!selectedSlot) return;

    setBookingLoading(true);
    setBookingError(null);
    setStep('booking');

    const attrs = getAttribution();
    const email = verification.state.contactMethod === 'email'
      ? verification.state.email
      : undefined;

    try {
      const res = await fetch('/api/public/cal/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapist_id: therapistId,
          kind: bookingKind,
          slot_utc: selectedSlot.time_utc,
          name: verification.state.name,
          email: email || `${Date.now()}@placeholder.kh`, // Fallback for phone-only
          location_type: locationType,
          metadata: {
            kh_patient_id: session?.patient_id,
            kh_gclid: attrs.gclid,
            kh_utm_source: attrs.utm_source,
            kh_utm_medium: attrs.utm_medium,
            kh_utm_campaign: attrs.utm_campaign,
          },
        }),
      });

      const json = await res.json() as { data: CalBookingResult | null; error: string | null };

      if (json.error) {
        setBookingError(json.error);
        setStep('confirm');
        return;
      }

      if (!json.data) {
        setBookingError('Keine Antwort vom Server');
        setStep('confirm');
        return;
      }

      if (json.data.success) {
        setBookingResult(json.data.booking);
        setStep('success');

        // Track success
        try {
          navigator.sendBeacon?.(
            '/api/events',
            new Blob([JSON.stringify({
              type: 'native_booking_completed',
              ...attrs,
              properties: {
                therapist_id: therapistId,
                kind: bookingKind,
                booking_uid: json.data.booking.uid,
              },
            })], { type: 'application/json' })
          );
        } catch { }
      } else {
        // Handle known errors
        if (json.data.canRetry) {
          setBookingError('Dieser Termin ist leider nicht mehr verfügbar. Bitte wähle eine andere Zeit.');
          setBookingRetryCount((c) => c + 1);
          setStep('slots'); // Go back to slot selection
          retrySlotsFetch(); // Refresh slots
        } else if (json.data.fallbackToRedirect) {
          // Fallback to Cal.com redirect
          redirectToCal(verification.state.name, email, session?.patient_id);
        } else {
          setBookingError(json.data.message || 'Buchung fehlgeschlagen');
          setStep('confirm');
        }
      }
    } catch (e) {
      console.error('[useCalBooking] Native booking failed:', e);
      setBookingError('Verbindungsfehler. Bitte versuche es erneut.');
      setStep('confirm');
    } finally {
      setBookingLoading(false);
    }
  }, [
    selectedSlot, therapistId, bookingKind, locationType, session,
    verification.state, redirectToCal, retrySlotsFetch
  ]);

  // EARTH-272: Back to verify from confirm
  const backToVerify = useCallback(() => {
    setStep('verify');
    setBookingError(null);
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setSelectedSlot(null);
    setStep('slots');
    verification.reset();
    setSlotsUnavailable(false);
    setBookingRetryCount(0);
    setBookingError(null);
    setBookingResult(null);
    setLocationType(bookingKind === 'intro' ? 'video' : 'video');
  }, [verification, bookingKind]);

  // Map verification state to CalBookingState interface for backward compatibility
  const state: CalBookingState = {
    slots,
    slotsLoading,
    slotsError,
    slotsUnavailable,
    selectedSlot,
    hasAttemptedFetch,
    session,
    sessionLoading,
    step,
    // Map from shared verification hook
    name: verification.state.name,
    contactMethod: verification.state.contactMethod,
    contactValue: verification.state.contactMethod === 'email'
      ? verification.state.email
      : verification.state.phone,
    verificationCode: verification.state.code,
    verifyLoading: verification.state.loading,
    verifyError: verification.state.error,
    bookingRetryCount,
    // EARTH-272: Native booking state
    locationType,
    bookingLoading,
    bookingError,
    bookingResult,
  };

  // Map actions to shared verification hook
  const actions: CalBookingActions = {
    selectSlot: setSelectedSlot,
    clearSlot: () => setSelectedSlot(null),
    proceedToVerify: () => setStep('verify'),
    backToSlots: () => { setStep('slots'); verification.setError(null); },
    goToFallback,
    setName: verification.setName,
    setContactMethod: verification.setContactMethod,
    setContactValue: (value: string) => {
      // Route to correct setter based on contact method
      if (verification.state.contactMethod === 'email') {
        verification.setEmail(value);
      } else {
        verification.setPhone(value);
      }
    },
    setVerificationCode: verification.setCode,
    sendCode,
    verifyCode,
    redirectToCal,
    handleBooking,
    retrySlotsFetch,
    // EARTH-272: Native booking actions
    setLocationType,
    createNativeBooking,
    proceedToConfirm,
    backToVerify,
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
