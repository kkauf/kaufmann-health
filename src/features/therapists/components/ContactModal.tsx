'use client';

import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import '@/components/phone-input-custom.css';
import { normalizePhoneNumber } from '@/lib/verification/phone';

type ContactType = 'booking' | 'consultation';

interface ContactModalProps {
  therapist: {
    id: string;
    first_name: string;
    last_name: string;
    photo_url?: string;
  };
  contactType: ContactType;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** If true, user is considered verified (EARTH-204 cookie). Skip verification. */
  verified?: boolean;
}

type Step = 'verify' | 'verify-code' | 'verify-link' | 'compose' | 'success';

interface PreAuthParams {
  /** Secure match UUID proving pre-authenticated access */
  uuid: string;
  /** Optional known patient name to personalize copy */
  patientName?: string | null;
  /** Optional default reason to prefill composer */
  defaultReason?: string | null;
}

export function ContactModal({ therapist, contactType, open, onClose, onSuccess, preAuth, verified }: ContactModalProps & { preAuth?: PreAuthParams }) {
  const [step, setStep] = useState<Step>('verify');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Verification step
  const [name, setName] = useState('');
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('phone'); // Default to phone for mobile
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  
  // Message step
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  
  const therapistName = `${therapist.first_name} ${therapist.last_name}`;
  const initials = `${therapist.first_name[0]}${therapist.last_name[0]}`.toUpperCase();
  
  // If pre-authenticated via match UUID, skip verification and prefill
  useEffect(() => {
    if (open && preAuth) {
      setError(null);
      // Prefill name if provided (not shown in UI in pre-auth compose mode)
      if (preAuth.patientName) setName(preAuth.patientName);
      const greeting = `Guten Tag ${therapist.first_name}`;
      const intent = contactType === 'booking'
        ? 'ich möchte gerne einen Termin vereinbaren'
        : 'ich würde gerne ein kostenloses Erstgespräch (15 Min) vereinbaren';
      const initialReason = (preAuth.defaultReason || '').trim();
      if (initialReason) setReason(initialReason);
      const signature = preAuth.patientName ? `\n\nViele Grüße\n${preAuth.patientName}` : '';
      setMessage(`${greeting}, ${intent}. Ich suche Unterstützung bei ${initialReason || '[beschreibe dein Anliegen]'} und fand dein Profil sehr ansprechend.${signature}`);
      setStep('compose');
    }
  }, [open, preAuth, therapist.first_name, contactType]);

  // If a verified client session exists (kh_client), skip verification in directory flow
  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      if (!open || preAuth) return;
      try {
        const res = await fetch('/api/public/session');
        if (!res.ok) return;
        const json = await res.json();
        const s = json?.data;
        if (s?.verified && !cancelled) {
          setError(null);
          if (typeof s.name === 'string' && s.name) setName(s.name);
          if (s.contact_method === 'email') {
            setContactMethod('email');
            if (typeof s.contact_value === 'string') setEmail(s.contact_value);
          } else if (s.contact_method === 'phone') {
            setContactMethod('phone');
            if (typeof s.contact_value === 'string') setPhone(s.contact_value);
          }
          setStep('compose');
        }
      } catch {}
    }
    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [open, preAuth]);

  // (Removed redundant effect that referenced undefined `verified`)

  // Track modal open
  useEffect(() => {
    if (open) {
      try {
        const payload = { type: 'contact_modal_opened', properties: { therapist_id: therapist.id, contact_type: contactType } };
        navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      } catch {}
    }
  }, [open, therapist.id, contactType]);
  
  // Track events
  const trackEvent = useCallback((type: string, props?: Record<string, unknown>) => {
    try {
      const payload = { type, properties: { therapist_id: therapist.id, contact_type: contactType, ...props } };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    } catch {}
  }, [therapist.id, contactType]);
  
  // Reset modal state
  const handleClose = useCallback(() => {
    setStep('verify');
    setError(null);
    setName('');
    setEmail('');
    setPhone('');
    setVerificationCode('');
    setReason('');
    setMessage('');
    onClose();
  }, [onClose]);
  
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
      // Normalize phone to E.164 format
      const normalized = normalizePhoneNumber(phone);
      if (!normalized) {
        setError('Bitte gib eine gültige Handynummer ein.');
        return;
      }
      contact = normalized;
    }
    
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
      }

      const res = await fetch('/api/public/verification/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact,
          contact_type: contactMethod,
          // Only used by the email path (magic link)
          redirect: redirectPath,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Senden des Codes');
      }
      
      // Email uses magic link → show link instructions; Phone uses OTP → show code entry
      setStep(contactMethod === 'email' ? 'verify-link' : 'verify-code');
      trackEvent('contact_verification_code_sent', { contact_method: contactMethod });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      trackEvent('contact_verification_code_failed', { contact_method: contactMethod });
    } finally {
      setLoading(false);
    }
  }, [name, contactMethod, email, phone, therapist.id, contactType, trackEvent]);
  
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
      
      // Generate pre-filled message
      const greeting = `Guten Tag ${therapist.first_name}`;
      const intent = contactType === 'booking'
        ? 'ich möchte gerne einen Termin vereinbaren'
        : 'ich würde gerne ein kostenloses Erstgespräch (15 Min) vereinbaren';
      const signature = name ? `\n\nViele Grüße\n${name}` : '';

      setMessage(`${greeting}, ${intent}. Ich suche Unterstützung bei [${reason || 'beschreibe dein Anliegen'}] und fand dein Profil sehr ansprechend.${signature}`);
      setStep('compose');
      trackEvent('contact_verification_completed', { contact_method: contactMethod });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ungültiger Code');
      trackEvent('contact_verification_failed', { contact_method: contactMethod });
    } finally {
      setLoading(false);
    }
  }, [contactMethod, email, phone, verificationCode, therapist.first_name, contactType, reason, trackEvent]);
  
  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!reason.trim()) {
      setError('Bitte beschreibe dein Anliegen');
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      const isPreAuth = Boolean(preAuth?.uuid);
      const endpoint = isPreAuth
        ? `/api/public/matches/${encodeURIComponent(preAuth!.uuid)}/contact`
        : '/api/public/contact';
      const payload = isPreAuth
        ? {
            therapist_id: therapist.id,
            contact_type: contactType,
            patient_reason: reason,
            patient_message: message,
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
  }, [therapist.id, contactType, name, email, phone, contactMethod, reason, message, trackEvent, onSuccess, handleClose, preAuth]);
  
  // Handle enter key submission
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
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
      <p className="text-sm leading-relaxed text-gray-600">
        Um {therapistName} zu kontaktieren, verifiziere dich kurz.
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
          <PhoneInput
            defaultCountry="de"
            value={phone}
            onChange={(phone) => setPhone(phone.replace(/\s+/g, ''))}
            disabled={loading}
            inputClassName="h-11"
            className="w-full"
            placeholder="+49 176 123 45678"
            inputProps={{
              name: 'phone_number',
              autoComplete: 'tel',
              inputMode: 'tel' as const,
              id: 'phone',
            }}
            countrySelectorStyleProps={{
              buttonClassName: 'phone-country-button',
              dropdownStyleProps: {
                className: 'phone-country-dropdown',
                listItemClassName: 'phone-country-item',
              }
            }}
          />
          <p className="text-xs text-gray-500">
            Wir senden dir einen Bestätigungscode per SMS
          </p>
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Weiter'}
        </Button>
      </div>
      
      <p className="text-xs text-gray-500 text-center leading-relaxed">
        Mit dem Absenden stimmst du unserer <a href="/datenschutz" className="underline hover:text-gray-700">Datenschutzerklärung</a> zu.
      </p>
    </div>
  );

  // Render email magic-link verification step (no code entry)
  const renderVerifyLinkStep = () => (
    <div className="space-y-5" onKeyDown={handleKeyDown}>
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
  const renderComposeStep = () => (
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
          <p className="text-sm text-gray-600">
            {contactType === 'booking' ? 'Termin vereinbaren' : 'Erstgespräch (15 Min)'}
          </p>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="reason" className="text-sm font-medium">Worum geht es? *</Label>
        <Input
          id="reason"
          value={reason}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setReason(e.target.value);
            // Update message preview
            const greeting = `Guten Tag ${therapist.first_name}`;
            const intent = contactType === 'booking'
              ? 'ich möchte gerne einen Termin vereinbaren'
              : 'ich würde gerne ein kostenloses Erstgespräch (15 Min) vereinbaren';
            const signature = name ? `\n\nViele Grüße\n${name}` : '';
            setMessage(`${greeting}, ${intent}. Ich suche Unterstützung bei ${e.target.value || '[beschreibe dein Anliegen]'} und fand dein Profil sehr ansprechend.${signature}`);
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
      
      <div className="space-y-2">
        <Label htmlFor="message" className="text-sm font-medium">Nachricht (optional)</Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Deine Nachricht..."
          disabled={loading}
          rows={6}
          className="resize-none"
        />
        <p className="text-xs text-gray-500 leading-relaxed">
          Du kannst die Nachricht anpassen oder so lassen
        </p>
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
          onClick={handleClose} 
          disabled={loading} 
          className="flex-1 h-11"
        >
          Abbrechen
        </Button>
        <Button
          onClick={handleSendMessage}
          disabled={loading || !reason.trim()}
          className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Nachricht senden'}
        </Button>
      </div>
    </div>
  );
  
  // Render success step
  const renderSuccessStep = () => (
    <div className="space-y-6 text-center py-8">
      <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100/60 flex items-center justify-center shadow-lg shadow-emerald-100/50">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
      </div>
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-gray-900">Nachricht gesendet!</h3>
        <p className="text-sm leading-relaxed text-gray-600 max-w-sm mx-auto">
          {therapistName} erhält deine Nachricht und meldet sich innerhalb von 24 Stunden bei dir.
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
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold">
            {step === 'verify' && 'Anmelden um zu senden'}
            {step === 'verify-code' && 'Code bestätigen'}
            {step === 'compose' && 'Nachricht schreiben'}
            {step === 'success' && 'Erfolgreich!'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="pb-2">
          {step === 'verify' && !preAuth && renderVerifyStep()}
          {step === 'verify-code' && !preAuth && renderVerifyCodeStep()}
          {step === 'compose' && renderComposeStep()}
          {step === 'verify-link' && renderVerifyLinkStep()}
          {step === 'success' && renderSuccessStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
