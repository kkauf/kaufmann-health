/**
 * Shared verification hook for email/SMS verification flows.
 * Used by SignupWizard and ContactModal to deduplicate verification logic.
 * 
 * @module useVerification
 */

import { useState, useCallback, useRef } from 'react';
import { validatePhone } from './phone';
import { fireLeadVerifiedWithEnhancement } from '@/lib/gtag';

// ============================================================================
// Types
// ============================================================================

export type ContactMethod = 'email' | 'phone';

export type VerificationStep = 
  | 'input'      // Collecting name + contact info
  | 'code'       // Entering SMS verification code
  | 'link'       // Waiting for email magic link
  | 'verified'   // Successfully verified
  | 'error';     // Error state

export interface VerificationState {
  step: VerificationStep;
  contactMethod: ContactMethod;
  name: string;
  email: string;
  phone: string;
  code: string;
  loading: boolean;
  error: string | null;
  verified: boolean;
  patientId: string | null;
}

export interface SendCodeOptions {
  /** Name of the user (required for registration) */
  name: string;
  /** Contact value (email or normalized phone) */
  contact: string;
  /** Contact method type */
  contactType: ContactMethod;
  /** Optional redirect URL for email magic link */
  redirect?: string;
  /** Optional form session ID for tracking */
  formSessionId?: string;
  /** Optional lead ID for existing leads */
  leadId?: string;
  /** Optional draft contact data for directory flow */
  draftContact?: {
    therapist_id: string;
    contact_type: 'booking' | 'consultation';
    patient_reason?: string;
    patient_message?: string;
    session_format?: 'online' | 'in_person';
  };
  /** Optional draft booking data */
  draftBooking?: {
    therapist_id: string;
    date_iso?: string;
    time_label?: string;
    format?: 'online' | 'in_person';
    // Cal.com booking fields for auto-redirect after email confirmation
    cal_slot_utc?: string;
    cal_username?: string;
    cal_booking_kind?: 'intro' | 'full_session';
  };
  /** Optional campaign attribution headers */
  campaignSource?: string;
  campaignVariant?: string;
  gclid?: string;
}

export interface VerifyCodeOptions {
  /** Contact value (email or normalized phone) */
  contact: string;
  /** Contact method type */
  contactType: ContactMethod;
  /** Verification code entered by user */
  code: string;
}

export interface SendCodeResult {
  success: boolean;
  error?: string;
  /** True if email verification uses magic link instead of code */
  useMagicLink?: boolean;
  /** True if API suggests fallback to email */
  fallbackToEmail?: boolean;
}

export interface VerifyCodeResult {
  success: boolean;
  error?: string;
  patientId?: string;
}

export interface UseVerificationOptions {
  /** Callback when verification succeeds */
  onVerified?: (patientId?: string) => void;
  /** Callback for analytics tracking */
  onTrackEvent?: (event: string, props?: Record<string, unknown>) => void;
  /** Initial contact method */
  initialContactMethod?: ContactMethod;
}

export interface UseVerificationReturn {
  // State
  state: VerificationState;
  
  // Setters
  setName: (name: string) => void;
  setEmail: (email: string) => void;
  setPhone: (phone: string) => void;
  setCode: (code: string) => void;
  setContactMethod: (method: ContactMethod) => void;
  setError: (error: string | null) => void;
  
  // Actions
  sendCode: (options: Omit<SendCodeOptions, 'contact' | 'contactType'>) => Promise<SendCodeResult>;
  verifyCode: () => Promise<VerifyCodeResult>;
  resendCode: (options?: Omit<SendCodeOptions, 'contact' | 'contactType' | 'name'>) => Promise<SendCodeResult>;
  reset: () => void;
  
