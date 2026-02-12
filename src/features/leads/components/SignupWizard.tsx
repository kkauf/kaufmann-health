"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import ProgressBar from './ProgressBar';
import Screen1, { type Screen1Values } from './screens/Screen1';
import ScreenContactClassic from './screens/ScreenContactClassic';
import Screen1_5, { type Screen1_5Values } from './screens/Screen1_5';
import Screen3 from './screens/Screen3';
import Screen4 from './screens/Screen4';
// NewScreen2_Timeline removed - start_timing question eliminated
import NewScreen3_WhatBringsYou, { type NewScreen3Values } from './screens/NewScreen3_WhatBringsYou';
import NewScreen5_Modality from './screens/NewScreen5_Modality';
import ScreenSchwerpunkte, { type ScreenSchwerpunkteValues } from './screens/ScreenSchwerpunkte';
import ScreenPaymentInfo, { type ScreenPaymentInfoValues } from './screens/ScreenPaymentInfo';
import ScreenCredentialOptIn, { type ScreenCredentialOptInValues } from './screens/ScreenCredentialOptIn';
import ScreenMatchPreview from './screens/ScreenMatchPreview';
import ScreenNameEmail from './screens/ScreenNameEmail';
import { Button } from '@/components/ui/button';
import { leadSubmissionSchema } from '@/lib/contracts';
import { PRIVACY_VERSION } from '@/lib/privacy';
import { normalizePhoneNumber } from '@/lib/verification/phone';
import { useVerification } from '@/lib/verification/useVerification';
import { getOrCreateSessionId, getGclid } from '@/lib/attribution';
import { fireFormCompleteConversion, fireLeadVerifiedWithEnhancement } from '@/lib/gtag';
import { getFlowVariant } from '@/lib/flow-randomization';

// Feature toggle for schwerpunkte
const SHOW_SCHWERPUNKTE = process.env.NEXT_PUBLIC_SHOW_SCHWERPUNKTE === 'true';

const LS_KEYS = {
  data: 'kh_wizard_data',
  step: 'kh_wizard_step',
  sessionId: 'kh_form_session_id',
} as const;

export type WizardData = Omit<Screen1Values, 'email'> & Screen1_5Values & ScreenSchwerpunkteValues & ScreenPaymentInfoValues & ScreenCredentialOptInValues & {
  email?: string; // Make email optional since we might use phone instead
  // Step 2: What Brings You (optional) - now first step for Concierge
  additional_info?: NewScreen3Values['additional_info'];
  // Step 2.5: Schwerpunkte (feature-toggled)
  schwerpunkte?: string[];
  // Step 2.6: Payment info - defined in ScreenPaymentInfoValues
  // Step 3: Modality
  modality_matters?: boolean;
  methods?: string[];
  // Step 4: Location
  city?: string;
  online_ok?: boolean;
  session_preference?: 'online' | 'in_person' | 'either';
  language_preference?: 'deutsch' | 'englisch' | 'any';
  // Step 5: Preferences (gender only)
  gender?: 'Frau' | 'Mann' | 'Keine Präferenz';
  // Step 6: Contact Info
  name: string;
};

// Progress: 6 main steps (or 7 with SMS verification) - step 1 (Timeline) removed
// Step 2/2.5: Topic (0%), 3: Modality (17%), 4: Location (33%),
// 5: Preferences (50%), 6: Contact (67%), 6.5: SMS (83%), 7: Confirmation (100%)
// Map by step number for clarity after removing step 1
const PROGRESS_MAP: Record<number, number> = {
  2: 0, 2.5: 0,     // First step (Topic/Schwerpunkte)
  2.6: 8,           // Payment info
  3: 17,            // Modality
  4: 33,            // Location
  5: 50,            // Preferences
  5.5: 58,          // Credential opt-in
  5.75: 62,         // Match preview (progressive disclosure)
  6: 72,            // Contact (phone-only)
  6.5: 82,          // SMS verification
  6.75: 92,         // Name + email (post-verification)
  7: 100, 8: 100, 8.5: 100, 9: 100,  // Confirmation (legacy step numbers)
};

