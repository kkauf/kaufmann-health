'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertCircle, Shield, Lock, FileCheck, ShieldCheck, Mail, MailCheck, MapPin, ChevronLeft, ChevronRight, Calendar, Video, User, Tag, CalendarCheck2 } from 'lucide-react';
import { VerifiedPhoneInput } from '@/components/VerifiedPhoneInput';
import { normalizePhoneNumber } from '@/lib/verification/phone';
import { validatePhone } from '@/lib/verification/usePhoneValidation';
import ConsentSection from '@/components/ConsentSection';
import { getAttribution } from '@/lib/attribution';
import { cn } from '@/lib/utils';
import { formatSessionPrice } from '@/lib/pricing';
import { fireGoogleAdsClientConversion } from '@/lib/gtag';

type ContactType = 'booking' | 'consultation';
type Slot = { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string };

interface ContactModalProps {
  therapist: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url?: string;
    typical_rate?: number | null;
    availability?: { date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string }[];
    metadata?: { profile?: { practice_address?: string } };
    accepting_new: boolean;
  };
  contactType: ContactType;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** If true, user is considered verified (EARTH-204 cookie). Skip verification. */
  verified?: boolean;
  /** If true, we returned from confirm redirect and message was already sent. Show success. */
  confirmed?: boolean;
  /** Optional selected slot for booking (directory chips → modal) */
  selectedSlot?: { date_iso: string; time_label: string; format: 'online' | 'in_person' };
  requireVerification?: boolean;
}

type Step = 'verify' | 'verify-code' | 'verify-link' | 'compose' | 'success';

interface PreAuthParams {
  /** Secure match UUID proving pre-authenticated access */
  uuid: string;
  /** Optional known patient name to personalize copy */
  patientName?: string | null;
  /** Optional default reason to prefill composer */
  defaultReason?: string | null;
  /** Optional session preference to pre-select format */
  sessionPreference?: 'online' | 'in_person';
}