  // Validation helpers
  validateInputs: () => { valid: boolean; error?: string };
  getContact: () => string | null;
  isPhoneValid: () => boolean;
  isEmailValid: () => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useVerification(options: UseVerificationOptions = {}): UseVerificationReturn {
  const { onVerified, onTrackEvent, initialContactMethod = 'phone' } = options;
  
  // State
  const [step, setStep] = useState<VerificationStep>('input');
  const [contactMethod, setContactMethod] = useState<ContactMethod>(initialContactMethod);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  
  // Refs for tracking
  const sendAttempts = useRef(0);
  
  // Analytics helper
  const trackEvent = useCallback((event: string, props?: Record<string, unknown>) => {
    try {
      onTrackEvent?.(event, props);
    } catch {
      // Ignore tracking errors
    }
  }, [onTrackEvent]);
  
  // Validation helpers
  const isEmailValid = useCallback(() => {
    return EMAIL_REGEX.test(email.trim());
  }, [email]);
  
  const isPhoneValid = useCallback(() => {
    const validation = validatePhone(phone);
    return validation.isValid;
  }, [phone]);
  
  const getContact = useCallback((): string | null => {
    if (contactMethod === 'email') {
      return isEmailValid() ? email.trim() : null;
    } else {
      const validation = validatePhone(phone);
      return validation.isValid ? validation.normalized || null : null;
    }
  }, [contactMethod, email, phone, isEmailValid]);
  
  const validateInputs = useCallback((): { valid: boolean; error?: string } => {
    if (!name.trim()) {
      return { valid: false, error: 'Bitte gib deinen Namen an.' };
    }
    
    if (contactMethod === 'email') {
      if (!isEmailValid()) {
        return { valid: false, error: 'Bitte gib eine gültige E-Mail-Adresse ein.' };
      }
    } else {
      const validation = validatePhone(phone);
      if (!validation.isValid) {
        return { valid: false, error: validation.error || 'Bitte gib eine gültige Handynummer ein.' };
      }
    }
    
    return { valid: true };
  }, [name, contactMethod, phone, isEmailValid]);
  
  // Send verification code
  const sendCode = useCallback(async (
    opts: Omit<SendCodeOptions, 'contact' | 'contactType'>
  ): Promise<SendCodeResult> => {
    const validation = validateInputs();
    if (!validation.valid) {
      setError(validation.error || 'Ungültige Eingabe');
      return { success: false, error: validation.error };
    }
    
    const contact = getContact();
    if (!contact) {
      const err = 'Kontaktinformation fehlt.';
      setError(err);
      return { success: false, error: err };
    }
    
    setError(null);
    setLoading(true);
    sendAttempts.current += 1;
    
    trackEvent('verification_send_started', { contact_method: contactMethod, attempt: sendAttempts.current });
    
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (opts.campaignSource) headers['X-Campaign-Source-Override'] = opts.campaignSource;
      if (opts.campaignVariant) headers['X-Campaign-Variant-Override'] = opts.campaignVariant;
      if (opts.gclid) headers['X-Gclid'] = opts.gclid;
      
      const body: Record<string, unknown> = {
        contact,
        contact_type: contactMethod,
        name: opts.name || name.trim(),
      };
      
      if (opts.redirect) body.redirect = opts.redirect;
      if (opts.formSessionId) body.form_session_id = opts.formSessionId;
      if (opts.leadId) body.lead_id = opts.leadId;
      if (opts.draftContact) body.draft_contact = opts.draftContact;
      if (opts.draftBooking) body.draft_booking = opts.draftBooking;
      
      const res = await fetch('/api/public/verification/send-code', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        const err = data.error || 'Fehler beim Senden des Codes';
        setError(err);
        trackEvent('verification_send_failed', { contact_method: contactMethod, error: err });
        return { success: false, error: err };
      }
      
      // Check for fallback suggestion
      if (data.data?.fallback === 'email') {
        trackEvent('verification_fallback_suggested', { from: 'phone', to: 'email' });
        return { success: false, fallbackToEmail: true };
      }
      
      // Update step to code entry (both email and SMS now use 6-digit codes)
      setStep('code');
      
      trackEvent('verification_code_sent', { contact_method: contactMethod });
      
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten';
      setError(message);
      trackEvent('verification_send_error', { contact_method: contactMethod, error: message });
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [contactMethod, name, getContact, validateInputs, trackEvent]);
  
  // Resend verification code
  const resendCode = useCallback(async (
    opts?: Omit<SendCodeOptions, 'contact' | 'contactType' | 'name'>
  ): Promise<SendCodeResult> => {
    return sendCode({ name: name.trim(), ...opts });
  }, [sendCode, name]);
  
  // Verify entered code
  const verifyCode = useCallback(async (): Promise<VerifyCodeResult> => {
    const contact = getContact();
    if (!contact) {
      const err = 'Kontaktinformation fehlt.';
      setError(err);
      return { success: false, error: err };
    }
    
    if (!code.trim()) {
      const err = 'Bitte gib den Bestätigungscode ein.';
      setError(err);
      return { success: false, error: err };
    }
    
    setError(null);
    setLoading(true);
    
    trackEvent('verification_verify_started', { contact_method: contactMethod });
    
    try {
      const res = await fetch('/api/public/verification/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact,
          contact_type: contactMethod,
          code: code.trim(),
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.data?.verified) {
        const err = 'Ungültiger Code';
        setError(err);
        trackEvent('verification_verify_failed', { contact_method: contactMethod });
        return { success: false, error: err };
      }
      
      // Successfully verified
      setVerified(true);
      setStep('verified');
      
      // Try to get patient ID from session
      let pid: string | undefined;
      try {
        const sessionRes = await fetch('/api/public/session');
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          pid = sessionData?.data?.patient_id;
          if (pid) setPatientId(pid);
        }
      } catch {
        // Ignore session fetch errors
      }
      
      // Fire Google Ads conversion with enhancement (€12) - CRITICAL for attribution
      // This fires the base gtag conversion FIRST, then triggers server-side enhancement
      // The server-side enhancement is now triggered by the client (not the API route)
      // to ensure proper sequencing: base conversion must exist before enhancement
      try {
        void fireLeadVerifiedWithEnhancement(pid, contactMethod === 'phone' ? 'sms' : 'email');
      } catch {
        // Ignore conversion errors
      }
      
      trackEvent('verification_completed', { contact_method: contactMethod, has_patient_id: !!pid });
      onVerified?.(pid);
      
      return { success: true, patientId: pid };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei der Überprüfung';
      setError(message);
      trackEvent('verification_verify_error', { contact_method: contactMethod, error: message });
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [contactMethod, code, getContact, trackEvent, onVerified]);
  
  // Reset state
  const reset = useCallback(() => {
    setStep('input');
    setName('');
    setEmail('');
    setPhone('');
    setCode('');
    setError(null);
    setVerified(false);
    setPatientId(null);
    setLoading(false);
    sendAttempts.current = 0;
  }, []);
  
  // Build state object
  const state: VerificationState = {
    step,
    contactMethod,
    name,
    email,
    phone,
    code,
    loading,
    error,
    verified,
    patientId,
  };
  
  return {
    state,
    setName,
    setEmail,
    setPhone,
    setCode,
    setContactMethod,
    setError,
    sendCode,
    verifyCode,
    resendCode,
    reset,
    validateInputs,
    getContact,
    isPhoneValid,
    isEmailValid,
  };
}

export default useVerification;
