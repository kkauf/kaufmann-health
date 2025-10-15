"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import ProgressBar from './ProgressBar';
import Screen1, { type Screen1Values } from './screens/Screen1';
import Screen1_5, { type Screen1_5Values } from './screens/Screen1_5';
import Screen3, { type Screen3Values } from './screens/Screen3';
import Screen4, { type Screen4Values } from './screens/Screen4';
import NewScreen1_TherapyExperience, { type NewScreen1Values } from './screens/NewScreen1_TherapyExperience';
import NewScreen2_Timeline, { type NewScreen2Values } from './screens/NewScreen2_Timeline';
import NewScreen3_WhatBringsYou, { type NewScreen3Values } from './screens/NewScreen3_WhatBringsYou';
import NewScreen4_Budget, { type NewScreen4Values } from './screens/NewScreen4_Budget';
import NewScreen5_Modality, { type NewScreen5Values } from './screens/NewScreen5_Modality';
import { Button } from '@/components/ui/button';
import { leadSubmissionSchema } from '@/lib/contracts';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { normalizePhoneNumber } from '@/lib/verification/phone';

const LS_KEYS = {
  data: 'kh_wizard_data',
  step: 'kh_wizard_step',
  sessionId: 'kh_form_session_id',
} as const;

export type WizardData = Omit<Screen1Values, 'email'> & Screen1_5Values & {
  email?: string; // Make email optional since we might use phone instead
  // New Screen 1: Therapy Experience
  therapy_experience?: NewScreen1Values['therapy_experience'];
  therapy_type?: NewScreen1Values['therapy_type'];
  // New Screen 2: Timeline
  start_timing?: NewScreen2Values['start_timing'];
  // New Screen 3: What Brings You (optional)
  additional_info?: NewScreen3Values['additional_info'];
  // New Screen 4: Budget
  budget?: NewScreen4Values['budget'];
  // Screen 5: Modality (updated with modality_matters)
  modality_matters?: boolean;
  methods?: Screen4Values['methods'];
  // Screen 6: Location
  city?: string;
  online_ok?: boolean;
  session_preference?: 'online' | 'in_person' | 'either';
  privacy_preference?: Screen3Values['privacy_preference'];
  // Screen 7: Preferences (gender, language, time_slots)
  gender?: Screen4Values['gender'];
  language?: Screen4Values['language'];
  language_other?: string;
  time_slots?: Screen4Values['time_slots'];
  // Screen 8: Contact Info (moved from Screen1)
  name: string;
};

// Progress: 9 main steps (or 10 with SMS verification)
// Step 1: Therapy Experience (0%), 2: Timeline (11%), 3: What Brings You (22%), 4: Budget (33%),
// 5: Modality (44%), 6: Location (56%), 7: Preferences (67%), 8: Contact (78%),
// 8.5: SMS (89%), 9: Confirmation (100%)
const PROGRESS = [0, 11, 22, 33, 44, 56, 67, 78, 89, 100]; // steps 1-9 (step 8.5 uses index 8)

