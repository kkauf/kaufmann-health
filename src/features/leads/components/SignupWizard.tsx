"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import ProgressBar from './ProgressBar';
import Screen3 from './screens/Screen3';
import Screen4 from './screens/Screen4';
import NewScreen2_Timeline, { type NewScreen2Values } from './screens/NewScreen2_Timeline';
import NewScreen3_WhatBringsYou, { type NewScreen3Values } from './screens/NewScreen3_WhatBringsYou';
import NewScreen5_Modality, { type NewScreen5Values } from './screens/NewScreen5_Modality';
import { Button } from '@/components/ui/button';
import { getOrCreateSessionId } from '@/lib/attribution';

const LS_KEYS = {
  data: 'kh_wizard_data',
  step: 'kh_wizard_step',
  sessionId: 'kh_form_session_id',
} as const;

export type WizardData = {
  // Step 1: Timeline
  start_timing?: NewScreen2Values['start_timing'];
  // Step 2: What Brings You (optional)
  additional_info?: NewScreen3Values['additional_info'];
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
};

// Progress values for each step (5 steps: 0%, 20%, 40%, 60%, 80%, 100%)
const PROGRESS = [0, 20, 40, 60, 80, 100]; // steps 1-5

export default function SignupWizard() {
  const searchParams = useSearchParams();
  const [step, setStep] = React.useState<number>(1);
  const [data, setData] = React.useState<WizardData>({});
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
  const [showResendForm, setShowResendForm] = React.useState(false);

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
        // Step 1: Timeline (required)
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
      // Clamp saved step to valid range (1-5) - steps 6-9 are deprecated
      const savedStep = Number(localStorage.getItem(LS_KEYS.step) || '1');
      const clampedStep = Math.max(1, Math.min(5, savedStep));
      setStep(clampedStep);

      // Session check removed: contact collection now happens in booking flow, not questionnaire
      
      // Handle ?timing= param from mid-page conversion (from /start entry options)
      const timingParam = searchParams?.get('timing');
      if (timingParam) {
        let start_timing: NewScreen2Values['start_timing'] | undefined;
        switch (timingParam) {
          case 'week':
            start_timing = 'Innerhalb der nächsten Woche';
            break;
          case 'month':
            start_timing = 'Innerhalb des nächsten Monats';
            break;
          case 'flexible':
            start_timing = 'Flexibel, der richtige Match ist wichtiger';
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
      // Capture campaign source/variant from URL or referrer
      try {
        let src: string | null = null;
        let variant: string | undefined = undefined;
        const vParam = searchParams?.get('variant') || searchParams?.get('v') || undefined;
        if (vParam) {
          src = '/start';
          variant = vParam;
        }
        // Fallback to document.referrer (was on /start before /fragebogen)
        try {
          const ref = (typeof document !== 'undefined' ? document.referrer : '') || '';
          if (!src && ref.includes('/start')) {
            src = '/start';
            try {
              const u = new URL(ref);
              const vp = u.searchParams.get('variant') || u.searchParams.get('v') || undefined;
              variant = vp || variant;
            } catch {}
          }
        } catch {}
        if (src) campaignSourceOverrideRef.current = src;
        if (variant) campaignVariantOverrideRef.current = variant;
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

  // Handle confirm param (legacy email confirmation flow - now deprecated)
  React.useEffect(() => {
    try {
      const c = searchParams?.get('confirm');
      const idFromUrl = searchParams?.get('id');
      
      // Legacy handling: if user lands here with confirm=1/success from an old email link,
      // check if we have an anonymous patient ID (new flow) or redirect to a completion page
      if (c === '1' || c === 'success') {
        // New flow: check for anonymous patient and redirect to matches if available
        const anonPatientId = typeof window !== 'undefined' ? localStorage.getItem('anonymousPatientId') : null;
        if (anonPatientId) {
          void trackEvent('legacy_confirm_redirect', { anonymous_patient_id: anonPatientId });
          // Questionnaire already completed - redirect to directory or show completion message
          if (typeof window !== 'undefined') {
            window.location.assign('/therapeuten');
          }
          return;
        }
        
        // Old flow fallback: user might have incomplete data; reset to step 1
        void trackEvent('legacy_confirm_fallback', { has_id: !!idFromUrl });
        setStep(1);
        try { localStorage.setItem(LS_KEYS.step, '1'); } catch {}
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Removed: Track success render for phone users - step 9 no longer exists

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
          // Adopt remote if it appears further along than local (clamp to 1-5)
          if (remoteStep && remoteStep > step) {
            const next = { ...data, ...remoteObj } as WizardData;
            setData(next);
            const clamped = Math.max(1, Math.min(5, remoteStep));
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
      // Track completion for current screen
      const now = Date.now();
      const elapsed = now - (screenStartRef.current || now);
      const miss = missingRequiredForStep(current, data);
      void trackEvent('screen_completed', { step: current, duration_ms: elapsed, missing_required: miss });
      if (miss.length > 0) {
        void trackEvent('field_abandonment', { step: current, fields: miss });
      }
      // Update refs and navigate (clamp to valid range 1-5)
      const v = Math.max(1, Math.min(5, n));
      prevStepRef.current = current;
      screenStartRef.current = Date.now();
      // If navigating backward, suppress auto-advance on the target step until user interacts
      if (n < current) setSuppressAutoStep(n);
      else setSuppressAutoStep(null);
      try {
        localStorage.setItem(LS_KEYS.step, String(v));
      } catch {}
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
              ? { _attr: {
                  ...(campaignSourceOverrideRef.current ? { campaign_source: campaignSourceOverrideRef.current } : {}),
                  ...(campaignVariantOverrideRef.current ? { campaign_variant: campaignVariantOverrideRef.current } : {}),
                } }
              : {}),
          },
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
          } catch {}
        }
      } catch {}
      earlyFsCreatedRef.current = true;
    }, 300);
    return () => clearTimeout(t);
  }, [initialized, step]);

  // Simple screen renderers
  function renderScreen() {
    switch (step) {
      case 1:
        // Step 1: Timeline (now first step - no back button)
        return (
          <NewScreen2_Timeline
            values={{ start_timing: data.start_timing }}
            onChange={saveLocal}
            onNext={() => safeGoToStep(2)}
            suppressAutoAdvance={suppressAutoStep === 1}
            disabled={navLock || submitting}
          />
        );
      case 2:
        // Step 2: What Brings You (truly optional)
        return (
          <NewScreen3_WhatBringsYou
            values={{ additional_info: data.additional_info }}
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
            onBack={() => safeGoToStep(2)}
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
        // Step 5: Preferences (final step - submit questionnaire)
        return (
          <Screen4
            values={{
              gender: data.gender,
              time_slots: data.time_slots,
              methods: data.methods,
            }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => safeGoToStep(4)}
            onNext={handleQuestionnaireSubmit}
            disabled={navLock || submitting}
          />
        );
      // Removed Steps 6, 6.5, 7 - contact collection now happens in booking flow
      default:
        return null;
    }
  }

  // Submit questionnaire after Step 5 - create anonymous patient and redirect to matches
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
        } catch {}
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

  // Calculate progress value for 5-step flow
  const progressValue = React.useMemo(() => {
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
            <Button className="h-10" onClick={handleQuestionnaireSubmit}>Erneut versuchen</Button>
          </div>
        </div>
      )}
    </div>
  );
}

