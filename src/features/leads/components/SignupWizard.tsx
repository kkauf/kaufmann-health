"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import ProgressBar from './ProgressBar';
import Screen1, { type Screen1Values } from './screens/Screen1';
import Screen1_5, { type Screen1_5Values } from './screens/Screen1_5';
import Screen3 from './screens/Screen3';
import Screen4 from './screens/Screen4';
import NewScreen2_Timeline, { type NewScreen2Values } from './screens/NewScreen2_Timeline';
import NewScreen3_WhatBringsYou, { type NewScreen3Values } from './screens/NewScreen3_WhatBringsYou';
import NewScreen5_Modality from './screens/NewScreen5_Modality';
import ScreenSchwerpunkte, { type ScreenSchwerpunkteValues } from './screens/ScreenSchwerpunkte';
import { Button } from '@/components/ui/button';
import { leadSubmissionSchema } from '@/lib/contracts';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { normalizePhoneNumber } from '@/lib/verification/phone';
import { getOrCreateSessionId, getGclid } from '@/lib/attribution';
import { fireGoogleAdsClientConversion } from '@/lib/gtag';

// Feature toggle for schwerpunkte
const SHOW_SCHWERPUNKTE = process.env.NEXT_PUBLIC_SHOW_SCHWERPUNKTE === 'true';

const LS_KEYS = {
  data: 'kh_wizard_data',
  step: 'kh_wizard_step',
  sessionId: 'kh_form_session_id',
} as const;

export type WizardData = Omit<Screen1Values, 'email'> & Screen1_5Values & ScreenSchwerpunkteValues & {
  email?: string; // Make email optional since we might use phone instead
  // Step 1: Timeline
  start_timing?: NewScreen2Values['start_timing'];
  // Step 2: What Brings You (optional)
  additional_info?: NewScreen3Values['additional_info'];
  // Step 2.5: Schwerpunkte (feature-toggled)
  schwerpunkte?: string[];
  // Step 3: Modality
  modality_matters?: boolean;
  methods?: string[];
  // Step 4: Location
  city?: string;
  online_ok?: boolean;
  session_preference?: 'online' | 'in_person' | 'either';
  // Step 5: Preferences (gender, time_slots only)
  gender?: 'Frau' | 'Mann' | 'Keine Präferenz' | 'Divers/non-binär';
  time_slots?: string[];
  // Step 6: Contact Info
  name: string;
};

// Progress: 7 main steps (or 8 with SMS verification)
// Step 1: Timeline (0%), 2: Topic (14%), 3: Modality (28%), 4: Location (43%),
// 5: Preferences (57%), 6: Contact (71%), 6.5: SMS (86%), 7: Confirmation (100%)
const PROGRESS = [0, 14, 28, 43, 57, 71, 86, 100]; // steps 1-7 (step 6.5 uses index 6)