export default function SignupWizard() {
  const searchParams = useSearchParams();
  const [step, setStep] = React.useState<number>(1);
  const [data, setData] = React.useState<WizardData>({ name: '' });
  const [initialized, setInitialized] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitSlow, setSubmitSlow] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const lastSyncedRef = React.useRef<string>('');
  const sessionIdRef = React.useRef<string | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const loadedForSession = React.useRef<string | null>(null);
  const screenStartRef = React.useRef<number>(Date.now());
  const prevStepRef = React.useRef<number>(1);
  const [navLock, setNavLock] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  // Track baseline viewport height to detect keyboard open on mobile (iOS Safari)
  const baseVVHeightRef = React.useRef<number | null>(null);
  // Inline resend confirmation UX state (step 9)
  const [resendEmail, setResendEmail] = React.useState<string>('');
  const [resendSubmitting, setResendSubmitting] = React.useState(false);
  const [resendMessage, setResendMessage] = React.useState<string>('');
  const [showResendForm, setShowResendForm] = React.useState(false);

  // Step 9 (phone users): optional email add state
  const [addEmail, setAddEmail] = React.useState('');
  const [addEmailSubmitting, setAddEmailSubmitting] = React.useState(false);
  const [addEmailMessage, setAddEmailMessage] = React.useState('');
  // Suppress auto-advance on screens reached via Back until user interacts
  const [suppressAutoStep, setSuppressAutoStep] = React.useState<number | null>(null);

  // Analytics helper
  const trackEvent = React.useCallback(async (type: string, properties?: Record<string, unknown>) => {
    try {
      const payload = {
        type,
        session_id: sessionIdRef.current || undefined,
        properties: properties || {},
      };
      navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(payload)], { type: 'application/json' })) ||
        (await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }));
    } catch {}
  }, []);

  // Client-side Google Ads conversion (deduped). Mirrors legacy client conversion behavior.
  function fireGoogleAdsClientConversion(leadId?: string) {
    try {
      const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
      const label = process.env.NEXT_PUBLIC_GAD_CONV_CLIENT;
      if (!adsId || !label) return; // not configured
      if (typeof window === 'undefined') return;

      const dedupeKey = leadId ? `ga_conv_client_registration${leadId}` : 'ga_conv_client_registration';
      try {
        if (window.sessionStorage.getItem(dedupeKey) === '1') return;
        if (window.localStorage.getItem(dedupeKey) === '1') return;
      } catch {}

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).gtag as ((...args: any[]) => void) | undefined;
      const sendTo = `${adsId}/${label}`;
      const payload: Record<string, unknown> = { send_to: sendTo, value: 10, currency: 'EUR' };
      if (leadId) payload.transaction_id = leadId;

      if (typeof g === 'function') {
        g('event', 'conversion', payload);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        w.dataLayer = w.dataLayer || [];
        w.dataLayer.push(['event', 'conversion', payload]);
      }

      try {
        window.sessionStorage.setItem(dedupeKey, '1');
        window.localStorage.setItem(dedupeKey, '1');
      } catch {}
    } catch {
      // best-effort only
    }
  }

  function missingRequiredForStep(s: number, d: WizardData): string[] {
    switch (s) {
      case 1: {
        // Step 1: Therapy Experience (required)
        const miss: string[] = [];
        if (!d.therapy_experience) miss.push('therapy_experience');
        return miss;
      }
      case 2: {
        // Step 2: Timeline (required)
        const miss: string[] = [];
        if (!d.start_timing) miss.push('start_timing');
        return miss;
      }
      case 3: {
        // Step 3: What Brings You (optional)
        return [];
      }
      case 4: {
        // Step 4: Budget (optional)
        return [];
      }
      case 5: {
        // Step 5: Modality (optional)
        return [];
      }
      case 6: {
        // Step 6: Location (session_preference required, city required if in_person)
        const miss: string[] = [];
        const hasCity = !!(d.city && d.city.trim());
        const pref = d.session_preference;
        if (!pref) miss.push('session_preference');
        if (pref === 'in_person' && !hasCity) miss.push('city');
        return miss;
      }
      case 7: {
        // Step 7: Preferences (language required)
        const miss: string[] = [];
        if (!d.language) miss.push('language');
        if (d.language === 'Andere' && !(d.language_other && d.language_other.trim())) miss.push('language_other');
        return miss;
      }
      case 8: {
        // Step 8: Contact Info (name, email/phone required)
        const miss: string[] = [];
        if (!d.name || !d.name.trim()) miss.push('name');
        // Check contact info based on method
        if (d.contact_method === 'email') {
          if (!d.email) miss.push('email');
        } else if (d.contact_method === 'phone') {
          if (!d.phone_number) miss.push('phone_number');
          if (!d.phone_verified) miss.push('phone_verified');
        }
        return miss;
      }
      case 9: {
        // Step 9: Confirmation (no required fields)
        return [];
      }
      default:
        return [];
    }
  }

  // Load from localStorage on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEYS.data);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setData((prev) => ({
            ...prev,
            ...(parsed as Partial<WizardData>),
          }));
        }
      }
      const savedStep = Number(localStorage.getItem(LS_KEYS.step) || '1');
      if (savedStep >= 1 && savedStep <= 9) setStep(savedStep);

      // Check for existing verified session (kh_client cookie from EARTH-204)
      // If user is already verified, prefill contact info (no need to skip steps)
      fetch('/api/public/session')
        .then(res => res.ok ? res.json() : null)
        .then(json => {
          const session = json?.data;
          if (session?.verified) {
            const updates: Partial<WizardData> = {};
            if (session.name) updates.name = session.name;
            if (session.contact_method === 'email' && session.contact_value) {
              updates.email = session.contact_value;
              updates.contact_method = 'email';
            } else if (session.contact_method === 'phone' && session.contact_value) {
              updates.phone_number = session.contact_value;
              updates.contact_method = 'phone';
              updates.phone_verified = true;
            }
            if (Object.keys(updates).length > 0) {
              setData(prev => ({ ...prev, ...updates }));
            }
          }
        })
        .catch(() => {
          // Ignore session check errors
        });
      
      // Handle ?experience= param from mid-page conversion (EARTH-209)
      const experienceParam = searchParams?.get('experience');
      if (experienceParam) {
        let therapy_experience: 'has_experience' | 'first_time' | 'unsure' | undefined;
        switch (experienceParam) {
          case 'yes':
            therapy_experience = 'has_experience';
            break;
          case 'no':
            therapy_experience = 'first_time';
            break;
          case 'unsure':
            therapy_experience = 'unsure';
            break;
        }
        if (therapy_experience) {
          setData((prev) => ({ ...prev, therapy_experience }));
          void trackEvent('midpage_prefill', { experience: experienceParam });
        }
      }
      
      // Prefer fs from URL if present, otherwise fall back to localStorage
      const fsFromUrl = searchParams?.get('fs');
      const fsid = fsFromUrl || localStorage.getItem(LS_KEYS.sessionId);
      if (fsid) {
        sessionIdRef.current = fsid;
        try {
          localStorage.setItem(LS_KEYS.sessionId, fsid);
        } catch {}
      }
      setSessionId(sessionIdRef.current);
      // Online/offline listeners
      setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      // Capture baseline visual viewport height for keyboard detection
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vv = (window as any).visualViewport as { height: number } | undefined;
        baseVVHeightRef.current = vv?.height || null;
      } catch {}
      // Mark initialization complete only after attempting to load saved state
      setInitialized(true);
      // Cleanup
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } catch {}
    // Scroll to top initially
    window.scrollTo({ top: 0 });
  }, [searchParams]);

  // Capture leadId from URL when coming back via email link; prime resend email from data/localStorage
  React.useEffect(() => {
    try {
      const c = searchParams?.get('confirm');
      const idFromUrl = searchParams?.get('id');
      if (idFromUrl) {
        localStorage.setItem('leadId', idFromUrl);
      }
      // Prefer current form email, otherwise prior stored email for resend UX
      const fromForm = (data.email || '').trim();
      if (fromForm) {
        setResendEmail(fromForm);
      } else {
        const fromLs = localStorage.getItem('leadEmail') || '';
        if (fromLs) setResendEmail(fromLs);
      }
      // If arriving confirmed, we can clear any previous resend message
      if (c === '1' || c === 'success') setResendMessage('');

      // Force step 9 when confirmed via URL (cross-device flow)
      if (c === '1' || c === 'success') {
        setStep(9);
        try { localStorage.setItem(LS_KEYS.step, '9'); } catch {}
        // Analytics: confirmation success rendered
        void trackEvent('confirm_success_rendered', { contact_method: 'email' });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Track success render for phone users reaching step 9 (no email confirmation)
  React.useEffect(() => {
    if (step === 9 && data.contact_method === 'phone') {
      void trackEvent('confirm_success_rendered', { contact_method: 'phone' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data.contact_method]);

  // If we have a session id (possibly from URL), try to load remote state once
  React.useEffect(() => {
    if (!sessionId) return;
    if (loadedForSession.current === sessionId) return;
    loadedForSession.current = sessionId;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/form-sessions/${encodeURIComponent(sessionId)}`);
        const j = await res.json();
        if (!res.ok || !j?.data || cancelled) return;
        const remote = j.data.data as unknown;
        if (remote && typeof remote === 'object') {
          const remoteObj = remote as Partial<WizardData> & { step?: number };
          const remoteStep = typeof remoteObj.step === 'number' ? remoteObj.step : undefined;
          // Adopt remote if it appears further along than local
          if (remoteStep && remoteStep > step) {
            const next = { ...data, ...remoteObj } as WizardData;
            setData(next);
            const clamped = Math.max(1, Math.min(6, remoteStep));
            setStep(clamped);
            try {
              localStorage.setItem(LS_KEYS.data, JSON.stringify(next));
              localStorage.setItem(LS_KEYS.step, String(clamped));
            } catch {}
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, step, data]);

  // Persist to localStorage on every change
  const saveLocal = React.useCallback((next: Partial<WizardData>) => {
    setData((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(LS_KEYS.data, JSON.stringify(merged));
      } catch {}
      // Track changed fields (PII-safe: only field names, no values)
      try {
        if (process.env.NEXT_PUBLIC_ANALYTICS_VERBOSE === 'true') {
          const keys = Object.keys(next) as Array<keyof WizardData>;
          for (const k of keys) {
            void trackEvent('field_change', { field: String(k), step });
          }
        }
      } catch {}
      return merged;
    });
  }, []);

  const goToStep = React.useCallback((n: number) => {
    setStep((current) => {
      // SECURITY: Block navigation to step 8.5 (SMS verification) unless requirements are met
      if (n === 8.5) {
        if (data.contact_method !== 'phone' || !data.phone_number) {
          console.warn('[SignupWizard] Blocked navigation to step 8.5: invalid contact method or missing phone');
          void trackEvent('navigation_blocked', { target_step: 8.5, reason: 'missing_phone_setup' });
          return current; // Stay on current step
        }
      }
      
      // Track completion for current screen
      const now = Date.now();
      const elapsed = now - (screenStartRef.current || now);
      const miss = missingRequiredForStep(current, data);
      void trackEvent('screen_completed', { step: current, duration_ms: elapsed, missing_required: miss });
      if (miss.length > 0) {
        void trackEvent('field_abandonment', { step: current, fields: miss });
      }
      // Update refs and navigate
      const v = Math.max(1, Math.min(9, n));
      prevStepRef.current = current;
      screenStartRef.current = Date.now();
      // If navigating backward, suppress auto-advance on the target step until user interacts
      if (n < current) setSuppressAutoStep(n);
      else setSuppressAutoStep(null);
      try {
        localStorage.setItem(LS_KEYS.step, String(v));
      } catch {}
      // Scroll to top on navigation (avoid smooth scroll when virtual keyboard is open)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vv = (window as any).visualViewport as { height: number } | undefined;
        const base = baseVVHeightRef.current || 0;
        const isKbOpen = !!(vv && base && vv.height < base * 0.9);
        if (!isKbOpen) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          // Minimize jank while keyboard is up
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      } catch {
        window.scrollTo({ top: 0 });
      }
      return v;
    });
  }, [data, trackEvent]);

  // Safe navigation to prevent double-clicks on Next/Back
  const safeGoToStep = React.useCallback(
    (n: number) => {
      if (navLock) return;
      setNavLock(true);
      try {
        goToStep(n);
      } finally {
        // Release after short delay (matches UI transitions)
        setTimeout(() => setNavLock(false), 250);
      }
    },
    [goToStep, navLock],
  );

  // Fire screen_viewed on step changes
  React.useEffect(() => {
    void trackEvent('screen_viewed', { step });
  }, [step, trackEvent]);

  // (moved below after handleSendSmsCode definition)

  // Backend autosave every 30s when data changes
  React.useEffect(() => {
    const interval = setInterval(async () => {
      const json = JSON.stringify({ ...data, step });
      if (json === lastSyncedRef.current) return;
      lastSyncedRef.current = json;
      setSaving(true);
      try {
        const payload = {
          data: {
            ...data,
            step,
          },
          email: data.email || undefined,
        };
        if (!sessionIdRef.current) {
          const res = await fetch('/api/public/form-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const j = await res.json();
          if (res.ok && j?.data?.id) {
            sessionIdRef.current = j.data.id as string;
            try {
              localStorage.setItem(LS_KEYS.sessionId, sessionIdRef.current);
            } catch {}
          }
        } else {
          await fetch(`/api/public/form-sessions/${encodeURIComponent(sessionIdRef.current)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
      } catch {
        // Offline or network error: ignore, local copy persists
      } finally {
        setSaving(false);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [data, step]);

  // SMS code sending and verification handlers
  const handleSendSmsCode = React.useCallback(async (): Promise<boolean> => {
    if (!data.phone_number) return false;
    try {
      const res = await fetch('/api/public/verification/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: data.phone_number,
          contact_type: 'phone',
          form_session_id: sessionId || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('Failed to send SMS');
      // If API indicates fallback to email, keep user on step 1 to choose email manually
      if (j?.data?.fallback === 'email') return false;
      void trackEvent('verification_code_sent', { contact_type: 'phone' });
      return true;
    } catch (err) {
      console.error('Failed to send SMS code:', err);
      throw err;
    }
  }, [data.phone_number, sessionId, trackEvent, saveLocal]);

  // If we arrive directly on step 1.5 with a phone number, auto-send the SMS code once
  const autoSentRef = React.useRef(false);
  React.useEffect(() => {
    if (autoSentRef.current) return;
    if (step !== 1.5) return;
    if (data.contact_method !== 'phone') return;
    if (!data.phone_number) return;
    if (data.phone_verified) return;
    autoSentRef.current = true;
    void handleSendSmsCode().catch(() => {
      // ignore here; user can retry or switch to email
      autoSentRef.current = false; // allow manual retry
    });
  }, [step, data.contact_method, data.phone_number, data.phone_verified, handleSendSmsCode]);

  const handleVerifySmsCode = React.useCallback(async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!data.phone_number) return { success: false, error: 'Keine Telefonnummer' };
    
    try {
      const res = await fetch('/api/public/verification/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: data.phone_number,
          contact_type: 'phone',
          code,
        }),
      });
      
      const result = await res.json();
      
      if (result.data?.verified) {
        saveLocal({ phone_verified: true });
        void trackEvent('verification_code_verified', { contact_type: 'phone' });
        // Don't navigate here - caller will handle submit after verification
        return { success: true };
      }
      
      return { success: false, error: 'Ungültiger Code' };
    } catch (err) {
      console.error('Failed to verify SMS code:', err);
      return { success: false, error: 'Fehler bei der Überprüfung' };
    }
  }, [data.phone_number, saveLocal, trackEvent]);

  // Simple screen renderers
  function renderScreen() {
    switch (step) {
      case 1:
        // Step 1: Therapy Experience
        return (
          <NewScreen1_TherapyExperience
            values={{
              therapy_experience: data.therapy_experience,
              therapy_type: data.therapy_type,
            }}
            onChange={saveLocal}
            onNext={() => safeGoToStep(2)}
            suppressAutoAdvance={suppressAutoStep === 1}
            disabled={navLock || submitting}
          />
        );
      case 2:
        // Step 2: Timeline
        return (
          <NewScreen2_Timeline
            values={{ start_timing: data.start_timing }}
            onChange={saveLocal}
            onBack={() => safeGoToStep(1)}
            onNext={() => safeGoToStep(3)}
            suppressAutoAdvance={suppressAutoStep === 2}
            disabled={navLock || submitting}
          />
        );
      case 3:
        // Step 3: What Brings You (optional)
        return (
          <NewScreen3_WhatBringsYou
            values={{ additional_info: data.additional_info }}
            onChange={saveLocal}
            onBack={() => safeGoToStep(2)}
            onNext={() => safeGoToStep(4)}
            disabled={navLock || submitting}
          />
        );
      case 4:
        // Step 4: Budget
        return (
          <NewScreen4_Budget
            values={{ budget: data.budget }}
            onChange={saveLocal}
            onBack={() => safeGoToStep(3)}
            onNext={() => safeGoToStep(5)}
            suppressAutoAdvance={suppressAutoStep === 4}
            disabled={navLock || submitting}
          />
        );
      case 5:
        // Step 5: Modality Preferences (with progressive disclosure)
        return (
          <NewScreen5_Modality
            values={{
              modality_matters: data.modality_matters,
              methods: data.methods,
            }}
            onChange={saveLocal}
            onBack={() => safeGoToStep(4)}
            onNext={() => safeGoToStep(6)}
            suppressAutoAdvance={suppressAutoStep === 5}
            disabled={navLock || submitting}
          />
        );
      case 6:
        // Step 6: Location (session preference + city only - budget handled in step 4)
        return (
          <Screen3
            values={{
              city: data.city,
              online_ok: data.online_ok,
              session_preference: data.session_preference,
              privacy_preference: data.privacy_preference,
            }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => safeGoToStep(5)}
            onNext={() => safeGoToStep(7)}
            disabled={navLock || submitting}
          />
        );
      case 7:
        // Step 7: Preferences (gender, language, time_slots - modality is in step 5)
        return (
          <Screen4
            values={{
              gender: data.gender,
              language: data.language,
              language_other: data.language_other,
              time_slots: data.time_slots,
              methods: data.methods,
            }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => safeGoToStep(6)}
            onNext={() => safeGoToStep(8)}
            disabled={navLock || submitting}
          />
        );
      case 8:
        // Step 8: Contact Info (moved from Screen1, implicit consent on submit)
        return (
          <Screen1
            values={{
              name: data.name,
              email: data.email,
              phone_number: data.phone_number,
              contact_method: data.contact_method,
            }}
            initialized={initialized}
            onChange={saveLocal}
            onBack={() => safeGoToStep(7)}
            onNext={async () => {
              // If phone and already verified (from existing session), skip verification
              if (data.contact_method === 'phone' && data.phone_number) {
                if (data.phone_verified) {
                  // Already verified - submit directly
                  await handleSubmit();
                } else {
                  // Not verified - send SMS and go to verification step
                  try {
                    const sent = await handleSendSmsCode();
                    if (sent) safeGoToStep(8.5);
                    // else: stay on step 8 so user can switch to email or retry
                  } catch (err) {
                    console.error('Failed to send SMS:', err);
                    // Could show error to user here
                  }
                }
              } else {
                // Email: submit directly (consent implicit on button click)
                await handleSubmit();
              }
            }}
            disabled={navLock || submitting}
          />
        );
      case 8.5:
        // SMS verification screen (phone users only)
        // SECURITY: Never auto-advance forward from verification step
        if (data.contact_method !== 'phone' || !data.phone_number) {
          // Send user back to step 8 to properly set up phone verification
          safeGoToStep(8);
          return null;
        }
        return (
          <Screen1_5
            phoneNumber={data.phone_number}
            onVerify={async (code: string) => {
              const result = await handleVerifySmsCode(code);
              if (result.success) {
                // After SMS verification, submit the form
                await handleSubmit();
              }
              return result;
            }}
            onResend={async () => { await handleSendSmsCode(); }}
            onBack={() => safeGoToStep(8)}
            disabled={navLock || submitting}
          />
        );
      case 9:
        return (() => {
          const confirmParam = searchParams?.get('confirm');
          const isConfirmed = confirmParam === '1' || confirmParam === 'success';
          const isPhoneUser = data.contact_method === 'phone' && !!data.phone_number;
          if (isConfirmed) {
            return (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">✓ E‑Mail bestätigt – wir bereiten deine Empfehlungen vor</h2>
                <p>Unser Team von Kaufmann Health prüft persönlich deine Anfrage und sucht die besten Therapeut:innen für dich.</p>
                <p>Du bekommst deine Matches innerhalb von 24 Stunden.</p>
                <div className="rounded-md border p-3 bg-emerald-50 border-emerald-200">
                  <p className="text-sm">Was als Nächstes passiert: Wir gleichen deine Präferenzen ab und senden dir deine Auswahl mit einem 1‑Klick‑Bestätigungslink.</p>
                </div>
              </div>
            );
          }
          // Phone users: show success state (SMS verified) + optional email collection
          if (isPhoneUser) {
            async function handleAddEmail() {
              if (addEmailSubmitting) return;
              const email = (addEmail || '').trim();
              if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                setAddEmailMessage('Bitte eine gültige E‑Mail eingeben.');
                return;
              }
              setAddEmailSubmitting(true);
              setAddEmailMessage('');
              try {
                const leadId = (typeof window !== 'undefined' ? localStorage.getItem('leadId') : null) || '';
                const res = await fetch(`/api/public/leads/${encodeURIComponent(leadId)}/add-email`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, form_session_id: sessionIdRef.current || undefined }),
                });
                const j = await res.json().catch(() => ({}));
                if (res.status === 409 || j?.error === 'email_in_use') {
                  setAddEmailMessage('Diese E‑Mail wird bereits verwendet. Bitte eine andere Adresse verwenden.');
                } else if (!res.ok || j?.error) {
                  setAddEmailMessage('Speichern fehlgeschlagen. Bitte später erneut versuchen.');
                } else {
                  // Success → persist locally for future UX
                  saveLocal({ email });
                  try { localStorage.setItem('leadEmail', email); } catch {}
                  setAddEmailMessage('E‑Mail gespeichert. Danke!');
                  void trackEvent('optional_email_provided', { step: 9 });
                }
              } catch {
                setAddEmailMessage('Speichern fehlgeschlagen. Bitte später erneut versuchen.');
              } finally {
                setAddEmailSubmitting(false);
              }
            }

            return (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">✓ Geschafft! Deine Anfrage ist bei uns</h2>
                  <p className="text-base leading-relaxed text-gray-700">Du hast deine Handynummer bestätigt. Unser Team prüft persönlich deine Anfrage und sucht die besten Therapeut:innen für dich.</p>
                  <p className="text-base leading-relaxed text-gray-700">Du bekommst deine Matches innerhalb von 24 Stunden.</p>
                </div>

                {/* Feature Highlight Panel - Optional email add */}
                <div className="relative overflow-hidden rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-6 sm:p-8 shadow-lg shadow-indigo-100/30">
                  <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-base font-semibold text-gray-900">✉️ Optional: E‑Mail hinzufügen</p>
                      <p className="text-sm leading-relaxed text-gray-700">Therapeut:innen antworten oft per E‑Mail. Wenn du möchtest, kannst du eine E‑Mail-Adresse ergänzen.</p>
                      <p className="text-xs text-gray-600">Ohne E‑Mail kontaktieren dich Therapeut:innen per SMS oder Anruf.</p>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="email"
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        placeholder="deine@email.de"
                        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        aria-label="E‑Mail"
                      />
                      <Button
                        onClick={handleAddEmail}
                        disabled={addEmailSubmitting}
                        className="h-11 w-full text-base"
                      >
                        {addEmailSubmitting ? 'Speichere…' : 'E‑Mail speichern'}
                      </Button>
                      {addEmailMessage && (
                        <p className="text-sm text-center text-gray-700" aria-live="polite">{addEmailMessage}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          // Not confirmed yet → show prominent callout with progressive disclosure (email path)
          async function handleResend() {
            if (resendSubmitting) return;
            const email = (resendEmail || '').trim();
            if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
              setResendMessage('Bitte eine gültige E‑Mail eingeben.');
              return;
            }
            setResendSubmitting(true);
            setResendMessage('');
            try {
              await fetch('/api/public/leads/resend-confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  email,
                  form_session_id: sessionIdRef.current || undefined,
                }),
              });
              setResendMessage('E‑Mail versendet. Bitte Posteingang prüfen.');
            } catch {
              setResendMessage('Bitte später erneut versuchen.');
            } finally {
              setResendSubmitting(false);
            }
          }
          return (
            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">✓ Geschafft! Deine Anfrage ist bei uns</h2>
                <p className="text-base leading-relaxed text-gray-700">Unser Team von Kaufmann Health prüft persönlich deine Anfrage und sucht die besten Therapeut:innen für dich.</p>
                <p className="text-base leading-relaxed text-gray-700">Du bekommst deine Matches innerhalb von 24 Stunden.</p>
              </div>

              {/* Feature Highlight Panel - Email confirmation callout */}
              <div className="relative overflow-hidden rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-6 sm:p-8 shadow-lg shadow-indigo-100/30">
                <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
                <div className="space-y-3">
                  <p className="text-base font-semibold text-gray-900">📧 Wichtig: Bitte bestätige deine E‑Mail‑Adresse</p>
                  <p className="text-sm leading-relaxed text-gray-700">
                    Wir haben dir gerade eine Bestätigungs-E-Mail geschickt. Bitte prüfe deinen Posteingang und klicke auf den Link, damit wir dir deine Therapeuten-Empfehlungen zusenden können.
                  </p>
                  <p className="text-xs text-gray-600">Tipp: Falls du nichts findest, schau auch im Spam-Ordner nach.</p>
                </div>
              </div>

              {/* Progressive disclosure: resend form */}
              {!showResendForm ? (
                <div className="flex justify-center">
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setShowResendForm(true);
                      void trackEvent('resend_form_opened', { step: 9 });
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 transition-colors"
                  >
                    E-Mail nicht erhalten?
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-gray-200/60 bg-white/80 p-4 sm:p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-700">E-Mail erneut senden oder Adresse korrigieren:</p>
                  <div className="space-y-3">
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="deine@email.de"
                      className="h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      aria-label="E‑Mail"
                    />
                    <Button 
                      onClick={handleResend} 
                      disabled={resendSubmitting} 
                      className="h-11 w-full text-base"
                    >
                      {resendSubmitting ? 'Wird gesendet…' : 'Bestätigungs-E-Mail erneut senden'}
                    </Button>
                    {resendMessage && (
                      <p className="text-sm text-center text-gray-600" aria-live="polite">{resendMessage}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })();
      default:
        return null;
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSlow(false);
    const slowTimer = setTimeout(() => setSubmitSlow(true), 3000);
    try {

      // Track completion for last screen before submit (step 8 for email, 8.5 for SMS)
      {
        const now = Date.now();
        const elapsed = now - (screenStartRef.current || now);
        const currentStep = data.contact_method === 'phone' ? 8.5 : 8;
        const miss = missingRequiredForStep(currentStep, data);
        void trackEvent('screen_completed', { step: currentStep, duration_ms: elapsed, missing_required: miss });
      }
      // Ensure a form session exists and is up-to-date so the server can merge preferences
      // into people.metadata during /form-completed. Autosave runs every 30s, but users
      // may finish faster; create/patch synchronously here to avoid missing fsid.
      try {
        const fsPayload = {
          data: { ...data, step },
          email: data.email || undefined,
        };
        if (!sessionIdRef.current) {
          const r = await fetch('/api/public/form-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fsPayload),
          });
          const jj = await r.json().catch(() => ({}));
          if (r.ok && jj?.data?.id) {
            sessionIdRef.current = jj.data.id as string;
            try {
              localStorage.setItem(LS_KEYS.sessionId, sessionIdRef.current);
            } catch {}
            void trackEvent('fs_created_on_submit', { step });
          }
        } else {
          await fetch(`/api/public/form-sessions/${encodeURIComponent(sessionIdRef.current)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fsPayload),
          });
          void trackEvent('fs_patched_on_submit', { step });
        }
      } catch {}
      // Trigger email confirmation after completion (EARTH-190, EARTH-191)
      // Validate contract before sending (supports both email and phone)
      const sessionPref = data.session_preference;
      // Trim and normalize contact fields before validation
      const email = data.email?.trim() || undefined;
      const phone = data.phone_number ? (normalizePhoneNumber(data.phone_number) || undefined) : undefined;
      
      // Only include the contact field matching the selected method
      const submissionPayload = {
        type: 'patient' as const,
        ...(data.name && data.name.trim() ? { name: data.name.trim() } : {}),
        ...(data.contact_method === 'email' ? { email } : { phone_number: phone }),
        contact_method: data.contact_method,
        form_session_id: sessionIdRef.current || undefined,
        confirm_redirect_path: '/fragebogen' as const,
        consent_share_with_therapists: true as const,
        privacy_version: PRIVACY_VERSION,
        ...(sessionPref === 'either'
          ? { session_preferences: ['online', 'in_person'] }
          : sessionPref
          ? { session_preference: sessionPref }
          : {}),
      };
      const submission = leadSubmissionSchema.safeParse(submissionPayload);
      if (!submission.success) {
        console.error('[SignupWizard] Validation failed:', submission.error.flatten());
        setSubmitError('Fehlgeschlagen. Bitte Seite aktualisieren und erneut versuchen.');
        return;
      }

      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission.data),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.error) throw new Error('Lead submit failed');
      const leadId = (j?.data?.id as string | undefined) || undefined;

      // Persist for confirm fallback UX
      try {
        if (leadId && typeof window !== 'undefined') {
          window.localStorage.setItem('leadId', leadId);
          if (data.email) window.localStorage.setItem('leadEmail', data.email);
        }
      } catch {}

      // Server conversions: mark form completed
      if (leadId) {
        try {
          await fetch(`/api/public/leads/${encodeURIComponent(leadId)}/form-completed`, { method: 'POST' });
        } catch {}
      }

      // Client conversions (deduped)
      try { fireGoogleAdsClientConversion(leadId); } catch {}

      void trackEvent('form_completed', { steps: 8 }); // 8 main steps (9 with SMS)
      // Go to final confirmation screen (step 9)
      goToStep(9);
    } catch (err) {
      setSubmitError('Senden fehlgeschlagen. Bitte überprüfe deine Verbindung und versuche es erneut.');
    } finally {
      clearTimeout(slowTimer);
      setSubmitting(false);
    }
  }

  // Calculate progress value (handle step 8.5 for SMS verification)
  const progressValue = React.useMemo(() => {
    if (step === 8.5) return PROGRESS[8]; // Use index 8 for step 8.5
    const idx = Math.max(0, Math.min(PROGRESS.length - 1, Math.floor(step) - 1));
    return PROGRESS[idx];
  }, [step]);

  return (
    <div className="space-y-6">
      {/* Offline banner */}
      {!isOnline && (
        <div className="rounded-md border p-3 text-sm bg-yellow-50 border-yellow-200">
          Du bist offline. Wir speichern deine Eingaben lokal und synchronisieren sie automatisch, sobald du wieder online bist.
        </div>
      )}
      <ProgressBar value={progressValue} />
      {renderScreen()}
      {/* Footer status only (per-screen navigation handles actions) */}
      <div className="flex items-center justify-end pt-2">
        <div className="text-sm text-muted-foreground">{saving ? 'Speichern…' : 'Gespeichert'}</div>
      </div>
      {submitting && (
        <div className="text-sm text-muted-foreground">
          {submitSlow ? 'Senden… (langsame Verbindung erkannt)' : 'Senden…'}
        </div>
      )}
      {submitError && (
        <div className="rounded-md border p-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-700">{submitError}</p>
          <div className="mt-2">
            <Button className="h-10" onClick={handleSubmit}>Erneut versuchen</Button>
          </div>
        </div>
      )}
    </div>
  );
}