export default function SignupWizard() {
  const searchParams = useSearchParams();
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

  // CRITICAL: Re-capture variant from URL after mount to handle hydration correctly.
  // During SSR, window is undefined so capturedVariant is null. During hydration,
  // React doesn't re-run useState initializer, so we need useEffect to capture it.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlVariant = params.get('variant') || params.get('v') || null;
      if (urlVariant && urlVariant !== capturedVariant) {
        setCapturedVariant(urlVariant);
      }
    } catch { /* ignore */ }
  }, [capturedVariant]);

  // Resolve flow variant: raw URL param → getFlowVariant handles randomization + localStorage
  const urlVariant = capturedVariant || searchParams.get('variant') || searchParams.get('v');
  const variant = getFlowVariant(urlVariant);
  const isProgressive = variant === 'progressive';
  const isConcierge = variant === 'concierge';
  
  // Test 5: Online mode - skips location step and pre-selects online
  const isOnlineMode = searchParams.get('mode') === 'online';
  // Variant-aware step routing:
  // - All variants now start with Schwerpunkte (step 2.5) - lower friction entry
  // - Concierge ALSO shows "What Brings You" (step 2) after Schwerpunkte for manual curation context
  // - Self-Service skips "What Brings You" and goes straight to Modality
  const usesSchwerpunkteStep = true; // All variants use Schwerpunkte as first step
  const usesWhatBringsYouStep = isConcierge; // Only Concierge gets open text field
  // All users go through 9-step verification flow before matches
  const maxStep = 9;

  // Step 1 (Timeline) removed - wizard now starts at step 2.5 (Schwerpunkte) for all variants
  const [step, setStep] = React.useState<number>(2.5);
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
  const [resendAttempts, setResendAttempts] = React.useState(0);
  // SMS fallback for email users who can't receive email
  const [smsFallbackStep, setSmsFallbackStep] = React.useState<'phone' | 'code' | null>(null);
  const [smsFallbackPhone, setSmsFallbackPhone] = React.useState('');
  const [smsFallbackCode, setSmsFallbackCode] = React.useState('');
  const [smsFallbackSubmitting, setSmsFallbackSubmitting] = React.useState(false);
  const [smsFallbackMessage, setSmsFallbackMessage] = React.useState('');

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

  // Progressive filtering: therapist count based on current filters
  const [therapistCount, setTherapistCount] = React.useState<number | null>(null);

  // Progressive disclosure: match preview data from questionnaire-submit
  const [anonymousPatientId, setAnonymousPatientId] = React.useState<string | null>(null);
  const [matchPreviews, setMatchPreviews] = React.useState<Array<{ firstName: string; photoUrl: string | null; schwerpunkte: string[] }>>([]);
  const [matchCount, setMatchCount] = React.useState(0);
  const [matchQuality, setMatchQuality] = React.useState<'exact' | 'partial' | 'none'>('none');

  // Fetch therapist count on mount and when filters change
  React.useEffect(() => {
    async function fetchCount() {
      try {
        // Build query params based on current wizard data
        const params = new URLSearchParams();
        
        // Add filters based on wizard progress
        if (data.session_preference) {
          params.set('session_preference', data.session_preference);
        }
        if (data.city) {
          params.set('city', data.city);
        }
        if (data.gender && data.gender !== 'Keine Präferenz') {
          const genderMap: Record<string, string> = {
            'Frau': 'female',
            'Mann': 'male',
          };
          params.set('gender_preference', genderMap[data.gender] || 'no_preference');
        }
        if (data.schwerpunkte && data.schwerpunkte.length > 0) {
          params.set('schwerpunkte', data.schwerpunkte.join(','));
        }
        if (data.accept_certified) {
          params.set('accept_certified', 'true');
        }

        const res = await fetch(`/api/public/therapists/count?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setTherapistCount(json.count ?? null);
        }
      } catch {
        // Silently fail - count is optional UI enhancement
      }
    }
    
    void fetchCount();
  }, [data.session_preference, data.city, data.gender, data.schwerpunkte, data.accept_certified]);

  // Shared verification hook for SMS code sending/verification
  // phoneFirst: only in progressive flow (name collected at step 6.75, after verification)
  // Classic flow collects name in step 6 (before verification), so name is required for sendCode
  const verification = useVerification({
    initialContactMethod: 'phone',
    phoneFirst: isProgressive,
    onTrackEvent: (event, props) => {
      void trackEvent(event, props);
    },
  });

  // Keep verification hook state in sync with wizard data to avoid race conditions
  // This ensures getContact() returns the correct value when sendCode is called
  React.useEffect(() => {
    if (data.phone_number) verification.setPhone(data.phone_number);
  }, [data.phone_number, verification]);

  React.useEffect(() => {
    if (data.name) verification.setName(data.name);
  }, [data.name, verification]);

  React.useEffect(() => {
    if (data.email) verification.setEmail(data.email);
  }, [data.email, verification]);

  React.useEffect(() => {
    if (data.contact_method) verification.setContactMethod(data.contact_method);
  }, [data.contact_method, verification]);

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
      // Step 1 removed - wizard now starts at step 2/2.5
      case 2: {
        // Step 2: What Brings You (TRULY OPTIONAL - no required fields)
        return [];
      }
      case 3: {
        // Step 3: Modality (optional)
        return [];
      }
      case 4: {
        // Step 4: Location + Language (session_preference required unless online mode, city required if in_person)
        // Test 5: Online mode pre-sets session_preference, so only validate it for non-online
        const miss: string[] = [];
        const hasCity = !!(d.city && d.city.trim());
        const pref = d.session_preference;
        // Skip session_preference validation in online mode (it's pre-set to 'online')
        if (!pref && !isOnlineMode) miss.push('session_preference');
        if ((pref === 'in_person' || pref === 'either') && !hasCity) miss.push('city');
        return miss;
      }
      case 5: {
        // Step 5: Preferences (NO REQUIRED fields - gender optional)
        return [];
      }
      case 6: {
        // Step 6 validation depends on flow variant:
        // Progressive: phone/email only (name collected later in step 6.75)
        // Classic: name + phone/email (full contact form)
        const miss: string[] = [];
        if (!isProgressive) {
          // Classic requires name in step 6
          if (!d.name || !d.name.trim()) miss.push('name');
        }
        if (d.contact_method === 'email') {
          if (!d.email) miss.push('email');
        } else if (d.contact_method === 'phone') {
          if (!d.phone_number) miss.push('phone_number');
        }
        return miss;
      }
      case 6.75: {
        // Step 6.75: Name required (post-verification)
        if (!d.name || !d.name.trim()) return ['name'];
        return [];
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
        setStep(usesSchwerpunkteStep ? 2.5 : 2);
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
      
      // Handle ?startStep= param (e.g., from Katherine's CTA to skip to step 2)
      const startStepParam = searchParams?.get('startStep');
      // Default to first step: Schwerpunkte (2.5) when enabled, otherwise What Brings You (2)
      const minStep = usesSchwerpunkteStep ? 2.5 : 2;
      const savedStepStr = localStorage.getItem(LS_KEYS.step);
      const savedStep = savedStepStr ? Number(savedStepStr) : minStep;
      // Use startStep if provided, otherwise use saved step
      const targetStep = startStepParam ? Number(startStepParam) : savedStep;
      // Clamp to valid range: 2-9 (step 1 removed), redirect step 1 to appropriate first step
      let clampedStep = targetStep <= 1 ? minStep : Math.min(maxStep, targetStep);

      // Returning concierge user detection: if concierge + has saved schwerpunkte + has contact info,
      // skip to step 2 ("What Brings You") regardless of saved step.
      // The user already filled the form — they only need the concierge-specific step.
      const parsedSaved = saved ? JSON.parse(saved) : null;
      const hasSavedSchwerpunkte = Array.isArray(parsedSaved?.schwerpunkte) && parsedSaved.schwerpunkte.length > 0;
      const hasSavedContact = !!(parsedSaved?.email || parsedSaved?.phone_number);
      if (isConcierge && !startStepParam && hasSavedSchwerpunkte && hasSavedContact) {
        clampedStep = 2;
        void trackEvent('concierge_returning_skip', { skipped_to: 2 });
      }

      setStep(clampedStep);
      
      // Clean up startStep from URL to avoid re-triggering on refresh
      if (startStepParam && typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('startStep');
        window.history.replaceState({}, '', url.pathname + url.search);
      }

      // Prefill contact info from existing verified session (kh_client cookie from EARTH-204)
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
            // Async returning concierge detection: if user had saved schwerpunkte but no contact
            // in localStorage (so synchronous check didn't trigger), the verified session provides
            // the contact info. Skip to step 2 if not already there.
            if (isConcierge && !startStepParam && hasSavedSchwerpunkte && !hasSavedContact) {
              setStep(prev => {
                if (prev !== 2) {
                  void trackEvent('concierge_returning_skip', { skipped_to: 2, source: 'session' });
                  return 2;
                }
                return prev;
              });
            }
          }
        })
        .catch(() => {
          // Ignore session check errors
        });

      // ?timing= param handling removed - start_timing question eliminated

      // Test 5: Handle ?mode=online param - pre-select online session preference
      const modeParam = searchParams?.get('mode');
      if (modeParam === 'online') {
        setData((prev) => ({ ...prev, session_preference: 'online', online_ok: true }));
        void trackEvent('online_mode_prefill', { mode: 'online' });
      }

      // Pre-fill modality from ?modality= param (from campaign landing pages) or ?kw= param (Google Ads)
      // Map slug/keyword → modality display name (must match METHODS array in NewScreen5_Modality)
      const modalityMap: Record<string, string> = {
        'narm': 'NARM (Entwicklungstrauma)',
        'hakomi': 'Hakomi',
        'somatic-experiencing': 'Somatic Experiencing',
        'somatic experiencing': 'Somatic Experiencing',
        'somatic': 'Somatic Experiencing',
        'core-energetics': 'Core Energetics',
        'core energetics': 'Core Energetics',
      };

      // Check ?modality= first (from campaign landing pages like /lp/narm)
      const modalityParam = searchParams?.get('modality');
      if (modalityParam && modalityMap[modalityParam.toLowerCase()]) {
        const matchedModality = modalityMap[modalityParam.toLowerCase()];
        setData((prev) => ({
          ...prev,
          modality_matters: true,
          methods: [matchedModality],
        }));
        void trackEvent('modality_prefill', { source: 'param', modality: matchedModality });
      } else {
        // Fallback to ?kw= param (from Google Ads keyword tracking)
        const kwParam = searchParams?.get('kw');
        if (kwParam) {
          const kw = decodeURIComponent(kwParam).toLowerCase();
          let matchedModality: string | null = null;
          for (const [keyword, modality] of Object.entries(modalityMap)) {
            if (kw.includes(keyword)) {
              matchedModality = modality;
              break;
            }
          }
          if (matchedModality) {
            setData((prev) => ({
              ...prev,
              modality_matters: true,
              methods: [matchedModality],
            }));
            void trackEvent('modality_prefill', { source: 'keyword', keyword: kw, modality: matchedModality });
          }
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
        let campaignVariant: string | undefined = undefined;
        const vParam = searchParams?.get('variant') || searchParams?.get('v') || undefined;
        const ref = (typeof document !== 'undefined' ? document.referrer : '') || '';
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

        if (vParam) {
          // Resolve through getFlowVariant so ?v=self-service → progressive/classic (not raw 'self-service')
          campaignVariant = getFlowVariant(vParam);
          // Determine source from referrer - /therapie-finden for concierge, /start for marketplace
          if (ref.includes('/therapie-finden')) {
            src = '/therapie-finden';
          } else if (ref.includes('/start')) {
            src = '/start';
          } else if (ref.includes('/lp/')) {
            src = ref.match(/\/lp\/[^/?#]+/)?.[0] || '/lp';
          } else {
            // Default based on variant: concierge → /therapie-finden, others → /start
            src = vParam === 'concierge' ? '/therapie-finden' : '/start';
          }
        }
        // Fallback to document.referrer for cases without variant param
        if (!src && !campaignVariant) {
          try {
            if (ref.includes('/therapie-finden')) {
              src = '/therapie-finden';
              // Try to extract variant from referrer URL (browsers may strip query params)
              try {
                const u = new URL(ref);
                const vp = u.searchParams.get('variant') || u.searchParams.get('v') || undefined;
                campaignVariant = vp ? getFlowVariant(vp) : undefined;
              } catch { }
            } else if (ref.includes('/start')) {
              src = '/start';
              try {
                const u = new URL(ref);
                const vp = u.searchParams.get('variant') || u.searchParams.get('v') || undefined;
                campaignVariant = vp ? getFlowVariant(vp) : undefined;
              } catch { }
            } else if (ref.includes('/lp/')) {
              src = ref.match(/\/lp\/[^/?#]+/)?.[0] || '/lp';
              try {
                const u = new URL(ref);
                const vp = u.searchParams.get('variant') || u.searchParams.get('v') || undefined;
                campaignVariant = vp ? getFlowVariant(vp) : undefined;
              } catch { }
            }
          } catch { }
        }
        // Final fallback: use current pathname if still no source detected
        // This captures direct /fragebogen visits that bypass landing pages
        if (!src) {
          if (currentPath.includes('/fragebogen')) {
            src = '/fragebogen';
            // Mark as direct visit for analytics clarity
            campaignVariant = campaignVariant || 'direct';
          } else if (currentPath.includes('/therapie-finden')) {
            src = '/therapie-finden';
          } else if (currentPath.includes('/start')) {
            src = '/start';
          }
        }
        // Ensure variant has a sensible default when source is known but variant wasn't captured
        // Use flow randomization for consistent attribution (resolves to progressive/classic)
        if (src && !campaignVariant) {
          try {
            campaignVariant = getFlowVariant(null);
          } catch { }
        }
        // Final fallback: mark as direct only if truly unknown
        if (src && !campaignVariant && src === '/fragebogen') {
          campaignVariant = 'direct';
        }
        if (src) campaignSourceOverrideRef.current = src;
        if (campaignVariant) campaignVariantOverrideRef.current = campaignVariant;
        // Online campaign override: distinguish online campaign leads from self-service
        if (searchParams?.get('mode') === 'online') {
          campaignVariantOverrideRef.current = 'online';
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount
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

        // Fire Google Ads conversion for email-confirmed users
        // This fires the base gtag conversion FIRST, then triggers server-side enhancement
        // CRITICAL: Must fire client-side base conversion before enhancement for Google Ads matching
        const confirmedLeadId = idFromUrl || localStorage.getItem('leadId') || undefined;
        if (confirmedLeadId) {
          void fireLeadVerifiedWithEnhancement(confirmedLeadId, 'email');
        }
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

  // Fetch matchesUrl for verified users (phone, email-confirmed, or email-code-verified) on confirmation screen
  const [matchesUrl, setMatchesUrl] = React.useState<string | null>(null);
  const confirmParam = searchParams?.get('confirm');
  const isEmailConfirmed = confirmParam === '1' || confirmParam === 'success';
  const isEmailCodeVerified = data.contact_method === 'email' && verification.state.verified;
  React.useEffect(() => {
    if (step < 7) return;
    // Fetch for phone-verified users, email-confirmed users (magic link), or email-code-verified users
    const isPhoneVerified = data.contact_method === 'phone' && data.phone_verified;
    if (!isPhoneVerified && !isEmailConfirmed && !isEmailCodeVerified) return;

    fetch('/api/public/session')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.data?.matchesUrl) {
          setMatchesUrl(json.data.matchesUrl);
          // Auto-redirect verified email users to matches (skip intermediate CTA screen)
          if ((isEmailConfirmed || isEmailCodeVerified) && !isConcierge) {
            window.location.assign(json.data.matchesUrl);
          }
        }
      })
      .catch(() => { });
  }, [step, data.contact_method, data.phone_verified, isEmailConfirmed, isEmailCodeVerified, isConcierge]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- step/trackEvent intentionally omitted for stable callback
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- missingRequiredForStep is a stable function
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

  // SMS code sending using shared verification hook
  const handleSendSmsCode = React.useCallback(async (): Promise<boolean> => {
    if (!data.phone_number) return false;
    
    // Sync phone number to verification hook state
    verification.setPhone(data.phone_number);
    if (data.name) verification.setName(data.name);
    
    const result = await verification.sendCode({
      name: data.name?.trim(),
      formSessionId: sessionId || undefined,
    });
    
    // If API indicates fallback to email, return false to let user choose email
    if (result.fallbackToEmail) return false;
    
    return result.success;
  }, [data.phone_number, data.name, sessionId, verification]);

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

  // SMS code verification using shared verification hook
  const handleVerifySmsCode = React.useCallback(async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!data.phone_number) return { success: false, error: 'Keine Telefonnummer' };

    // Pass code directly to avoid stale-closure issue (setCode is async)
    const result = await verification.verifyCode(code);

    if (result.success) {
      saveLocal({ phone_verified: true });
      // Don't navigate here - caller will handle submit after verification
      return { success: true };
    }

    return { success: false, error: result.error || 'Ungültiger Code' };
  }, [data.phone_number, verification, saveLocal]);

  // Email code sending using shared verification hook
  // NOTE: email, name, and contactMethod are synced to verification hook via useEffects above.
  // By the time the user clicks submit, the hook state is already up-to-date.
  const handleSendEmailCode = React.useCallback(async (): Promise<boolean> => {
    if (!data.email) return false;

    const confirmRedirect = variant ? `/fragebogen?variant=${encodeURIComponent(variant)}` : '/fragebogen';
    const result = await verification.sendCode({
      name: data.name?.trim(),
      formSessionId: sessionId || undefined,
      redirect: confirmRedirect,
    });

    return result.success;
  }, [data.email, data.name, sessionId, variant, verification]);

  // Email code verification using shared verification hook
  const handleVerifyEmailCode = React.useCallback(async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!data.email) return { success: false, error: 'Keine E-Mail-Adresse' };

    // contactMethod and email are synced via useEffects above.
    // Pass code directly to avoid stale-closure issue (setCode is async).
    const result = await verification.verifyCode(code);

    if (result.success) {
      return { success: true };
    }

    return { success: false, error: result.error || 'Ungültiger Code' };
  }, [data.email, verification]);

  // Simple screen renderers
  function renderScreen() {
    switch (step) {
      // Step 1 (Timeline/start_timing) removed - wizard now starts at step 2.5 (Schwerpunkte)
      case 2:
        // Step 2: What Brings You - only for Concierge (after Schwerpunkte)
        // Self-Service users never see this step
        if (!usesWhatBringsYouStep) {
          safeGoToStep(3);
          return null;
        }
        return (
          <NewScreen3_WhatBringsYou
            values={{ additional_info: data.additional_info }}
            onChange={saveLocal}
            onBack={() => safeGoToStep(2.6)}
            onNext={() => safeGoToStep(3)}
            disabled={navLock || submitting}
            isReturning={isConcierge && !!(data.schwerpunkte && data.schwerpunkte.length > 0)}
          />
        );
      case 2.5:
        // Step 2.5: Schwerpunkte - first step for ALL variants
        // Goes to step 2.6 (Payment info) next
        return (
          <ScreenSchwerpunkte
            values={{ schwerpunkte: data.schwerpunkte }}
            onChange={saveLocal}
            onNext={() => safeGoToStep(2.6)}
            disabled={navLock || submitting}
            therapistCount={therapistCount}
          />
        );
      case 2.6:
        // Step 2.6: Payment info - asks about self-pay vs insurance
        // Concierge goes to step 2 (What Brings You) next
        // Self-Service goes to step 3 (Modality) next
        return (
          <ScreenPaymentInfo
            values={{ payment_preference: data.payment_preference }}
            onChange={(patch) => {
              saveLocal(patch);
              // Track payment preference selection
              if (patch.payment_preference) {
                void trackEvent('payment_preference_selected', {
                  preference: patch.payment_preference,
                  step: 2.6
                });
              }
            }}
            onBack={() => safeGoToStep(2.5)}
            onNext={() => safeGoToStep(usesWhatBringsYouStep ? 2 : 3)}
            disabled={navLock || submitting}
          />
        );
      case 3:
        // Step 3: Modality Preferences
        // Back goes to step 2 for Concierge, step 2.6 for Self-Service
        return (
          <NewScreen5_Modality
            values={{
              modality_matters: data.modality_matters,
              methods: data.methods,
            }}
            onChange={saveLocal}
            onBack={() => safeGoToStep(usesWhatBringsYouStep ? 2 : 2.6)}
            onNext={() => safeGoToStep(4)}
            suppressAutoAdvance={suppressAutoStep === 3}
            disabled={navLock || submitting}
          />
        );
      case 4:
        // Step 4: Location + Language (session preference + city + language)
        // Test 5: Online mode pre-selects session_preference but still shows language question
        return (
          <Screen3
            values={{
              city: data.city,
              online_ok: data.online_ok,
              session_preference: data.session_preference,
              language_preference: data.language_preference,
            }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => safeGoToStep(3)}
            onNext={() => safeGoToStep(5)}
            disabled={navLock || submitting}
            isOnlineMode={isOnlineMode}
          />
        );
      case 5:
        // Step 5: Preferences (gender only)
        return (
          <Screen4
            values={{
              gender: data.gender,
              methods: data.methods, // Keep for compatibility
            }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => safeGoToStep(4)}
            onNext={() => {
              // Modality page leads get both tiers automatically (skip opt-in)
              const src = campaignSourceOverrideRef.current || '';
              const isModalityPage = src.startsWith('/lp/') || src.startsWith('/therapie/');
              if (isModalityPage) {
                saveLocal({ accept_certified: true });
                // Progressive: anonymous submit + match preview; Classic: straight to contact
                if (isProgressive) {
                  void handleQuestionnaireAndPreview();
                } else {
                  safeGoToStep(6);
                }
              } else {
                safeGoToStep(5.5); // Credential opt-in for ALL variants
              }
            }}
            disabled={navLock || submitting}
          />
        );
      case 5.5:
        // Step 5.5: Credential tier opt-in (ALL variants)
        return (
          <ScreenCredentialOptIn
            values={{ accept_certified: data.accept_certified }}
            onChange={saveLocal}
            onBack={() => safeGoToStep(5)}
            onNext={() => {
              if (isProgressive) {
                // Progressive: anonymous submit → match preview at 5.75
                void handleQuestionnaireAndPreview();
              } else {
                // Classic: skip match preview, go straight to contact form
                safeGoToStep(6);
              }
            }}
            disabled={navLock || submitting}
          />
        );
      case 5.75:
        // Step 5.75: Match preview (progressive disclosure — show value before asking for PII)
        return (
          <ScreenMatchPreview
            matchCount={matchCount}
            matchQuality={matchQuality}
            matchPreviews={matchPreviews}
            patientSchwerpunkte={data.schwerpunkte || []}
            onNext={() => safeGoToStep(6)}
            onBack={() => safeGoToStep(5.5)}
          />
        );
      case 6:
        if (isProgressive) {
          // Progressive: Phone-only contact (name collected in step 6.75 after verification)
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
              onBack={() => safeGoToStep(5.75)}
              onNext={async () => {
                void trackEvent('phone_submitted', { step: 6, contact_method: data.contact_method, flow_variant: variant });
                if (data.contact_method === 'phone' && data.phone_number) {
                  try {
                    const sent = await handleSendSmsCode();
                    if (sent) {
                      safeGoToStep(6.5);
                    } else {
                      setSubmitError('SMS konnte nicht gesendet werden. Bitte versuche es erneut.');
                    }
                  } catch (err) {
                    console.error('Failed to send SMS:', err);
                    setSubmitError('SMS konnte nicht gesendet werden. Bitte versuche es erneut.');
                  }
                } else if (data.email) {
                  // Email: send email code, then go to code entry (step 6.5)
                  try {
                    const sent = await handleSendEmailCode();
                    if (sent) {
                      safeGoToStep(6.5);
                    } else {
                      setSubmitError('E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.');
                    }
                  } catch (err) {
                    console.error('Failed to send email code:', err);
                    setSubmitError('E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.');
                  }
                }
              }}
              disabled={navLock || submitting}
            />
          );
        }
        // Classic: Full contact form (name + email/phone toggle + consent + trust badges)
        return (
          <ScreenContactClassic
            values={{
              name: data.name,
              email: data.email,
              phone_number: data.phone_number,
              contact_method: data.contact_method,
            }}
            initialized={initialized}
            onChange={saveLocal}
            onBack={() => safeGoToStep(5.5)}
            onNext={async () => {
              void trackEvent('submit_clicked', { step: 6, contact_method: data.contact_method, flow_variant: variant });
              if (data.contact_method === 'phone' && data.phone_number) {
                // Phone: send SMS code, then verify
                try {
                  const sent = await handleSendSmsCode();
                  if (sent) {
                    safeGoToStep(6.5);
                  } else {
                    setSubmitError('SMS konnte nicht gesendet werden. Bitte versuche es erneut.');
                  }
                } catch (err) {
                  console.error('Failed to send SMS:', err);
                  setSubmitError('SMS konnte nicht gesendet werden. Bitte versuche es erneut.');
                }
              } else if (data.email) {
                // Email: send email code, then go to code entry (step 6.5)
                try {
                  const sent = await handleSendEmailCode();
                  if (sent) {
                    safeGoToStep(6.5);
                  } else {
                    setSubmitError('E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.');
                  }
                } catch (err) {
                  console.error('Failed to send email code:', err);
                  setSubmitError('E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.');
                }
              }
            }}
            disabled={navLock || submitting}
            therapistCount={therapistCount}
          />
        );
      case 6.5: {
        // Step 6.5: Verification code entry (SMS or email)
        const isPhoneVerification = data.contact_method === 'phone' && !!data.phone_number;
        const isEmailVerification = data.contact_method === 'email' && !!data.email;
        if (!isPhoneVerification && !isEmailVerification) {
          safeGoToStep(6);
          return null;
        }
        return (
          <Screen1_5
            phoneNumber={data.phone_number || ''}
            contactMethod={data.contact_method || 'phone'}
            contactDisplay={isEmailVerification ? data.email : undefined}
            onVerify={async (code: string) => {
              const result = isPhoneVerification
                ? await handleVerifySmsCode(code)
                : await handleVerifyEmailCode(code);
              if (result.success) {
                if (isProgressive) {
                  // Progressive: go to name+email collection (step 6.75)
                  safeGoToStep(6.75);
                } else {
                  // Classic: name already collected, submit directly
                  await handleSubmit();
                }
              }
              return result;
            }}
            onResend={async () => {
              if (isPhoneVerification) {
                await handleSendSmsCode();
              } else {
                await handleSendEmailCode();
              }
            }}
            onBack={() => safeGoToStep(6)}
            disabled={navLock || submitting}
          />
        );
      }
      case 6.75:
        // Step 6.75: Name + email collection (post-verification, progressive disclosure)
        return (
          <ScreenNameEmail
            values={{ name: data.name, email: data.email }}
            onChange={saveLocal}
            onBack={() => safeGoToStep(6)}
            onNext={async () => {
              void trackEvent('name_email_submitted', {
                has_name: !!(data.name && data.name.trim()),
                has_email: !!(data.email && data.email.trim()),
                flow_variant: variant,
              });
              await handleSubmit();
            }}
            emailAlreadyCollected={data.contact_method === 'email'}
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
                Du kannst jetzt Therapeut:innen kontaktieren und direkt Termine buchen.
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
        // Check connectivity before attempting
        if (!isOnline) {
          setResendMessage('Keine Internetverbindung. Bitte prüfe deine Verbindung und versuche es erneut.');
          return;
        }
        setResendSubmitting(true);
        setResendMessage('');
        try {
          void trackEvent('resend_attempted', { step: 9, email_domain: email.split('@')[1] });
          const res = await fetch('/api/public/leads/resend-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              form_session_id: sessionIdRef.current || undefined,
            }),
          });
          if (res.ok) {
            setResendAttempts((prev) => prev + 1);
            setResendMessage('E‑Mail versendet. Bitte Posteingang (auch Spam-Ordner) prüfen.');
          } else {
            setResendMessage('Anfrage fehlgeschlagen. Bitte versuche es erneut.');
          }
        } catch (err) {
          // Network error - fetch didn't complete
          const isNetworkError = err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Load failed'));
          if (isNetworkError || !navigator.onLine) {
            setResendMessage('Netzwerkfehler. Bitte prüfe deine Verbindung und versuche es erneut.');
          } else {
            setResendMessage('Etwas ist schiefgelaufen. Bitte versuche es erneut.');
          }
        } finally {
          setResendSubmitting(false);
        }
      }

      // SMS fallback handlers for email users
      async function handleSmsFallbackSendCode() {
        const phone = smsFallbackPhone.trim();
        if (!phone || !/^\+?[0-9\s\-()]{8,}$/.test(phone)) {
          setSmsFallbackMessage('Bitte gib eine gültige Telefonnummer ein.');
          return;
        }
        if (!isOnline) {
          setSmsFallbackMessage('Keine Internetverbindung.');
          return;
        }
        setSmsFallbackSubmitting(true);
        setSmsFallbackMessage('');
        try {
          void trackEvent('sms_fallback_send_code', { step: 9 });
          const res = await fetch('/api/public/verification/send-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contact: phone,
              contact_type: 'phone',
              form_session_id: sessionIdRef.current || undefined,
              lead_id: localStorage.getItem('leadId') || undefined,
            }),
          });
          if (res.ok) {
            setSmsFallbackStep('code');
            setSmsFallbackMessage('');
          } else {
            const j = await res.json().catch(() => ({}));
            setSmsFallbackMessage(j?.error || 'SMS konnte nicht gesendet werden.');
          }
        } catch {
          setSmsFallbackMessage('Netzwerkfehler. Bitte versuche es erneut.');
        } finally {
          setSmsFallbackSubmitting(false);
        }
      }

      async function handleSmsFallbackVerify() {
        const code = smsFallbackCode.trim();
        if (!code || code.length < 4) {
          setSmsFallbackMessage('Bitte gib den Code ein.');
          return;
        }
        setSmsFallbackSubmitting(true);
        setSmsFallbackMessage('');
        try {
          void trackEvent('sms_fallback_verify', { step: 9 });
          const res = await fetch('/api/public/verification/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contact: smsFallbackPhone.trim(),
              contact_type: 'phone',
              code,
              form_session_id: sessionIdRef.current || undefined,
              lead_id: localStorage.getItem('leadId') || undefined,
            }),
          });
          const j = await res.json().catch(() => ({}));
          if (res.ok && j?.data?.verified) {
            // Success - redirect to matches
            void trackEvent('sms_fallback_verified', { step: 9 });
            const matchesUrl = j?.data?.matches_url || localStorage.getItem('matchesUrl');
            if (matchesUrl) {
              window.location.assign(matchesUrl);
            } else {
              // Fallback to directory
              window.location.assign('/therapeuten');
            }
          } else {
            setSmsFallbackMessage(j?.error || 'Ungültiger Code. Bitte versuche es erneut.');
          }
        } catch {
          setSmsFallbackMessage('Netzwerkfehler. Bitte versuche es erneut.');
        } finally {
          setSmsFallbackSubmitting(false);
        }
      }

      return (
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">✓ Geschafft! Fast fertig</h2>
            <p className="text-base leading-relaxed text-gray-700">
              Bestätige deine E‑Mail, um Therapeut:innen zu kontaktieren und Termine zu buchen.
            </p>
          </div>

          {/* Feature Highlight Panel - Email confirmation callout */}
          <div className="relative overflow-hidden rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/40 to-pink-50/30 p-6 sm:p-8 shadow-lg shadow-indigo-100/30">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(35rem_18rem_at_40%_0%,rgba(99,102,241,0.09),transparent_65%)]" />
            <div className="space-y-3">
              <p className="text-base font-semibold text-gray-900">📧 Wichtig: Bitte bestätige deine E‑Mail‑Adresse</p>
              <p className="text-sm leading-relaxed text-gray-700">
                Wir haben dir gerade eine Bestätigungs-E-Mail geschickt. Bitte prüfe deinen Posteingang und klicke auf den Link, um fortzufahren. Therapeut:innen kommunizieren per E‑Mail.
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
          ) : smsFallbackStep === 'phone' ? (
            // SMS fallback: phone input
            <div className="space-y-3 rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4 sm:p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-700">📱 Bestätigung per SMS</p>
              <p className="text-xs text-gray-600">Gib deine Handynummer ein. Wir senden dir einen Bestätigungscode.</p>
              <div className="space-y-3">
                <input
                  type="tel"
                  value={smsFallbackPhone}
                  onChange={(e) => setSmsFallbackPhone(e.target.value)}
                  placeholder="+49 170 1234567"
                  className="h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  aria-label="Telefonnummer"
                />
                <Button
                  onClick={handleSmsFallbackSendCode}
                  disabled={smsFallbackSubmitting}
                  className="h-11 w-full text-base bg-emerald-600 hover:bg-emerald-700"
                >
                  {smsFallbackSubmitting ? 'Wird gesendet…' : 'Code per SMS senden'}
                </Button>
                {smsFallbackMessage && (
                  <p className="text-sm text-center text-red-600" aria-live="polite">{smsFallbackMessage}</p>
                )}
                <Button
                  variant="ghost"
                  onClick={() => setSmsFallbackStep(null)}
                  className="w-full text-sm text-gray-500"
                >
                  Zurück zur E-Mail-Bestätigung
                </Button>
              </div>
            </div>
          ) : smsFallbackStep === 'code' ? (
            // SMS fallback: code verification
            <div className="space-y-3 rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4 sm:p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-700">📱 Code eingeben</p>
              <p className="text-xs text-gray-600">Wir haben einen Code an {smsFallbackPhone} gesendet.</p>
              <div className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={smsFallbackCode}
                  onChange={(e) => setSmsFallbackCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-center tracking-widest focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  aria-label="Bestätigungscode"
                  autoComplete="one-time-code"
                />
                <Button
                  onClick={handleSmsFallbackVerify}
                  disabled={smsFallbackSubmitting}
                  className="h-11 w-full text-base bg-emerald-600 hover:bg-emerald-700"
                >
                  {smsFallbackSubmitting ? 'Wird geprüft…' : 'Bestätigen'}
                </Button>
                {smsFallbackMessage && (
                  <p className="text-sm text-center text-red-600" aria-live="polite">{smsFallbackMessage}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => { setSmsFallbackCode(''); handleSmsFallbackSendCode(); }}
                    disabled={smsFallbackSubmitting}
                    className="flex-1 text-sm text-gray-500"
                  >
                    Code erneut senden
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { setSmsFallbackStep('phone'); setSmsFallbackCode(''); setSmsFallbackMessage(''); }}
                    className="flex-1 text-sm text-gray-500"
                  >
                    Andere Nummer
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Default: email resend form
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
                {/* Show SMS fallback option after 1+ resend attempts */}
                {resendAttempts >= 1 && (
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">Noch immer keine E-Mail erhalten?</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSmsFallbackStep('phone');
                        void trackEvent('sms_fallback_started', { step: 9, resend_attempts: resendAttempts });
                      }}
                      className="w-full text-sm"
                    >
                      📱 Lieber per SMS bestätigen
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    })();
  }

  // Submit questionnaire after preferences — create anonymous patient, fetch match previews, navigate to 5.75
  async function handleQuestionnaireAndPreview() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSlow(false);
    const slowTimer = setTimeout(() => setSubmitSlow(true), 3000);

    try {
      void trackEvent('questionnaire_submitted', {
        step: 5,
        has_city: !!data.city,
        flow_variant: variant,
      });

      const sidHeader = webSessionIdRef.current || getOrCreateSessionId() || undefined;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sidHeader) headers['X-Session-Id'] = sidHeader;
      if (campaignSourceOverrideRef.current) headers['X-Campaign-Source-Override'] = campaignSourceOverrideRef.current;
      if (campaignVariantOverrideRef.current) headers['X-Campaign-Variant-Override'] = campaignVariantOverrideRef.current;

      const sessionPref = data.session_preference;
      // Map UI gender values to database enum values
      let backendGender: string | undefined = data.gender;
      if (data.gender === 'Frau') backendGender = 'female';
      else if (data.gender === 'Mann') backendGender = 'male';
      else if (data.gender === 'Keine Präferenz') backendGender = 'no_preference';

      const payload = {
        additional_info: data.additional_info,
        modality_matters: data.modality_matters,
        methods: data.methods || [],
        schwerpunkte: data.schwerpunkte || [],
        city: data.city,
        session_preference: sessionPref,
        gender: backendGender, // Use mapped value
        form_session_id: sessionIdRef.current || undefined,
        accept_certified: data.accept_certified,
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

      const patientId = json?.data?.patientId;
      const previews = json?.data?.matchPreviews || [];
      const count = json?.data?.matchCount || 0;
      const quality = json?.data?.matchQuality || 'none';

      // Store match preview data for step 5.75
      if (patientId) setAnonymousPatientId(patientId);
      setMatchPreviews(previews);
      setMatchCount(count);
      setMatchQuality(quality);

      // Persist patient ID for analytics and later linking
      if (patientId && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('anonymousPatientId', patientId);
        } catch { }
      }

      void trackEvent('questionnaire_completed', {
        match_quality: quality,
        match_count: count,
        patient_id: patientId,
        flow_variant: variant,
      });

      // Navigate to match preview (step 5.75) instead of redirecting
      safeGoToStep(5.75);

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
      // Preserve variant in confirmation link so wizard knows the flow type on return
      const confirmRedirect = variant ? `/fragebogen?variant=${encodeURIComponent(variant)}` : '/fragebogen';

      const submissionPayload = {
        type: 'patient' as const,
        ...(data.name && data.name.trim() ? { name: data.name.trim() } : {}),
        ...(data.contact_method === 'email' ? { email } : { phone_number: phone }),
        contact_method: data.contact_method,
        form_session_id: sessionIdRef.current || undefined,
        confirm_redirect_path: confirmRedirect,
        consent_share_with_therapists: true as const,
        privacy_version: PRIVACY_VERSION,
        ...(anonymousPatientId ? { anonymous_patient_id: anonymousPatientId } : {}),
        ...(sessionPref === 'either'
          ? { session_preferences: ['online', 'in_person'] }
          : sessionPref
            ? { session_preference: sessionPref }
            : {}),
      };
      const submission = leadSubmissionSchema.safeParse(submissionPayload);
      if (!submission.success) {
        const flat = submission.error.flatten();
        console.error('[SignupWizard] Validation failed:', flat, 'payload keys:', Object.keys(submissionPayload), 'phone raw:', data.phone_number);
        // Show field-specific message when possible
        const fieldKeys = Object.keys(flat.fieldErrors);
        if (fieldKeys.includes('phone_number')) {
          setSubmitError('Bitte gib eine gültige Handynummer ein.');
        } else if (fieldKeys.includes('email')) {
          setSubmitError('Bitte gib eine gültige E-Mail-Adresse ein.');
        } else if (flat.formErrors.length > 0 && (flat.formErrors as string[]).some(e => e.includes('email or phone'))) {
          setSubmitError(data.contact_method === 'phone'
            ? 'Bitte gib eine gültige Handynummer ein.'
            : 'Bitte gib eine gültige E-Mail-Adresse ein.');
        } else {
          setSubmitError('Fehlgeschlagen. Bitte Seite aktualisieren und erneut versuchen.');
        }
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

      // Fire client-side Google Ads form complete conversion (€4)
      try {
        fireFormCompleteConversion(leadId);
      } catch { }

      // For phone-verified users, fire the lead verified conversion with enhancement (€12)
      // Email users will fire this when they click the confirmation link (handled in confirm=1 detection)
      if (data.contact_method === 'phone' && data.phone_verified) {
        try {
          void fireLeadVerifiedWithEnhancement(leadId, 'sms');
        } catch { }
      }

      {
        const currentStep2 = data.contact_method === 'phone' ? 8.5 : 8;
        void trackEvent('submit_succeeded', { step: currentStep2, contact_method: data.contact_method, flow_variant: variant });
      }

      // Test 3: Always require verification before showing matches
      // The matchesUrl is stored in metadata.last_confirm_redirect_path by the leads API
      // After email/phone verification, user will be redirected to their matches
      const matchesUrl = (j?.data?.matchesUrl as string | undefined) || undefined;
      if (matchesUrl) {
        void trackEvent('matches_created_pending_verification', { instant_match: true, flow_variant: variant });
      }

      void trackEvent('form_completed', { steps: 8, flow_variant: variant });

      // Phone users: already verified via SMS, redirect to matches immediately
      if (data.contact_method === 'phone' && data.phone_verified && matchesUrl) {
        void trackEvent('redirect_to_matches', { contact_method: 'phone', instant_match: true });
        window.location.assign(matchesUrl);
        return;
      }

      // Email users (both code-verified and not-yet-verified): go to confirmation screen (step 7).
      // If email was verified via 6-digit code, the useEffect at step 7 will detect
      // verification.state.verified, fetch matchesUrl from session, and auto-redirect.
      goToStep(7);
    } catch {
      setSubmitError('Senden fehlgeschlagen. Bitte überprüfe deine Verbindung und versuche es erneut.');
    } finally {
      clearTimeout(slowTimer);
      setSubmitting(false);
    }
  }

  // Calculate progress value using step-based lookup
  const progressValue = React.useMemo(() => {
    return PROGRESS_MAP[step] ?? PROGRESS_MAP[Math.floor(step)] ?? 0;
  }, [step]);

  return (
    <div className="space-y-6">
      {/* Offline banner */}
      {!isOnline && (
        <div className="rounded-md border p-3 text-sm bg-yellow-50 border-yellow-200">
          Du bist offline. Wir speichern deine Eingaben lokal und synchronisieren sie automatisch, sobald du wieder online bist.
        </div>
      )}
      <ProgressBar value={progressValue} showLabel={step >= 2.5 && step < 7} />
      {renderScreen()}
      {/* Footer status with restart option */}
      <div className="flex items-center justify-between pt-2">
        {/* Restart button - only show when user has made progress and not on final confirmation steps */}
        {step > 2.5 && step < 7 ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Möchtest du wirklich von vorne beginnen? Alle bisherigen Eingaben werden gelöscht.')) {
                void trackEvent('wizard_restart_clicked', { from_step: step });
                localStorage.removeItem(LS_KEYS.data);
                localStorage.removeItem(LS_KEYS.step);
                localStorage.removeItem(LS_KEYS.sessionId);
                setData({ name: '' });
                setStep(usesSchwerpunkteStep ? 2.5 : 2);
                sessionIdRef.current = null;
                setSessionId(null);
              }
            }}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            Neu starten
          </button>
        ) : (
          <div />
        )}
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