export function ContactModal({ therapist, contactType, open, onClose, onSuccess, preAuth, verified, confirmed, selectedSlot, requireVerification }: ContactModalProps & { preAuth?: PreAuthParams }) {
  // Decide starting step
  // For preAuth (matches) we always start in 'compose' to mirror directory behavior
  const needsVerification = Boolean(requireVerification);
  const initialStep: Step = confirmed
    ? 'success'
    : (preAuth ? 'compose' : (needsVerification ? 'verify' : (contactType === 'booking' && selectedSlot ? 'verify' : 'compose')));
  const [step, setStep] = useState<Step>(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verification step
  const [name, setName] = useState('');
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('email'); // Default to phone for mobile
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // Message step
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [sessionFormat, setSessionFormat] = useState<'online' | 'in_person' | ''>(''); // Required for booking
  const [selectedBookingSlot, setSelectedBookingSlot] = useState<{ date_iso: string; time_label: string; format: 'online' | 'in_person'; address?: string } | null>(null);
  // Track whether the user has a verified session in this modal lifecycle
  const [isVerified, setIsVerified] = useState<boolean>(false);

  const [restoredDraft, setRestoredDraft] = useState<boolean>(false);
  const [autoSendAttempted, setAutoSendAttempted] = useState<boolean>(false);
  const draftTrackedRef = useRef<boolean>(false);

  const therapistName = `${therapist.first_name} ${therapist.last_name}`;
  const initials = `${therapist.first_name[0]}${therapist.last_name[0]}`.toUpperCase();
  const [awaitingVerificationSend, setAwaitingVerificationSend] = useState<boolean>(false);
  const [showResendForm, setShowResendForm] = useState(false);
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [forceSuccess, setForceSuccess] = useState(Boolean(confirmed));
  const [patientId, setPatientId] = useState<string | undefined>(undefined);

  // If pre-authenticated via match UUID, prefill and show compose first
  // Do NOT treat the user as verified here; they must still verify before sending
  useEffect(() => {
    if (open && preAuth && !requireVerification) {
      setError(null);
      setIsVerified(false);
      // Prefill name if provided (not shown in UI in pre-auth compose mode)
      if (preAuth.patientName) setName(preAuth.patientName);
      const greeting = `Guten Tag ${therapist.first_name}`;
      const intent = contactType === 'booking'
        ? 'ich möchte gerne einen Termin vereinbaren'
        : 'ich würde gerne ein kostenloses Erstgespräch (15 Min) vereinbaren';
      const initialReason = (preAuth.defaultReason || '').trim();
      if (initialReason) setReason(initialReason);
      const signature = preAuth.patientName ? `\n\nViele Grüße\n${preAuth.patientName}` : '';
      setMessage(`${greeting},\n\n${intent}. Ich suche Unterstützung bei ${initialReason || '[beschreibe dein Anliegen]'} und fand dein Profil sehr ansprechend.${signature}`);

      // Pre-select session format based on patient preferences from wizard
      if (preAuth.sessionPreference) {
        setSessionFormat(preAuth.sessionPreference);
      }

      setStep('compose');
    }
  }, [open, preAuth, therapist.first_name, contactType, requireVerification]);

  // If preAuth preferred format isn't available for this therapist, fall back to the available format.
  // Also, when there is exactly one available format overall, auto-select it to avoid an empty picker.
  useEffect(() => {
    if (!open) return;
    const avail = Array.isArray(therapist.availability) ? therapist.availability : [];
    const hasOnline = avail.some((s) => s.format === 'online');
    const hasInPerson = avail.some((s) => s.format === 'in_person');

    // If a preference was provided via preAuth but therapist doesn't offer it, switch to the offered one
    if (preAuth?.sessionPreference === 'in_person' && !hasInPerson && hasOnline) {
      if (sessionFormat !== 'online') setSessionFormat('online');
      return;
    }
    if (preAuth?.sessionPreference === 'online' && !hasOnline && hasInPerson) {
      if (sessionFormat !== 'in_person') setSessionFormat('in_person');
      return;
    }

    // If no preference provided and only one format exists overall, pick it
    if (!preAuth?.sessionPreference) {
      if (hasOnline && !hasInPerson && sessionFormat !== 'online') {
        setSessionFormat('online');
      } else if (!hasOnline && hasInPerson && sessionFormat !== 'in_person') {
        setSessionFormat('in_person');
      }
    }
  }, [open, preAuth?.sessionPreference, therapist.availability, sessionFormat]);

  // Seed selected slot and format from prop on open
  useEffect(() => {
    if (open && selectedSlot && contactType === 'booking') {
      setSelectedBookingSlot(selectedSlot);
      setSessionFormat(selectedSlot.format);
    }
  }, [open, selectedSlot, contactType]);

  // Lock consultation to online format
  useEffect(() => {
    if (open && contactType === 'consultation') {
      setSessionFormat('online');
    }
  }, [open, contactType]);

  // If a verified client session exists (kh_client), skip verification
  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      if (!open) return;
      if (step === 'success') return;
      try {
        const res = await fetch('/api/public/session');
        if (!res.ok) return;
        const json = await res.json();
        const s = json?.data;
        if (s?.verified && !cancelled) {
          setError(null);
          setIsVerified(true);
          try {
            if (typeof s.patient_id === 'string' && s.patient_id) setPatientId(s.patient_id);
          } catch { }
          const userName = typeof s.name === 'string' && s.name ? s.name : '';
          if (userName) setName(userName);
          if (s.contact_method === 'email') {
            setContactMethod('email');
            if (typeof s.contact_value === 'string') setEmail(s.contact_value);
          } else if (s.contact_method === 'phone') {
            setContactMethod('phone');
            if (typeof s.contact_value === 'string') setPhone(s.contact_value);
          }
          const greeting = `Guten Tag ${therapist.first_name}`;
          const intent = contactType === 'booking'
            ? 'ich möchte gerne einen Termin vereinbaren'
            : 'ich würde gerne ein kostenloses Erstgespräch (15 Min) vereinbaren';
          const signature = userName ? `\n\nViele Grüße\n${userName}` : '';
          setMessage(`${greeting},\n\n${intent}. Ich suche Unterstützung bei [beschreibe dein Anliegen] und fand dein Profil sehr ansprechend.${signature}`);

          if (forceSuccess || awaitingVerificationSend) {
            // After magic-link verification we show success to mirror directory behavior
            setStep('success');
            setAwaitingVerificationSend(false);
          } else {
            setStep('compose');
          }
        }
      } catch { }
    }
    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [open, preAuth, therapist.first_name, contactType, awaitingVerificationSend, forceSuccess, step]);

  // Prefill session format if a slot was selected externally
  useEffect(() => {
    if (open && selectedSlot && contactType === 'booking') {
      setSessionFormat(selectedSlot.format);
    }
  }, [open, selectedSlot, contactType]);

  // If parent indicates verified (email confirm return), reflect in local state
  useEffect(() => {
    if (open && !preAuth && verified) {
      setIsVerified(true);
      if (forceSuccess || awaitingVerificationSend) {
        setStep('success');
        setAwaitingVerificationSend(false);
      }
    }
  }, [open, preAuth, verified, awaitingVerificationSend, forceSuccess]);

  useEffect(() => {
    if (open && !preAuth && confirmed) {
      setIsVerified(true);
      setForceSuccess(true);
      setStep('success');
    }
  }, [open, preAuth, confirmed]);

  useEffect(() => {
    if (!open) return;
    try {
      const u = new URL(window.location.href);
      const c = u.searchParams.get('confirm');
      const tidParam = u.searchParams.get('tid');
      const contactParam = u.searchParams.get('contact');
      if ((c === '1' || c === 'success') && tidParam === therapist.id && contactParam === 'compose') {
        setIsVerified(true);
        setForceSuccess(true);
        setStep('success');
      }
    } catch { }
  }, [open, preAuth, therapist.id]);

  // Draft restoration no longer needed - server processes draft_contact on verification
  // Message is auto-sent after email/SMS confirmation via /api/public/leads/confirm or /api/public/verification/verify-code



  // Track modal open
  useEffect(() => {
    if (open) {
      try {
        const attrs = getAttribution();
        const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
        const payload = { type: 'contact_modal_opened', ...attrs, properties: { page_path: pagePath, therapist_id: therapist.id, contact_type: contactType } };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch { }
    }
  }, [open, therapist.id, contactType]);

  // Note: Draft is now saved server-side via draft_contact parameter in handleSendCode
  // No longer using sessionStorage for cross-device compatibility

  // Track events
  const trackEvent = useCallback((type: string, props?: Record<string, unknown>) => {
    try {
      const attrs = getAttribution();
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
      const payload = { type, ...attrs, properties: { page_path: pagePath, therapist_id: therapist.id, contact_type: contactType, ...props } };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } catch { }
  }, [therapist.id, contactType]);

  // Availability helpers (booking)
  const allSlots = useMemo<Slot[]>(() => Array.isArray(therapist.availability) ? (therapist.availability as Slot[]) : [], [therapist.availability]);
  const minSelectable = useMemo(() => new Date(Date.now() + 24 * 60 * 60 * 1000), []);
  function slotDate(s: Slot) {
    const [h, m] = (s.time_label || '00:00').split(':').map((x) => parseInt(x, 10) || 0);
    const d = new Date(s.date_iso + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d;
  }
  function formatSlotLabel(s: Slot) {
    const dt = slotDate(s);
    const dayStr = dt.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });
    return `${dayStr} ${s.time_label}`;
  }
  const selectableSlots = useMemo<Slot[]>(() => allSlots.filter(s => slotDate(s) >= minSelectable), [allSlots, minSelectable]);
  const slotsByWeek = useMemo(() => {
    const map = new Map<string, { label: string; start: Date; slots: Slot[] }>();
    selectableSlots.forEach(s => {
      const dt = slotDate(s);
      const day = dt.getDay();
      const deltaToMon = (day === 0 ? -6 : 1 - day);
      const start = new Date(dt);
      start.setDate(dt.getDate() + deltaToMon);
      start.setHours(0, 0, 0, 0);
      const key = start.toISOString().slice(0, 10);
      if (!map.has(key)) {
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const label = `${start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} – ${end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`;
        map.set(key, { label, start, slots: [] });
      }
      map.get(key)!.slots.push(s);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].start.getTime() - b[1].start.getTime());
  }, [selectableSlots]);
  const [weekIndex, setWeekIndex] = useState(0);

  useEffect(() => {
    if (weekIndex >= slotsByWeek.length) setWeekIndex(0);
  }, [slotsByWeek.length, weekIndex]);
  // NOTE: intentionally no second useEffect here

  // Reset modal state
  const handleClose = useCallback(() => {
    try {
      trackEvent('contact_modal_closed', { step });
    } catch { }
    setStep('compose');
    setError(null);
    setName('');
    setEmail('');
    setPhone('');
    setVerificationCode('');
    setReason('');
    setMessage('');
    setSessionFormat('');
    setSelectedBookingSlot(null);
    setIsVerified(false);
    setForceSuccess(false);
    setAwaitingVerificationSend(false);
    onClose();
  }, [onClose, step, trackEvent]);

  // Send verification code
  const handleSendCode = useCallback(async () => {
    setError(null);

    // Validate inputs before sending
    if (!name.trim()) {
      setError('Bitte gib deinen Namen an.');
      return;
    }

    let contact = '';
    if (contactMethod === 'email') {
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        setError('Bitte gib eine gültige E-Mail-Adresse ein.');
        return;
      }
      contact = email;
    } else {
      // Validate and normalize phone to E.164 format
      const validation = validatePhone(phone);
      if (!validation.isValid || !validation.normalized) {
        setError(validation.error || 'Bitte gib eine gültige Handynummer ein.');
        return;
      }
      contact = validation.normalized;
    }

    try { trackEvent('contact_verification_started', { contact_method: contactMethod }); } catch { }
    setLoading(true);

    try {
      // For email magic-link: include a safe redirect back to the current page
      // so that the confirm endpoint can bring the user back into the ContactModal
      // compose step. EARTH-204 will set the client cookie so the user is treated
      // as verified when they return.
      let redirectPath: string | undefined;
      if (contactMethod === 'email') {
        try {
          const url = new URL(window.location.href);
          const basePath = url.pathname;
          const qs = new URLSearchParams({
            contact: 'compose',
            tid: therapist.id,
            type: contactType,
          });
          redirectPath = `${basePath}?${qs.toString()}`;
        } catch {
          redirectPath = `/therapeuten?contact=compose&tid=${therapist.id}&type=${contactType}`;
        }
        // Draft will be sent as draft_contact parameter below
      }

      // Prepare draft_contact for server-side storage (works across devices)
      const draftContact = {
        therapist_id: therapist.id,
        contact_type: contactType,
        patient_reason: reason,
        patient_message: message,
        session_format: sessionFormat || undefined,
      };

      const res = await fetch('/api/public/verification/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact,
          contact_type: contactMethod,
          // Include name so it can be stored in DB for both email and SMS flows
          name: name.trim(),
          // Only used by the email path (magic link)
          redirect: redirectPath,
          // Server-side draft storage (therapist directory flow)
          draft_contact: draftContact,
          ...(selectedBookingSlot && contactType === 'booking' ? { draft_booking: { therapist_id: therapist.id, date_iso: selectedBookingSlot.date_iso, time_label: selectedBookingSlot.time_label, format: selectedBookingSlot.format } } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Senden des Codes');
      }

      // Email uses magic link → show link instructions; Phone uses OTP → show code entry
      setStep(contactMethod === 'email' ? 'verify-link' : 'verify-code');
      setAwaitingVerificationSend(contactMethod === 'email');
      trackEvent('contact_verification_code_sent', { contact_method: contactMethod });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      trackEvent('contact_verification_code_failed', { contact_method: contactMethod });
    } finally {
      setLoading(false);
    }
  }, [name, contactMethod, email, phone, therapist.id, contactType, trackEvent, selectedBookingSlot, reason, message, sessionFormat]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    console.log('[ContactModal] handleSendMessage called:', { reason: reason.trim(), message: message.trim(), sessionFormat, contactType });
    // Require either reason OR message unless a booking slot was selected
    if (!(contactType === 'booking' && selectedBookingSlot) && !reason.trim() && !message.trim()) {
      console.log('[ContactModal] Validation failed: no reason or message');
      setError('Bitte beschreibe dein Anliegen oder schreibe eine Nachricht');
      return;
    }

    // Validate session format for booking type
    if (contactType === 'booking' && !sessionFormat) {
      setError('Bitte wähle, ob der Termin online oder vor Ort stattfinden soll');
      return;
    }

    // Additional validation for non-preAuth flow
    const isPreAuth = Boolean(preAuth?.uuid);
    if (!isPreAuth) {
      if (!name.trim()) {
        setError('Name fehlt. Bitte lade die Seite neu.');
        console.error('[ContactModal] Missing name:', { name, contactMethod, email, phone });
        return;
      }
      if (!contactMethod) {
        setError('Kontaktmethode fehlt. Bitte lade die Seite neu.');
        console.error('[ContactModal] Missing contact_method:', { name, contactMethod, email, phone });
        return;
      }
      const contactValue = contactMethod === 'email' ? email : phone;
      if (!contactValue || !contactValue.trim()) {
        setError('Kontaktinformation fehlt. Bitte lade die Seite neu.');
        console.error('[ContactModal] Missing contact value:', { name, contactMethod, email, phone });
        return;
      }
    }

    setError(null);
    setLoading(true);

    try {
      const endpoint = isPreAuth
        ? `/api/public/matches/${encodeURIComponent(preAuth!.uuid)}/contact`
        : '/api/public/contact';
      const attrsForConv = getAttribution();
      const payload = isPreAuth
        ? {
          therapist_id: therapist.id,
          contact_type: contactType,
          patient_reason: reason,
          patient_message: message,
          session_format: sessionFormat || undefined,
          session_id: attrsForConv.session_id,
        }
        : {
          therapist_id: therapist.id,
          contact_type: contactType,
          patient_name: name,
          patient_email: contactMethod === 'email' ? email : undefined,
          patient_phone: contactMethod === 'phone' ? normalizePhoneNumber(phone) : undefined,
          contact_method: contactMethod,
          patient_reason: reason,
          patient_message: message,
          session_format: sessionFormat || undefined,
          session_id: attrsForConv.session_id,
        };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'RATE_LIMIT_EXCEEDED') {
          throw new Error(data.error);
        }
        throw new Error(data.error || 'Fehler beim Senden der Nachricht');
      }

      setStep('success');
      if (!preAuth) {
        trackEvent('contact_message_sent');
      } else {
        // Mark a separate client-side signal for observability without affecting server rate limit
        trackEvent('contact_message_sent_client_pre_auth');
      }

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      trackEvent('contact_message_failed');
    } finally {
      setLoading(false);
    }
  }, [therapist.id, contactType, name, email, phone, contactMethod, reason, message, sessionFormat, trackEvent, onSuccess, handleClose, preAuth]);

  // Auto-send no longer needed - server handles draft_contact processing on verification

  // Verify code
  const handleVerifyCode = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      // Normalize phone if needed
      const contact = contactMethod === 'email' ? email : normalizePhoneNumber(phone) || phone;

      const res = await fetch('/api/public/verification/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact,
          contact_type: contactMethod,
          code: verificationCode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.data?.verified) {
        throw new Error('Ungültiger Code');
      }

      // Mark verified and show success; server processes draft_contact and sends message
      setIsVerified(true);
      try {
        const res = await fetch('/api/public/session');
        if (res.ok) {
          const json = await res.json();
          const pid = json?.data?.patient_id;
          if (typeof pid === 'string' && pid) setPatientId(pid);
        }
      } catch { }
      trackEvent('contact_verification_completed', { contact_method: contactMethod });
      setLoading(false);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ungültiger Code');
      trackEvent('contact_verification_failed', { contact_method: contactMethod });
      setLoading(false);
    }
  }, [contactMethod, email, phone, verificationCode, therapist.first_name, contactType, reason, name, sessionFormat, message, trackEvent, handleSendMessage]);

  useEffect(() => {
    async function maybeFireClientConv() {
      if (step !== 'success') return;
      let pid = patientId;
      if (!pid) {
        try {
          const res = await fetch('/api/public/session');
          if (res.ok) {
            const json = await res.json();
            const sPid = json?.data?.patient_id;
            if (typeof sPid === 'string' && sPid) {
              pid = sPid;
              setPatientId(sPid);
            }
          }
        } catch { }
      }
      try {
        fireGoogleAdsClientConversion(pid);
      } catch { }
    }
    void maybeFireClientConv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Handle enter key submission
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      // Don't submit when Enter is pressed in a textarea (allow new lines)
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') {
        return;
      }

      e.preventDefault();
      if (step === 'verify') {
        const canSubmit = name.trim() && (contactMethod === 'email' ? email.trim() : phone.trim());
        if (canSubmit) handleSendCode();
      } else if (step === 'verify-code') {
        if (verificationCode.length >= 4) handleVerifyCode();
      } else if (step === 'compose') {
        if (reason.trim()) handleSendMessage();
      }
    }
  }, [step, loading, name, contactMethod, email, phone, verificationCode, reason, handleSendCode, handleVerifyCode, handleSendMessage]);

  // Render verification step
  const renderVerifyStep = () => (
    <div className="space-y-5" onKeyDown={handleKeyDown}>
      {contactType === 'booking' && selectedBookingSlot && (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-3 space-y-2 shadow-sm">
          <div className="text-sm text-emerald-900">
            <div className="font-medium">Du buchst deine {sessionFormat === 'in_person' ? 'Vor‑Ort' : 'Online'}‑Therapiesitzung</div>
            <div className="mt-1">{formatSlotLabel(selectedBookingSlot)} bei {therapistName}</div>
          </div>
          <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-white text-emerald-800">
            <Tag className="h-3.5 w-3.5" />
            {formatSessionPrice(therapist.typical_rate)}
          </Badge>
        </div>
      )}
      <p className="text-sm leading-relaxed text-gray-600">
        Wie dürfen dich Therapeut:innen erreichen? <strong>Wir schützen vor Spam</strong> und stellen sicher,
        dass deine Nachricht beantwortet werden kann. Deine Daten bleiben <strong>privat & DSGVO‑konform</strong>.
      </p>

      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dein Name"
          disabled={loading}
          className="h-11"
          autoComplete="name"
          autoFocus
        />
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Kontaktmethode *</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={contactMethod === 'email' ? 'default' : 'outline'}
            onClick={() => setContactMethod('email')}
            disabled={loading}
            className="flex-1 h-11"
          >
            E-Mail
          </Button>
          <Button
            type="button"
            variant={contactMethod === 'phone' ? 'default' : 'outline'}
            onClick={() => setContactMethod('phone')}
            disabled={loading}
            className="flex-1 h-11"
          >
            Telefon
          </Button>
        </div>
      </div>

      {contactMethod === 'email' ? (
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">E-Mail *</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="deine@email.de"
            disabled={loading}
            className="h-11"
            autoComplete="email"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">Telefonnummer *</Label>
          <VerifiedPhoneInput
            value={phone}
            onChange={setPhone}
            disabled={loading}
            inputClassName="h-11"
            helpText="Wir senden dir einen Bestätigungscode per SMS"
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {contactType === 'booking' && selectedBookingSlot && (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 text-sm text-emerald-900 shadow-sm">
          <div className="font-medium">Ausgewählter Termin</div>
          <div className="mt-1">{formatSlotLabel(selectedBookingSlot)} · {sessionFormat === 'in_person' ? 'Vor‑Ort' : 'Online'} · {therapistName}</div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={handleClose}
          disabled={loading}
          className="flex-1 h-11"
        >
          Abbrechen
        </Button>
        <Button
          onClick={handleSendCode}
          disabled={loading || !name.trim() || (contactMethod === 'email' ? !email.trim() : !phone.trim())}
          className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (contactType === 'booking' ? 'Termin buchen' : 'Bestätigen')}
        </Button>
      </div>

      <p className="text-xs text-gray-500 text-center leading-relaxed">
        Deine Angaben werden ausschließlich für diese Kontaktaufnahme genutzt – privat & DSGVO‑konform.
        Mit dem Absenden stimmst du unserer <a href="/datenschutz" className="underline hover:text-gray-700">Datenschutzerklärung</a> zu.
      </p>
    </div>
  );

  // Render email magic-link verification step (no code entry)
  const renderVerifyLinkStep = () => (
    <div className="space-y-5" onKeyDown={handleKeyDown}>
      <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100/60 flex items-center justify-center shadow">
        <Mail className="h-8 w-8 text-indigo-600" />
      </div>
      {contactType === 'booking' && selectedBookingSlot && (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-3 space-y-2 shadow-sm">
          <div className="text-sm text-emerald-900">
            <div className="font-medium">Du buchst deine {sessionFormat === 'in_person' ? 'Vor‑Ort' : 'Online'}‑Therapiesitzung</div>
            <div className="mt-1">{formatSlotLabel(selectedBookingSlot)} bei {therapistName}</div>
          </div>
          <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-white text-emerald-800">
            <Tag className="h-3.5 w-3.5" />
            {formatSessionPrice(therapist.typical_rate)}
          </Badge>
        </div>
      )}
      <p className="text-sm leading-relaxed text-gray-600">
        Wir haben dir einen Bestätigungslink per E‑Mail gesendet. Bitte öffne deine E‑Mail und klicke auf
        „E‑Mail bestätigen“. Danach kehrst du automatisch hierher zurück und kannst die Nachricht senden.
      </p>

      <div className="rounded-lg border border-gray-200/60 bg-white/80 p-4 text-sm text-gray-700">
        <p className="font-medium text-gray-900">Tipps, falls nichts ankommt:</p>
        <ul className="mt-2 list-disc pl-5 space-y-1">
          <li>Prüfe Spam/Unbekannt</li>
          <li>Warte 1–2 Minuten</li>
          <li>Nutze alternativ SMS</li>
        </ul>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!showResendForm ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowResendForm(true)}
            disabled={loading}
            className="text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 transition-colors"
          >
            E-Mail nicht erhalten?
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-gray-200/60 bg-white/80 p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-700">E-Mail erneut senden oder Adresse korrigieren:</p>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="deine@email.de"
            disabled={loading || resendSubmitting}
            className="h-11"
            aria-label="E‑Mail"
          />
          <Button
            type="button"
            onClick={async () => {
              if (resendSubmitting) return;
              const next = (email || '').trim();
              if (!next || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) {
                setResendMessage('Bitte eine gültige E‑Mail eingeben.');
                return;
              }
              setResendSubmitting(true);
              setResendMessage('');
              // Ensure email path is selected and send magic link using existing logic
              setContactMethod('email');
              await handleSendCode();
              // If no error set by handler, show success message
              setResendMessage(prev => (prev || !error ? 'E‑Mail versendet. Bitte Posteingang prüfen.' : prev));
              setResendSubmitting(false);
            }}
            disabled={loading || resendSubmitting}
            className="h-11"
          >
            {resendSubmitting ? 'Wird gesendet…' : 'Bestätigungs‑E‑Mail erneut senden'}
          </Button>
          {resendMessage && (
            <p className="text-sm text-center text-gray-600" aria-live="polite">{resendMessage}</p>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep('verify')}
          disabled={loading}
          className="flex-1 h-11"
        >
          Zurück
        </Button>
        <Button
          type="button"
          onClick={handleSendCode}
          disabled={loading}
          className="flex-1 h-11"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Erneut senden'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => { setContactMethod('phone'); setStep('verify'); }}
          disabled={loading}
          className="flex-1 h-11"
        >
          Stattdessen SMS verwenden
        </Button>
      </div>

      {/* NOTE: After clicking the email link, /api/public/leads/confirm will redirect back
          to this page with a query that we can use to reopen the ContactModal in the
          compose step. EARTH-204 will set a cookie so the user is treated as verified. */}
    </div>
  );

  // Render code verification step
  const renderVerifyCodeStep = () => (
    <div className="space-y-5" onKeyDown={handleKeyDown}>
      {contactType === 'booking' && selectedBookingSlot && (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/80 p-3 space-y-2 shadow-sm">
          <div className="text-sm text-emerald-900">
            <div className="font-medium">Du buchst deine {sessionFormat === 'in_person' ? 'Vor‑Ort' : 'Online'}‑Therapiesitzung</div>
            <div className="mt-1">{formatSlotLabel(selectedBookingSlot)} bei {therapistName}</div>
          </div>
          <Badge variant="outline" className="gap-1.5 border-emerald-200 bg-white text-emerald-800">
            <Tag className="h-3.5 w-3.5" />
            {formatSessionPrice(therapist.typical_rate)}
          </Badge>
        </div>
      )}
      <p className="text-sm leading-relaxed text-gray-600">
        Wir haben dir einen Code per {contactMethod === 'email' ? 'E-Mail' : 'SMS'} gesendet.
      </p>

      <div className="space-y-2">
        <Label htmlFor="code" className="text-sm font-medium">Bestätigungscode *</Label>
        <Input
          id="code"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          placeholder="123456"
          disabled={loading}
          maxLength={6}
          className="h-11 text-center text-lg tracking-widest"
          autoComplete="one-time-code"
          inputMode="numeric"
          autoFocus
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => setStep('verify')}
          disabled={loading}
          className="flex-1 h-11"
        >
          Zurück
        </Button>
        <Button
          onClick={handleVerifyCode}
          disabled={loading || verificationCode.length < 4}
          className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Bestätigen'}
        </Button>
      </div>

      <button
        type="button"
        onClick={handleSendCode}
        disabled={loading}
        className="text-sm text-emerald-600 hover:text-emerald-700 hover:underline w-full text-center transition-colors"
      >
        Code erneut senden
      </button>
    </div>
  );

  // Render message composition step
  const renderComposeStep = () => {
    const hasAvailability = contactType === 'booking' && Array.isArray(therapist.availability) && therapist.availability.length > 0;
    const showBookingPicker = hasAvailability;
    const selectedFormat = sessionFormat as 'online' | 'in_person' | '';
    const resolvedAddress = selectedFormat === 'in_person' ? (selectedBookingSlot?.address || therapist.metadata?.profile?.practice_address || '') : '';

    // Check which formats have available slots
    const hasOnlineSlots = hasAvailability && therapist.availability!.some(s => s.format === 'online');
    const hasInPersonSlots = hasAvailability && therapist.availability!.some(s => s.format === 'in_person');

    const slotsForWeek: Slot[] = slotsByWeek[weekIndex]?.[1]?.slots || [];
    const filteredSlots: Slot[] = selectedFormat ? slotsForWeek.filter((s) => s.format === selectedFormat) : slotsForWeek;

    return (
      <div className="space-y-5" onKeyDown={handleKeyDown}>
        {/* Therapist info */}
        <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-slate-50 to-slate-100/60 rounded-xl border border-slate-200/60 shadow-sm">
          <Avatar className="h-14 w-14 ring-2 ring-white shadow-sm">
            {therapist.photo_url ? (
              <AvatarImage src={therapist.photo_url} alt={therapistName} />
            ) : (
              <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900">{therapistName}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {selectedBookingSlot ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-emerald-300 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800 shadow-sm">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {(() => {
                      const dt = slotDate(selectedBookingSlot);
                      const day = dt.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                      return `${day} ${selectedBookingSlot.time_label}`;
                    })()}
                  </span>
                  <span className="opacity-70">• {selectedBookingSlot.format === 'online' ? 'Online' : 'Vor Ort'}</span>
                </div>
              ) : (
                <>
                  <p className="text-gray-600">
                    {contactType === 'booking' ? 'Termin vereinbaren' : 'Erstgespräch (15 Min)'}
                  </p>
                  {therapist.accepting_new ? (
                    <Badge className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Verfügbar</span>
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Keine Kapazität</Badge>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {!showBookingPicker && (
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">Worum geht es? *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setReason(e.target.value);
                const greeting = `Guten Tag ${therapist.first_name}`;
                const intent = contactType === 'booking'
                  ? 'ich möchte gerne einen Termin vereinbaren'
                  : 'ich würde gerne ein kostenloses Erstgespräch (15 Min) vereinbaren';
                const signature = name ? `\n\nViele Grüße\n${name}` : '';
                setMessage(`${greeting}, ${intent}. Ich suche Unterstützung bei ${e.target.value || '[beschreibe dein Anliegen]'} und fand dein Profil sehr ansprechend.${signature}`);
                try {
                  if (!draftTrackedRef.current) {
                    const len = (`${e.target.value}` + `${message || ''}`).trim().length;
                    if (len > 0) {
                      draftTrackedRef.current = true;
                      trackEvent('message_drafted', { length: len, step: 'reason' });
                    }
                  }
                } catch { }
              }}
              placeholder="z.B. Panikattacken, Überforderung im Alltag, Beziehungsproblemen"
              disabled={loading}
              className="h-11"
              autoFocus
            />
            <p className="text-xs text-gray-500 leading-relaxed">
              Beschreibe kurz, wobei du Unterstützung suchst
            </p>
          </div>
        )}

        {/* Session format selector - booking type */}
        {contactType === 'booking' && (
          showBookingPicker ? (
            (hasOnlineSlots || hasInPersonSlots) && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Format *</Label>
                <div className="flex gap-2 max-w-md mx-auto">
                  {hasOnlineSlots && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSessionFormat('online')}
                      disabled={loading}
                      className={cn(
                        'flex-1 h-11 gap-2',
                        'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
                        sessionFormat === 'online' && 'ring-2 ring-emerald-400 border-emerald-400'
                      )}
                    >
                      <Video className="h-4 w-4" />
                      Online
                    </Button>
                  )}
                  {hasInPersonSlots && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSessionFormat('in_person')}
                      disabled={loading}
                      className={cn(
                        'flex-1 h-11 gap-2',
                        'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
                        sessionFormat === 'in_person' && 'ring-2 ring-emerald-400 border-emerald-400'
                      )}
                    >
                      <User className="h-4 w-4" />
                      Vor Ort
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed text-center">
                  Soll der Termin online oder vor Ort stattfinden?
                </p>
                {selectedFormat === 'in_person' && resolvedAddress && (
                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 shadow-sm">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[18rem]" title={resolvedAddress}>{resolvedAddress}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            // No availability → still ask for preferred format to include in outreach
            <div className="space-y-3">
              <Label className="text-sm font-medium">Format *</Label>
              <div className="flex gap-2 max-w-md mx-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSessionFormat('online')}
                  disabled={loading}
                  className={cn(
                    'flex-1 h-11 gap-2',
                    'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
                    sessionFormat === 'online' && 'ring-2 ring-emerald-400 border-emerald-400'
                  )}
                >
                  <Video className="h-4 w-4" />
                  Online
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSessionFormat('in_person')}
                  disabled={loading}
                  className={cn(
                    'flex-1 h-11 gap-2',
                    'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
                    sessionFormat === 'in_person' && 'ring-2 ring-emerald-400 border-emerald-400'
                  )}
                >
                  <User className="h-4 w-4" />
                  Vor Ort
                </Button>
              </div>
              {selectedFormat === 'in_person' && resolvedAddress && (
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 shadow-sm">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[18rem]" title={resolvedAddress}>{resolvedAddress}</span>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* Booking slot picker by week */}
        {showBookingPicker && (
          <div className="space-y-3">
            <div className="flex items-center justify-between max-w-sm mx-auto">
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => setWeekIndex((i) => Math.max(0, i - 1))} disabled={weekIndex <= 0} aria-label="Vorherige Woche">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium text-gray-900">{slotsByWeek[weekIndex]?.[1]?.label || ''}</div>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => setWeekIndex((i) => Math.min(slotsByWeek.length - 1, i + 1))} disabled={weekIndex >= slotsByWeek.length - 1} aria-label="Nächste Woche">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {filteredSlots.map((s: Slot, idx: number) => {
                const dt = slotDate(s);
                const disabled = dt < minSelectable;
                const selected = !!selectedBookingSlot && selectedBookingSlot.date_iso === s.date_iso && selectedBookingSlot.time_label === s.time_label && selectedBookingSlot.format === s.format;
                const base = selected
                  ? 'ring-2 ring-emerald-400 border-2 border-emerald-400 bg-emerald-50 text-emerald-900 shadow-md scale-105'
                  : s.format === 'online'
                    ? 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100';
                const cls = `h-11 px-3 inline-flex items-center gap-1.5 rounded-full border text-sm font-medium shadow-sm transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow'} ${base}`;
                const day = dt.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                return (
                  <button
                    key={`${s.date_iso}-${s.time_label}-${idx}`}
                    type="button"
                    className={cls}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      setSelectedBookingSlot(s);
                      if (!sessionFormat) setSessionFormat(s.format);
                      try {
                        trackEvent('booking_slot_selected', {
                          therapist_id: therapist.id,
                          date_iso: s.date_iso,
                          time_label: s.time_label,
                          format: s.format,
                          address_present: Boolean(s.address || therapist.metadata?.profile?.practice_address),
                          week_index: weekIndex,
                        });
                      } catch { }
                    }}
                    title={s.format === 'online' ? 'Online' : 'Vor Ort'}
                  >
                    <span>{day} {s.time_label}</span>
                  </button>
                );
              })}
              {filteredSlots.length === 0 && (
                <div className="text-sm text-gray-600">Keine Termine in dieser Woche für das gewählte Format.</div>
              )}
            </div>
          </div>
        )}

        {!showBookingPicker && (
          <div className="space-y-2">
            <Label htmlFor="message" className="text-sm font-medium">Nachricht (optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                try {
                  if (!draftTrackedRef.current) {
                    const len = (`${reason || ''}` + `${e.target.value}`).trim().length;
                    if (len > 0) {
                      draftTrackedRef.current = true;
                      trackEvent('message_drafted', { length: len, step: 'message' });
                    }
                  }
                } catch { }
              }}
              placeholder="Deine Nachricht..."
              disabled={loading}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 leading-relaxed">
              Du kannst die Nachricht anpassen oder so lassen
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {!showBookingPicker && (
          <>
            <ConsentSection actor="directory" className="-mt-2" />
            <p className="mt-2 text-xs sm:text-sm text-gray-600 leading-relaxed flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                <span>DSGVO‑konform</span>
              </span>
              <span className="text-gray-300">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-600" />
                <span>SSL‑verschlüsselt</span>
              </span>
              <span className="text-gray-300">•</span>
              <span className="inline-flex items-center gap-1.5">
                <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Privat – keine Krankenkassenakte</span>
              </span>
            </p>
          </>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 h-11"
          >
            Abbrechen
          </Button>
          {showBookingPicker ? (
            <Button
              onClick={() => {
                setStep('verify');
              }}
              disabled={loading || !sessionFormat || !selectedBookingSlot}
              className="flex-1 h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Weiter zur Eingabe'}
            </Button>
          ) : (
            (isVerified) ? (
              <Button
                onClick={handleSendMessage}
                disabled={loading || (!reason.trim() && !message.trim()) || (contactType === 'booking' && !sessionFormat)}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Nachricht senden'}
              </Button>
            ) : (
              <Button
                onClick={() => setStep('verify')}
                disabled={loading || (!reason.trim() && !message.trim()) || (contactType === 'booking' && !sessionFormat)}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Weiter'}
              </Button>
            )
          )}
        </div>
      </div>
    );
  };

  // Render success step
  const renderSuccessStep = () => {
    const isBooking = contactType === 'booking' && selectedBookingSlot;

    return (
      <div className="space-y-6 text-center py-8">
        <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100/60 flex items-center justify-center shadow-lg shadow-emerald-100/50">
          <MailCheck className="h-10 w-10 text-emerald-600" />
        </div>
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-gray-900">
            {isBooking ? 'Termin gebucht!' : 'Nachricht gesendet!'}
          </h3>
          <p className="text-sm leading-relaxed text-gray-600 max-w-sm mx-auto">
            {isBooking ? (
              <>
                Deine Buchung wurde bestätigt. {therapistName} erhält die Details und du bekommst eine Bestätigungs-E-Mail.
              </>
            ) : (
              <>
                {therapistName} erhält deine Nachricht und meldet sich innerhalb von 24 Stunden bei dir.
              </>
            )}
          </p>
        </div>
        <Button
          onClick={handleClose}
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-700"
        >
          Weitere Therapeuten ansehen
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        data-testid="contact-modal"
        aria-describedby={undefined}
        className="max-h-[85vh] overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:max-w-3xl"
      >
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold">
            {step === 'verify' && (contactType === 'booking' ? 'Termin buchen' : 'Anmelden um zu senden')}
            {step === 'verify-code' && 'Code bestätigen'}
            {step === 'compose' && (contactType === 'booking' && therapist.availability?.length ? 'Termin buchen' : 'Nachricht schreiben')}
            {step === 'verify-link' && 'E‑Mail bestätigen'}
            {step === 'success' && 'Erfolgreich!'}
          </DialogTitle>
        </DialogHeader>
        <div className="pb-2">
          {step === 'verify' && renderVerifyStep()}
          {step === 'verify-code' && renderVerifyCodeStep()}
          {step === 'compose' && renderComposeStep()}
          {step === 'verify-link' && renderVerifyLinkStep()}
          {step === 'success' && renderSuccessStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
