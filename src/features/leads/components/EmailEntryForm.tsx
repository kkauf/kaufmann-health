/**
 * ContactEntryForm (formerly EmailEntryForm) - Device-aware email or phone entry
 * EARTH-191: SMS verification for faster mobile onboarding
 * 
 * Smart defaults based on VERIFICATION_MODE:
 * - email: Email field only (backward compatible)
 * - sms: Phone field only
 * - choice: Device-aware (mobile=phone, desktop=email) with toggle
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { track } from '@vercel/analytics';
import { getVerificationModeClient } from '@/lib/verification/config';
import { getFlowVariant } from '@/lib/flow-randomization';
import { VerifiedPhoneInput } from '@/components/VerifiedPhoneInput';
import { validatePhone } from '@/lib/verification/usePhoneValidation';
import ConsentSection from '@/components/ConsentSection';

// Note: Google Ads conversions are handled at Fragebogen completion (client + server).

export type ContactMethod = 'email' | 'phone';

interface ContactEntryFormProps {
  defaultSessionPreference?: 'online' | 'in_person';
  dataCta?: string;
  verificationMode?: 'email' | 'sms' | 'choice'; // Override env
}

/**
 * Detect if user is on mobile device (kept for potential future use)
 */
function _isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /mobile|android|iphone|ipad|ipod/i.test(ua);
}

/**
 * Get saved preference from localStorage
 */
function getSavedContactMethod(): ContactMethod | null {
  if (typeof window === 'undefined') return null;
  const saved = window.localStorage.getItem('kh_contact_method');
  if (saved === 'email' || saved === 'phone') return saved;
  return null;
}

/**
 * Save user's contact method preference
 */
function saveContactMethod(method: ContactMethod) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('kh_contact_method', method);
  }
}

