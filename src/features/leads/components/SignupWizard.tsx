"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import ProgressBar from './ProgressBar';
import Screen1, { type Screen1Values } from './screens/Screen1';
import Screen1_5, { type Screen1_5Values } from './screens/Screen1_5';
import Screen2, { type Screen2Values } from './screens/Screen2';
import Screen3, { type Screen3Values } from './screens/Screen3';
import Screen4, { type Screen4Values } from './screens/Screen4';
import Screen5 from './screens/Screen5';
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
  // Screen 2
  start_timing?: Screen2Values['start_timing'];
  kassentherapie?: Screen2Values['kassentherapie'];
  therapy_type?: Screen2Values['therapy_type'];
  what_missing?: string[];
  // Screen 3
  city?: string;
  online_ok?: boolean;
  session_preference?: 'online' | 'in_person' | 'either';
  budget?: Screen3Values['budget'];
  privacy_preference?: Screen3Values['privacy_preference']; 
  // Screen 4
  gender?: Screen4Values['gender'];
  language?: Screen4Values['language'];
  language_other?: string;
  time_slots?: Screen4Values['time_slots'];
  methods?: Screen4Values['methods'];
  // Screen 5
  additional_info?: string;
};

const PROGRESS = [0, 10, 20, 50, 75, 90, 100]; // 0, step1, step1.5, step2, step3, step4, step5

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
  // Inline resend confirmation UX state (step 6)
  const [resendEmail, setResendEmail] = React.useState<string>('');
  const [resendSubmitting, setResendSubmitting] = React.useState(false);
  const [resendMessage, setResendMessage] = React.useState<string>('');

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
        const miss: string[] = [];
        // Check contact info based on method
        if (d.contact_method === 'email') {
          if (!d.email) miss.push('email');
        } else if (d.contact_method === 'phone') {
          if (!d.phone_number) miss.push('phone_number');
          if (!d.phone_verified) miss.push('phone_verified');
        }
        return miss;
      }
      case 2: {
        const miss: string[] = [];
        if (!d.start_timing) miss.push('start_timing');
        if (!d.kassentherapie) miss.push('kassentherapie');
        return miss;
      }
      case 3: {
        const miss: string[] = [];
        const hasCity = !!(d.city && d.city.trim());
        const pref = d.session_preference;
        if (!pref) miss.push('session_preference');
        if (pref === 'in_person' && !hasCity) miss.push('city');
        return miss;
      }
      case 4: {
        const miss: string[] = [];
        if (!d.language) miss.push('language');
        if (d.language === 'Andere' && !(d.language_other && d.language_other.trim())) miss.push('language_other');
        return miss;
      }
      case 5: {
        // No required fields on the final context screen
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
      if (savedStep >= 1 && savedStep <= 6) setStep(savedStep);
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
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      // SECURITY: Block navigation to step 1.5 (SMS verification) unless requirements are met
      if (n === 1.5) {
        if (data.contact_method !== 'phone' || !data.phone_number) {
          console.warn('[SignupWizard] Blocked navigation to step 1.5: invalid contact method or missing phone');
          void trackEvent('navigation_blocked', { target_step: 1.5, reason: 'missing_phone_setup' });
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
      const v = Math.max(1, Math.min(6, n));
      prevStepRef.current = current;
      screenStartRef.current = Date.now();
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
        safeGoToStep(2);
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
            onNext={async () => {
              // If phone, send SMS and go to Screen1.5
              // If email, go directly to Screen2
              if (data.contact_method === 'phone' && data.phone_number) {
                try {
                  const sent = await handleSendSmsCode();
                  if (sent) safeGoToStep(1.5);
                  // else: stay on step 1 so user can switch to email or retry
                } catch (err) {
                  console.error('Failed to send SMS:', err);
                  // Could show error to user here
                }
              } else {
                safeGoToStep(2);
              }
            }}
            disabled={navLock || submitting}
          />
        );
      case 1.5:
        // SMS verification screen (phone users only)
        // SECURITY: Never auto-advance forward from verification step
        if (data.contact_method !== 'phone' || !data.phone_number) {
          // Send user back to step 1 to properly set up phone verification
          safeGoToStep(1);
          return null;
        }
        return (
          <Screen1_5
            phoneNumber={data.phone_number}
            onVerify={handleVerifySmsCode}
            onResend={async () => { await handleSendSmsCode(); }}
            disabled={navLock || submitting}
          />
        );
      case 2:
        return (
          <Screen2
            values={{
              start_timing: data.start_timing as Screen2Values['start_timing'],
              kassentherapie: data.kassentherapie as Screen2Values['kassentherapie'],
              therapy_type: data.therapy_type as Screen2Values['therapy_type'],
              what_missing: data.what_missing,
            }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => safeGoToStep(1)}
            onNext={() => safeGoToStep(3)}
            disabled={navLock || submitting}
          />
        );
      case 3:
        return (
          <Screen3
            values={{
              city: data.city,
              online_ok: data.online_ok,
              session_preference: data.session_preference,
              budget: data.budget,
              privacy_preference: data.privacy_preference,
            }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => safeGoToStep(2)}
            onNext={() => safeGoToStep(4)}
            disabled={navLock || submitting}
          />
        );
      case 4:
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
            onBack={() => safeGoToStep(3)}
            onNext={() => safeGoToStep(5)}
            disabled={navLock || submitting}
          />
        );
      case 5:
        return (
          <Screen5
            values={{ additional_info: data.additional_info }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => safeGoToStep(4)}
            onNext={handleSubmit}
            disabled={navLock || submitting}
          />
        );
      case 6:
        return (() => {
          const confirmParam = searchParams?.get('confirm');
          const isConfirmed = confirmParam === '1' || confirmParam === 'success';
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
          // Not confirmed yet → show callout and inline resend
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
                body: JSON.stringify({ email }),
              });
              setResendMessage('E‑Mail versendet. Bitte Posteingang prüfen.');
            } catch {
              setResendMessage('Bitte später erneut versuchen.');
            } finally {
              setResendSubmitting(false);
            }
          }
          return (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">✓ Geschafft! Deine Anfrage ist bei uns</h2>
              <p>Unser Team von Kaufmann Health prüft persönlich deine Anfrage und sucht die besten Therapeut:innen für dich.</p>
              <p>Du bekommst deine Matches innerhalb von 24 Stunden.</p>
              <p className="font-medium">Wichtig: Bitte bestätige deine E‑Mail‑Adresse, damit wir dir deine Matches schicken können.</p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="dein.name@example.com"
                  className="h-10 min-w-[220px] flex-1 rounded border border-gray-300 px-3 py-2"
                  aria-label="E‑Mail"
                />
                <Button className="h-10" onClick={handleResend} disabled={resendSubmitting} aria-disabled={resendSubmitting}>
                  Bestätigungs‑E‑Mail erneut senden
                </Button>
                <span className="text-sm text-muted-foreground" aria-live="polite">{resendMessage}</span>
              </div>
              <p className="text-sm text-muted-foreground">Keine E‑Mail bekommen? Schau im Spam‑Ordner nach.</p>
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

      // Track completion for last screen before submit
      {
        const now = Date.now();
        const elapsed = now - (screenStartRef.current || now);
        const miss = missingRequiredForStep(5, data);
        void trackEvent('screen_completed', { step: 5, duration_ms: elapsed, missing_required: miss });
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
      const submission = leadSubmissionSchema.safeParse({
        type: 'patient' as const,
        name: data.name,
        email: data.email,
        phone_number: data.phone_number,
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
      });
      if (!submission.success) {
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

      void trackEvent('form_completed', { steps: 5 });
      // Go to final screen
      goToStep(6);
    } catch (err) {
      setSubmitError('Senden fehlgeschlagen. Bitte überprüfe deine Verbindung und versuche es erneut.');
    } finally {
      clearTimeout(slowTimer);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Offline banner */}
      {!isOnline && (
        <div className="rounded-md border p-3 text-sm bg-yellow-50 border-yellow-200">
          Du bist offline. Wir speichern deine Eingaben lokal und synchronisieren sie automatisch, sobald du wieder online bist.
        </div>
      )}
      <ProgressBar value={PROGRESS[Math.max(0, Math.min(PROGRESS.length - 1, step - 1))]} />
      {renderScreen()}
      {/* Footer status only (per-screen navigation handles actions) */}
      <div className="flex items-center justify-end pt-2">
        <div className="text-sm text-muted-foreground">{saving ? 'Speichern…' : 'Gespeichert'}</div>
      </div>
      {/* Submit states */}
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