export default function SignupWizard() {
  const searchParams = useSearchParams();
  // Feature flag: direct booking (5-step anonymous) vs manual curation (9-step with contact)
  const isDirectBookingFlow = (process.env.NEXT_PUBLIC_DIRECT_BOOKING_FLOW || '').toLowerCase() === 'true';
  // IMPORTANT: Use state for variant to avoid race condition during hydration.
  // searchParams.get() may return null briefly before hydration completes,
  // causing marketplace/concierge users to incorrectly trigger the anonymous 5-step flow.
  // We capture the variant on mount and use it consistently throughout the session.
  const [capturedVariant, setCapturedVariant] = React.useState<string | null>(() => {
    // SSR-safe initial value from searchParams (will be overwritten on mount if needed)
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('variant') || params.get('v') || null;
    } catch {
      return null;
    }
  });
  // Fallback to live searchParams if capturedVariant not yet set (hydration)
  const variant = capturedVariant || searchParams.get('variant') || searchParams.get('v');
  const isConcierge = variant === 'concierge';
  const _isMarketplace = variant === 'marketplace'; // Kept for potential future use
  const isSelfService = variant === 'self-service';
  // Test 4: Variant-aware step routing
  // - Concierge: uses open text field (step 2) for manual curation
  // - Self-Service: uses Schwerpunkte selector (step 2.5) for auto-filtering
  // - Default (marketplace/other): follows SHOW_SCHWERPUNKTE feature flag
  const usesSchwerpunkteStep = isSelfService || (!isConcierge && SHOW_SCHWERPUNKTE);
  // Default behavior: ALL users go through verification before matches (9-step flow)
  // Only explicit opt-out variants (none currently) would skip verification
  // This ensures we always capture contact info before showing matches
  const needsVerificationFlow = true; // Was: isConcierge || isMarketplace
  const maxStep = (isDirectBookingFlow && !needsVerificationFlow) ? 5 : 9; // 5 steps for anonymous, 9 for contact collection

  const [step, setStep] = React.useState<number>(1);
  const [data, setData] = React.useState<WizardData>({ name: '' });
  const [initialized, setInitialized] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitSlow, setSubmitSlow] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const lastSyncedRef = React.useRef<string>('');
  const sessionIdRef = React.useRef<string | null>(null);
  const webSessionIdRef = React.useRef<string | null>(null);
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
  const lastTrackedStepRef = React.useRef<number | null>(null);
  // Campaign overrides captured on client (source/variant)
  const campaignSourceOverrideRef = React.useRef<string | null>(null);
  const campaignVariantOverrideRef = React.useRef<string | null>(null);

  // Ensure a stable web analytics session id exists before any events
  React.useEffect(() => {
    try {
      webSessionIdRef.current = getOrCreateSessionId() || null;
    } catch {
      webSessionIdRef.current = null;
    }
  }, []);

  // Analytics helper
  const trackEvent = React.useCallback(async (type: string, properties?: Record<string, unknown>) => {
    try {
      const sid = webSessionIdRef.current || getOrCreateSessionId() || undefined;
      if (!sid) return;
      const payload = {
        type,
        session_id: sid,
        properties: { ...(properties || {}), form_session_id: sessionIdRef.current || undefined },
      };
      void (
        navigator.sendBeacon?.(
          '/api/events',
          new Blob([JSON.stringify(payload)], { type: 'application/json' }),
        ) ||
        (await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }))
      );
    } catch { }
  }, []);

  function missingRequiredForStep(s: number, d: WizardData): string[] {
    switch (s) {
      case 1: {
        const miss: string[] = [];
        if (!d.start_timing) miss.push('start_timing');
        return miss;
      }
      case 2: {
        // Step 2: What Brings You (TRULY OPTIONAL - no required fields)
        return [];
      }
      case 3: {
        // Step 3: Modality (optional)
        return [];
      }
      case 4: {
        // Step 4: Location (session_preference required, city required if in_person)
        const miss: string[] = [];
        const hasCity = !!(d.city && d.city.trim());
        const pref = d.session_preference;
        if (!pref) miss.push('session_preference');
        if (pref === 'in_person' && !hasCity) miss.push('city');
        return miss;
      }
      case 5: {
        // Step 5: Preferences (NO REQUIRED fields - gender and time_slots optional)
        return [];
      }
      case 6: {
        // Step 6: Contact Info (name, email/phone required)
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
      case 6.5: {
        // Step 6.5: SMS verification (no required fields - verification happens in component)
        return [];
      }
      case 7: {
        // Step 7: Confirmation (no required fields)
        return [];
      }
      default:
        return [];
    }
  }

  // Load from localStorage on mount
  React.useEffect(() => {
    try {
      // Check for restart param - clears session and starts fresh
      const restartParam = searchParams?.get('restart');
      if (restartParam === '1') {
        localStorage.removeItem(LS_KEYS.data);
        localStorage.removeItem(LS_KEYS.step);
        localStorage.removeItem(LS_KEYS.sessionId);
        sessionIdRef.current = null;
        // Remove restart param from URL without reload
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('restart');
          window.history.replaceState({}, '', url.pathname + url.search);
        }
        setStep(1);
        setData({ name: '' });
        setInitialized(true);
        return;
      }

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
      // Clamp to valid range: 1-5 for direct booking, 1-9 for manual curation
      const clampedStep = Math.max(1, Math.min(maxStep, savedStep));
      setStep(clampedStep);

      // Check for existing verified session (kh_client cookie from EARTH-204)
      // Only prefill contact info in manual curation flow (steps 6-9 exist)
      if (!isDirectBookingFlow) {
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
      }

      // Handle ?timing= param from mid-page conversion (from /start entry options)
      const timingParam = searchParams?.get('timing');
      if (timingParam) {
        let start_timing: string | undefined;
        switch (timingParam) {
          case 'immediate':
            start_timing = 'So schnell wie möglich';
            break;
          case 'soon':
            start_timing = 'In den nächsten 2-4 Wochen';
            break;
          case 'flexible':
            start_timing = 'In 1-2 Monaten';
            break;
        }
        if (start_timing) {
          setData((prev) => ({ ...prev, start_timing }));
          void trackEvent('midpage_prefill', { timing: timingParam });
        }
      }

      // Prefer fs from URL if present, otherwise fall back to localStorage
      const fsFromUrl = searchParams?.get('fs');
      const fsid = fsFromUrl || localStorage.getItem(LS_KEYS.sessionId);
      if (fsid) {
        sessionIdRef.current = fsid;
        try {
          localStorage.setItem(LS_KEYS.sessionId, fsid);
        } catch { }
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
      } catch { }
      // Mark initialization complete only after attempting to load saved state
      // Capture campaign source/variant from URL or referrer
      try {
        let src: string | null = null;
        let variant: string | undefined = undefined;
        const vParam = searchParams?.get('variant') || searchParams?.get('v') || undefined;
        const ref = (typeof document !== 'undefined' ? document.referrer : '') || '';
        
        if (vParam) {
          variant = vParam;
          // Determine source from referrer - /therapie-finden for concierge, /start for marketplace
          if (ref.includes('/therapie-finden')) {
            src = '/therapie-finden';
          } else if (ref.includes('/start')) {
            src = '/start';
          } else {
            // Default based on variant: concierge → /therapie-finden, others → /start
            src = vParam === 'concierge' ? '/therapie-finden' : '/start';
          }
        }
        // Fallback to document.referrer for cases without variant param
        if (!src && !variant) {
          try {
            if (ref.includes('/therapie-finden')) {
              src = '/therapie-finden';
            } else if (ref.includes('/start')) {
              src = '/start';
              try {
                const u = new URL(ref);
                const vp = u.searchParams.get('variant') || u.searchParams.get('v') || undefined;
                variant = vp || variant;
              } catch { }
            }
          } catch { }
        }
        if (src) campaignSourceOverrideRef.current = src;
        if (variant) campaignVariantOverrideRef.current = variant;
      } catch { }

      // Mark initialization complete only after attempting to load saved state
      setInitialized(true);
      // Cleanup
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } catch { }
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
        try { localStorage.setItem(LS_KEYS.step, '9'); } catch { }
        // Analytics: confirmation success rendered
        void trackEvent('confirm_success_rendered', { contact_method: 'email' });
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Track success render for phone users reaching step 7+ (confirmation screens)
  React.useEffect(() => {
    if (step >= 7 && data.contact_method === 'phone') {
      void trackEvent('confirm_success_rendered', { contact_method: 'phone' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data.contact_method]);

  // Fetch matchesUrl for verified phone users (for "See Matches" button)
  const [matchesUrl, setMatchesUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (step < 7) return;
    if (data.contact_method !== 'phone') return;
    if (!data.phone_verified) return;
    
    fetch('/api/public/session')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.data?.matchesUrl) {
          setMatchesUrl(json.data.matchesUrl);
        }
      })
      .catch(() => {});
  }, [step, data.contact_method, data.phone_verified]);

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
          // Adopt remote if it appears further along than local (clamp to maxStep based on feature flag)
          if (remoteStep && remoteStep > step) {
            const next = { ...data, ...remoteObj } as WizardData;
            setData(next);
            const clamped = Math.max(1, Math.min(maxStep, remoteStep));
            setStep(clamped);
            try {
              localStorage.setItem(LS_KEYS.data, JSON.stringify(next));
              localStorage.setItem(LS_KEYS.step, String(clamped));
            } catch { }
          }
        }
      } catch { }
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
      } catch { }
      // Track changed fields (PII-safe: only field names, no values)
      try {
        if (process.env.NEXT_PUBLIC_ANALYTICS_VERBOSE === 'true') {
          const keys = Object.keys(next) as Array<keyof WizardData>;
          for (const k of keys) {
            void trackEvent('field_change', { field: String(k), step });
          }
        }
      } catch { }
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
      // Update refs and navigate (clamp to valid range based on feature flag)
      const v = Math.max(1, Math.min(maxStep, n));
      prevStepRef.current = current;
      screenStartRef.current = Date.now();
      // If navigating backward, suppress auto-advance on the target step until user interacts
      if (n < current) setSuppressAutoStep(n);
      else setSuppressAutoStep(null);
      try {
        localStorage.setItem(LS_KEYS.step, String(v));
      } catch { }
      lastTrackedStepRef.current = v;
      void trackEvent('screen_viewed', { step: v });
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
  }, [data, trackEvent, maxStep]);

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

  // Fire screen_viewed on step changes (de-duplicated)
  React.useEffect(() => {
    if (lastTrackedStepRef.current === step) return;
    lastTrackedStepRef.current = step;
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
        const cs = campaignSourceOverrideRef.current || undefined;
        const cv = campaignVariantOverrideRef.current || undefined;
        const payload = {
          data: {
            ...data,
            step,
            ...(cs || cv
              ? { _attr: { ...(cs ? { campaign_source: cs } : {}), ...(cv ? { campaign_variant: cv } : {}) } }
              : {}),
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
            } catch { }
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

  const earlyFsCreatedRef = React.useRef(false);
  React.useEffect(() => {
    if (!initialized) return;
    if (earlyFsCreatedRef.current) return;
    if (sessionIdRef.current) {
      earlyFsCreatedRef.current = true;
      return;
    }
    const t = setTimeout(async () => {
      try {
        const fsPayload = {
          data: {
            step,
            _bootstrap: true,
            ...((campaignSourceOverrideRef.current || campaignVariantOverrideRef.current)
              ? {
                _attr: {
                  ...(campaignSourceOverrideRef.current ? { campaign_source: campaignSourceOverrideRef.current } : {}),
                  ...(campaignVariantOverrideRef.current ? { campaign_variant: campaignVariantOverrideRef.current } : {}),
                }
              }
              : {}),
          },
          email: data.email || undefined,
        };
        const res = await fetch('/api/public/form-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fsPayload),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.data?.id) {
          sessionIdRef.current = j.data.id as string;
          try {
            localStorage.setItem(LS_KEYS.sessionId, sessionIdRef.current);
          } catch { }
        }
      } catch { }
      earlyFsCreatedRef.current = true;
    }, 300);
    return () => clearTimeout(t);
  }, [initialized, step, data.email]);

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
          ...(data.name && data.name.trim() ? { name: data.name.trim() } : {}),
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
        // Step 1: Timeline (now first step - no back button)
        return (
          <NewScreen2_Timeline
            values={{ start_timing: data.start_timing }}
            onChange={saveLocal}
            onNext={() => safeGoToStep(usesSchwerpunkteStep ? 2.5 : 2)}
            suppressAutoAdvance={suppressAutoStep === 1}
            disabled={navLock || submitting}
          />
        );
      case 2:
        // Step 2: What Brings You (Concierge variant uses this; Self-Service skips to Schwerpunkte)
        if (usesSchwerpunkteStep) {
          safeGoToStep(3);
          return null;
        }
        return (
          <NewScreen3_WhatBringsYou
            values={{ additional_info: data.additional_info }}
            onChange={saveLocal}
            onBack={() => safeGoToStep(1)}
            onNext={() => safeGoToStep(3)}
            disabled={navLock || submitting}
          />
        );
      case 2.5:
        // Step 2.5: Schwerpunkte (Self-Service variant uses this for auto-filtering)
        if (!usesSchwerpunkteStep) {
          safeGoToStep(3);
          return null;
        }
        return (
          <ScreenSchwerpunkte
            values={{ schwerpunkte: data.schwerpunkte }}
            onChange={saveLocal}
            onBack={() => safeGoToStep(1)}
            onNext={() => safeGoToStep(3)}
            disabled={navLock || submitting}
          />
        );
      case 3:
        // Step 3: Modality Preferences
        return (
          <NewScreen5_Modality
            values={{
              modality_matters: data.modality_matters,
              methods: data.methods,
            }}
            onChange={saveLocal}
            onBack={() => safeGoToStep(usesSchwerpunkteStep ? 2.5 : 2)}
            onNext={() => safeGoToStep(4)}
            suppressAutoAdvance={suppressAutoStep === 3}
            disabled={navLock || submitting}
          />
        );
      case 4:
        // Step 4: Location (session preference + city only, no privacy)
        return (
          <Screen3
            values={{
              city: data.city,
              online_ok: data.online_ok,
              session_preference: data.session_preference,
            }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => safeGoToStep(3)}
            onNext={() => safeGoToStep(5)}
            disabled={navLock || submitting}
          />
        );
      case 5:
        // Step 5: Preferences (gender + time_slots only, no language)
        return (
          <Screen4
            values={{
              gender: data.gender,
              time_slots: data.time_slots,
              methods: data.methods, // Keep for compatibility
            }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => safeGoToStep(4)}
            onNext={(isDirectBookingFlow && !needsVerificationFlow) ? handleQuestionnaireSubmit : () => safeGoToStep(6)}
            disabled={navLock || submitting}
          />
        );
      case 6:
        // Step 6: Contact Info (moved from step 8)
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
            onBack={() => safeGoToStep(5)}
            onNext={async () => {
              void trackEvent('submit_clicked', { step: 6, contact_method: data.contact_method });
              if (data.contact_method === 'phone' && data.phone_number) {
                if (data.phone_verified) {
                  await handleSubmit();
                } else {
                  try {
                    const sent = await handleSendSmsCode();
                    if (sent) safeGoToStep(6.5);
                  } catch (err) {
                    console.error('Failed to send SMS:', err);
                  }
                }
              } else {
                await handleSubmit();
              }
            }}
            disabled={navLock || submitting}
          />
        );
      case 6.5:
        // Step 6.5: SMS verification (phone users only)
        if (data.contact_method !== 'phone' || !data.phone_number) {
          safeGoToStep(6);
          return null;
        }
        return (
          <Screen1_5
            phoneNumber={data.phone_number}
            onVerify={async (code: string) => {
              const result = await handleVerifySmsCode(code);
              if (result.success) {
                await handleSubmit();
              }
              return result;
            }}
            onResend={async () => { await handleSendSmsCode(); }}
            onBack={() => safeGoToStep(6)}
            disabled={navLock || submitting}
          />
        );
      case 7:
      case 8:
      case 8.5:
      case 9:
        // Step 7+ all render confirmation (handles legacy localStorage with step=9)
        return renderConfirmationScreen();
      default:
        // Fallback: redirect invalid steps to step 1
        if (step > 9 || step < 1) {
          safeGoToStep(1);
        }
        return null;
    }
  }

  function renderConfirmationScreen() {
    return (() => {
      const confirmParam = searchParams?.get('confirm');
      const isConfirmed = confirmParam === '1' || confirmParam === 'success';
      const isPhoneUser = data.contact_method === 'phone' && !!data.phone_number;
      
      // Test 4: Variant-specific confirmation screens
      // - Concierge: Show waiting screen (manual curation, 24h)
      // - Self-Service: Redirect to matches or show CTA
      
      if (isConfirmed) {
        // Email confirmed - different behavior per variant
        if (isConcierge) {
          // Concierge: Show waiting screen
          return (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">✓ E‑Mail bestätigt – wir bereiten deine persönliche Auswahl vor</h2>
              <p>Unser Team von Kaufmann Health prüft persönlich deine Anfrage und sucht die besten Therapeut:innen für dich.</p>
              <p>Du bekommst deine handverlesene Auswahl innerhalb von 24 Stunden per E‑Mail.</p>
              <div className="rounded-md border p-3 bg-emerald-50 border-emerald-200">
                <p className="text-sm">Was als Nächstes passiert: Wir gleichen deine Präferenzen mit unserem Netzwerk ab und senden dir deine persönliche Auswahl mit einem 1‑Klick‑Bestätigungslink.</p>
              </div>
            </div>
          );
        }
        // Self-Service / other: Show matches CTA or redirect
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">✓ E‑Mail bestätigt – deine Matches sind bereit!</h2>
            <p>Basierend auf deinen Präferenzen haben wir passende Therapeut:innen für dich gefunden.</p>
            {matchesUrl ? (
              <Button
                onClick={() => {
                  void trackEvent('matches_cta_clicked', { contact_method: 'email', has_matches_url: true });
                  window.location.assign(matchesUrl);
                }}
                className="h-14 w-full text-lg font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
              >
                Jetzt Therapeut:innen ansehen →
              </Button>
            ) : (
              <Button
                onClick={() => {
                  void trackEvent('directory_fallback_clicked', { contact_method: 'email', has_matches_url: false });
                  window.location.assign('/therapeuten');
                }}
                className="h-14 w-full text-lg font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
              >
                Jetzt Therapeut:innen ansehen →
              </Button>
            )}
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
              try { localStorage.setItem('leadEmail', email); } catch { }
              setAddEmailMessage('E‑Mail gespeichert. Danke!');
              void trackEvent('optional_email_provided', { step: 9 });
            }
          } catch {
            setAddEmailMessage('Speichern fehlgeschlagen. Bitte später erneut versuchen.');
          } finally {
            setAddEmailSubmitting(false);
          }
        }

        // Test 4: Concierge phone users see waiting screen, self-service sees matches CTA
        if (isConcierge) {
          return (
            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">✓ Geschafft! Deine Handynummer ist bestätigt</h2>
                <p className="text-base leading-relaxed text-gray-700">
                  Unser Team prüft persönlich deine Anfrage und sucht die besten Therapeut:innen für dich.
                </p>
                <p className="text-base leading-relaxed text-gray-700">
                  Du bekommst deine handverlesene Auswahl innerhalb von 24 Stunden per SMS.
                </p>
              </div>
              <div className="rounded-md border p-4 bg-emerald-50 border-emerald-200">
                <p className="text-sm text-gray-700">Was als Nächstes passiert: Wir gleichen deine Präferenzen mit unserem Netzwerk ab und senden dir deine persönliche Auswahl mit einem 1‑Klick‑Bestätigungslink.</p>
              </div>
            </div>
          );
        }

        // Self-Service phone users: show CTA to matches
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">✓ Geschafft! Deine Handynummer ist bestätigt</h2>
              <p className="text-base leading-relaxed text-gray-700">
                {isDirectBookingFlow
                  ? 'Du kannst jetzt Therapeut:innen kontaktieren und direkt Termine buchen.'
                  : 'Basierend auf deinen Präferenzen haben wir passende Therapeut:innen für dich gefunden.'}
              </p>
            </div>

            {/* Primary CTA - See Matches (or fallback to directory) */}
            <Button
              onClick={() => {
                const target = matchesUrl || '/therapeuten';
                void trackEvent('skip_to_matches', { contact_method: 'phone', email_added: !!addEmailMessage?.includes('gespeichert'), has_matches_url: !!matchesUrl });
                window.location.assign(target);
              }}
              className="h-14 w-full text-lg font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
            >
              Jetzt Therapeut:innen ansehen →
            </Button>

            {/* Secondary: Optional email - collapsed by default */}
            {!addEmailMessage?.includes('gespeichert') ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('email-add-section');
                    if (el) el.classList.toggle('hidden');
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
                >
                  ✉️ Optional: E‑Mail für Therapeuten-Kommunikation hinzufügen
                </button>
                <div id="email-add-section" className="hidden mt-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-600 mb-3">Therapeut:innen kommunizieren oft per E‑Mail.</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="deine@email.de"
                      className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      aria-label="E‑Mail"
                    />
                    <Button
                      onClick={handleAddEmail}
                      disabled={addEmailSubmitting}
                      variant="outline"
                      className="h-10 text-sm whitespace-nowrap"
                    >
                      {addEmailSubmitting ? '...' : 'Speichern'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-center text-green-700" aria-live="polite">✓ {addEmailMessage}</p>
            )}
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
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">✓ Geschafft! Fast fertig</h2>
            <p className="text-base leading-relaxed text-gray-700">
              {isDirectBookingFlow
                ? 'Bestätige deine E‑Mail, um Therapeut:innen zu kontaktieren und Termine zu buchen.'
                : 'Unser Team prüft persönlich deine Anfrage und sucht die besten Therapeut:innen für dich. Du bekommst deine Matches innerhalb von 24 Stunden.'}
            </p>
          </div>

          {/* Feature Highlight Panel - Email confirmation callout */}
          <div className="relative overflow-hidden rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-6 sm:p-8 shadow-lg shadow-indigo-100/30">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
            <div className="space-y-3">
              <p className="text-base font-semibold text-gray-900">📧 Wichtig: Bitte bestätige deine E‑Mail‑Adresse</p>
              <p className="text-sm leading-relaxed text-gray-700">
                {isDirectBookingFlow
                  ? 'Wir haben dir gerade eine Bestätigungs-E-Mail geschickt. Bitte prüfe deinen Posteingang und klicke auf den Link, um fortzufahren. Therapeut:innen kommunizieren per E‑Mail.'
                  : 'Wir haben dir gerade eine Bestätigungs-E-Mail geschickt. Bitte prüfe deinen Posteingang und klicke auf den Link, damit wir dir deine Therapeuten-Empfehlungen zusenden können.'}
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
  }

  // Submit questionnaire after Step 5 - create anonymous patient and redirect to matches (direct booking flow only)
  async function handleQuestionnaireSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSlow(false);
    const slowTimer = setTimeout(() => setSubmitSlow(true), 3000);

    try {
      void trackEvent('questionnaire_submitted', {
        step: 5,
        has_city: !!data.city,
        has_timing: !!data.start_timing,
      });

      const sidHeader = webSessionIdRef.current || getOrCreateSessionId() || undefined;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sidHeader) headers['X-Session-Id'] = sidHeader;
      if (campaignSourceOverrideRef.current) headers['X-Campaign-Source-Override'] = campaignSourceOverrideRef.current;
      if (campaignVariantOverrideRef.current) headers['X-Campaign-Variant-Override'] = campaignVariantOverrideRef.current;

      const sessionPref = data.session_preference;
      const payload = {
        start_timing: data.start_timing,
        additional_info: data.additional_info,
        modality_matters: data.modality_matters,
        methods: data.methods || [],
        schwerpunkte: data.schwerpunkte || [],
        city: data.city,
        session_preference: sessionPref,
        gender: data.gender,
        time_slots: data.time_slots || [],
        form_session_id: sessionIdRef.current || undefined,
      };

      const res = await fetch('/api/public/questionnaire-submit', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Questionnaire submission failed');
      }

      const matchesUrl = json?.data?.matchesUrl;
      const patientId = json?.data?.patientId;

      // Persist patient ID for analytics
      if (patientId && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('anonymousPatientId', patientId);
        } catch { }
      }

      void trackEvent('questionnaire_completed', {
        match_quality: json?.data?.matchQuality,
        patient_id: patientId,
      });

      // Redirect to matches
      if (matchesUrl && typeof window !== 'undefined') {
        void trackEvent('redirect_to_matches', { anonymous: true });
        window.location.assign(matchesUrl);
        return;
      }

      // Fallback if no matches URL
      setSubmitError('Keine Therapeuten gefunden. Bitte versuche es später erneut.');

    } catch (err) {
      console.error('Questionnaire submit error:', err);
      setSubmitError('Senden fehlgeschlagen. Bitte überprüfe deine Verbindung und versuche es erneut.');
    } finally {
      clearTimeout(slowTimer);
      setSubmitting(false);
    }
  }

  // Submit for manual curation flow (9-step with contact collection)
  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSlow(false);
    const slowTimer = setTimeout(() => setSubmitSlow(true), 3000);
    try {

      // Track completion for last screen before submit (step 6 for contact, 6.5 for SMS)
      {
        const now = Date.now();
        const elapsed = now - (screenStartRef.current || now);
        const currentStep = data.contact_method === 'phone' ? 6.5 : 6;
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
            } catch { }
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
      } catch { }
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

      const sidHeader = webSessionIdRef.current || getOrCreateSessionId() || undefined;
      const gclid = getGclid();
      const leadHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sidHeader) leadHeaders['X-Session-Id'] = sidHeader;
      if (gclid) leadHeaders['X-Gclid'] = gclid;
      if (campaignSourceOverrideRef.current) leadHeaders['X-Campaign-Source-Override'] = campaignSourceOverrideRef.current;
      if (campaignVariantOverrideRef.current) leadHeaders['X-Campaign-Variant-Override'] = campaignVariantOverrideRef.current;
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: leadHeaders,
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
      } catch { }

      // Server conversions: mark form completed
      if (leadId) {
        try {
          const fcHeaders: Record<string, string> = {};
          if (sidHeader) fcHeaders['X-Session-Id'] = sidHeader;
          await fetch(`/api/public/leads/${encodeURIComponent(leadId)}/form-completed`, {
            method: 'POST',
            headers: fcHeaders,
          });
        } catch { }
      }

      // Fire client-side Google Ads base conversion (Enhanced Conversions need this)
      try {
        fireGoogleAdsClientConversion(leadId);
      } catch { }

      {
        const currentStep2 = data.contact_method === 'phone' ? 8.5 : 8;
        void trackEvent('submit_succeeded', { step: currentStep2, contact_method: data.contact_method });
      }

      // Test 3: Always require verification before showing matches
      // The matchesUrl is stored in metadata.last_confirm_redirect_path by the leads API
      // After email/phone verification, user will be redirected to their matches
      const matchesUrl = (j?.data?.matchesUrl as string | undefined) || undefined;
      if (matchesUrl) {
        void trackEvent('matches_created_pending_verification', { instant_match: true });
      }

      void trackEvent('form_completed', { steps: 8 });

      // Phone users: already verified via SMS, redirect to matches immediately
      if (data.contact_method === 'phone' && data.phone_verified && matchesUrl) {
        void trackEvent('redirect_to_matches', { contact_method: 'phone', instant_match: true });
        window.location.assign(matchesUrl);
        return;
      }

      // Email users: go to confirmation screen (step 7) to wait for email verification
      goToStep(7);
    } catch {
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