export function ContactEntryForm({ 
  defaultSessionPreference, 
  dataCta,
  verificationMode 
}: ContactEntryFormProps) {
  // Use provided mode or get from env (client-side)
  const mode = verificationMode || getVerificationModeClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);
  
  // Determine default contact method - must be consistent between server and client
  // to avoid hydration mismatch. We can't use device detection on server, so we
  // default to email and let user switch if needed.
  const getInitialContactMethod = (): ContactMethod => {
    if (mode === 'email') return 'email';
    if (mode === 'sms') return 'phone';
    // For 'choice' mode, always start with email to avoid hydration mismatch
    // User can switch after mount
    return 'email';
  };

  const [contactMethod, setContactMethod] = useState<ContactMethod>(getInitialContactMethod());
  const [phone, setPhone] = useState(''); // Controlled; dial code shown via forceDialCode

  // After mount, offer to switch based on saved preference or device (choice mode only)
  useEffect(() => {
    setMounted(true);
    
    if (mode !== 'choice') return; // Only auto-switch in choice mode
    
    // Check saved preference first
    const saved = getSavedContactMethod();
    if (saved && saved !== contactMethod) {
      setContactMethod(saved);
      return;
    }
    
    // On mobile, suggest phone (but don't force it to avoid disruption)
    // User sees the toggle and can click if they want
  }, [mode, contactMethod]);

  const handleContactMethodSwitch = useCallback(() => {
    const newMethod: ContactMethod = contactMethod === 'email' ? 'phone' : 'email';
    setContactMethod(newMethod);
    saveContactMethod(newMethod);
    setErrors({});
    setMessage(null);
  }, [contactMethod]);

  const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setMessage(null);
    setErrors({});

    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = contactMethod === 'email' ? String(data.get('email') || '').trim().toLowerCase() : '';
    const nextErrors: Record<string, string> = {};
    if (!name) nextErrors.name = 'Bitte gib deinen Namen an.';

    let phoneValue = '';
    if (contactMethod === 'email') {
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        nextErrors.email = 'Bitte gib eine gültige E‑Mail-Adresse ein.';
      }
    } else {
      // Validate and normalize phone
      const validation = validatePhone(phone, form);
      if (!validation.isValid || !validation.normalized) {
        nextErrors.phone = validation.error || 'Bitte gib eine gültige Handynummer ein.';
      } else {
        phoneValue = validation.normalized;
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      // Persist to wizard localStorage for seamless handoff to /fragebogen
      try {
        const LS_KEY = 'kh_wizard_data';
        const LS_STEP = 'kh_wizard_step';
        const existing = typeof window !== 'undefined' ? window.localStorage.getItem(LS_KEY) : null;
        const parsed = existing ? JSON.parse(existing) : {};
        const merged = {
          ...(parsed && typeof parsed === 'object' ? parsed : {}),
          name,
          ...(contactMethod === 'email' ? { email } : { phone_number: phoneValue }),
          contact_method: contactMethod,
          consent_share_with_therapists: true,
          ...(defaultSessionPreference ? { session_preference: defaultSessionPreference } : {}),
        } as Record<string, unknown>;
        window.localStorage.setItem(LS_KEY, JSON.stringify(merged));
        // Start at step 1 (Therapieerfahrung) for consistent funnel tracking
        // Contact info is pre-filled from localStorage, wizard will auto-advance
        window.localStorage.removeItem(LS_STEP); // Clear any stale step override
      } catch {}

      // Navigate to the Fragebogen, preserving variant (?v=) if present
      // Test 4: Use flow randomization (concierge/self-service) when no variant specified
      const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
      const urlVariantRaw = (url?.searchParams.get('variant') || url?.searchParams.get('v') || '').toLowerCase();
      const urlVariant = urlVariantRaw === 'concierge' || urlVariantRaw === 'self-service' ? urlVariantRaw : null;
      const v = getFlowVariant(urlVariant);
      const next = `/fragebogen?v=${encodeURIComponent(v)}`;
      try { track('Lead Started'); } catch {}
      if (typeof window !== 'undefined') window.location.assign(next);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Fehlgeschlagen. Bitte später erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, defaultSessionPreference, contactMethod]);

  const showSwitchLink = mode === 'choice';
  const canUseEmail = mode === 'email' || mode === 'choice';
  const canUsePhone = mode === 'sms' || mode === 'choice';

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4 max-w-xl" data-cta={dataCta}>
      {/* Name field (always shown) */}
      <div className="space-y-2">
        <Label htmlFor="name">Wie dürfen wir dich ansprechen?</Label>
        <Input 
          id="name" 
          name="name" 
          placeholder="Vorname oder Spitzname" 
          autoComplete="given-name"
          aria-invalid={Boolean(errors.name)} 
          className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : undefined} 
        />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      {/* Contact field - email or phone based on mode */}
      <div className="space-y-2">
        {contactMethod === 'email' && canUseEmail ? (
          <>
            <Label htmlFor="email">E‑Mail-Adresse</Label>
            <Input 
              id="email" 
              name="email" 
              type="email" 
              autoComplete="email"
              inputMode="email"
              placeholder="dein.name@example.com" 
              aria-invalid={Boolean(errors.email)} 
              className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : undefined} 
            />
            {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
          </>
        ) : contactMethod === 'phone' && canUsePhone ? (
          <>
            <Label htmlFor="phone">Handynummer</Label>
            <VerifiedPhoneInput
              value={phone}
              onChange={setPhone}
              error={errors.phone}
              helpText="Du bekommst einen SMS-Code zur Bestätigung"
            />
          </>
        ) : null}
      </div>

      {/* Switch contact method link (choice mode only; gated by mount to avoid hydration mismatch) */}
      {showSwitchLink && mounted && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleContactMethodSwitch}
            className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
          >
            {contactMethod === 'phone' && canUseEmail ? 'Stattdessen Email verwenden' : 'Stattdessen Handynummer verwenden'}
          </button>
        </div>
      )}

      {message && <p className="text-sm text-red-600">{message}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Senden…' : 'Passende Therapeut:innen finden'}
        </Button>
      </div>

      <ConsentSection actor="patient" />

      <p className="mt-1 text-xs text-gray-600">
        100% kostenlos & unverbindlich. Deine Daten werden ausschließlich zur Erstellung der Empfehlungen verwendet.
      </p>
    </form>
  );
}

// Export alias for backward compatibility
export { ContactEntryForm as EmailEntryForm };
