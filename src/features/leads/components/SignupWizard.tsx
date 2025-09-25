"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import ProgressBar from './ProgressBar';
import Screen1, { type Screen1Values } from './screens/Screen1';
import Screen2, { type Screen2Values } from './screens/Screen2';
import Screen3, { type Screen3Values } from './screens/Screen3';
import Screen4, { type Screen4Values } from './screens/Screen4';
import Screen5 from './screens/Screen5';
import { Button } from '@/components/ui/button';

const LS_KEYS = {
  data: 'kh_wizard_data',
  step: 'kh_wizard_step',
  sessionId: 'kh_form_session_id',
} as const;

export type WizardData = Screen1Values & {
  // Screen 2
  start_timing?: Screen2Values['start_timing'];
  kassentherapie?: Screen2Values['kassentherapie'];
  therapy_type?: Screen2Values['therapy_type'];
  what_missing?: string[];
  // Screen 3
  city?: string;
  online_ok?: boolean;
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

const PROGRESS = [0, 20, 50, 75, 90, 100];

export default function SignupWizard() {
  const searchParams = useSearchParams();
  const [step, setStep] = React.useState<number>(1);
  const [data, setData] = React.useState<WizardData>({ name: '', email: '' });
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const lastSyncedRef = React.useRef<string>('');
  const sessionIdRef = React.useRef<string | null>(null);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const loadedForSession = React.useRef<string | null>(null);
  const screenStartRef = React.useRef<number>(Date.now());
  const prevStepRef = React.useRef<number>(1);

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

  function missingRequiredForStep(s: number, d: WizardData): string[] {
    switch (s) {
      case 1: {
        const miss: string[] = [];
        if (!d.email) miss.push('email');
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
        const online = !!d.online_ok;
        if (!hasCity && !online) miss.push('location');
        return miss;
      }
      case 4: {
        const miss: string[] = [];
        if (!d.language) miss.push('language');
        if (d.language === 'Andere' && !(d.language_other && d.language_other.trim())) miss.push('language_other');
        return miss;
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
        if (parsed && typeof parsed === 'object') setData(parsed);
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
    } catch {}
    // Scroll to top initially
    window.scrollTo({ top: 0 });
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
        const keys = Object.keys(next) as Array<keyof WizardData>;
        for (const k of keys) {
          void trackEvent('field_change', { field: String(k), step });
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
      // Update refs and navigate
      const v = Math.max(1, Math.min(6, n));
      prevStepRef.current = current;
      screenStartRef.current = Date.now();
      try {
        localStorage.setItem(LS_KEYS.step, String(v));
      } catch {}
      // Scroll to top on navigation
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return v;
    });
  }, []);

  // Fire screen_viewed on step changes
  React.useEffect(() => {
    void trackEvent('screen_viewed', { step });
  }, [step, trackEvent]);

  // Backend autosave every 30s when data changes
  React.useEffect(() => {
    const interval = setInterval(async () => {
      const json = JSON.stringify({ ...data, step });
      if (json === lastSyncedRef.current) return;
      lastSyncedRef.current = json;
      setSaving(true);
      try {
        const payload = { data: { ...data, step }, email: data.email || undefined };
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

  // Simple screen renderers (only Screen 1 fully implemented now)
  function renderScreen() {
    switch (step) {
      case 1:
        return (
          <Screen1
            values={{ name: data.name, email: data.email }}
            onChange={saveLocal}
            onNext={() => goToStep(2)}
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
            onBack={() => goToStep(1)}
            onNext={() => goToStep(3)}
          />
        );
      case 3:
        return (
          <Screen3
            values={{
              city: data.city,
              online_ok: data.online_ok,
              budget: data.budget,
              privacy_preference: data.privacy_preference,
            }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => goToStep(2)}
            onNext={() => goToStep(4)}
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
            onBack={() => goToStep(3)}
            onNext={() => goToStep(5)}
          />
        );
      case 5:
        return (
          <Screen5
            values={{ additional_info: data.additional_info }}
            onChange={(patch) => saveLocal(patch as Partial<WizardData>)}
            onBack={() => goToStep(4)}
            onNext={handleSubmit}
          />
        );
      case 6:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">✓ Geschafft! Deine Anfrage ist bei uns</h2>
            <p>Konstantin prüft persönlich deine Anfrage und sucht die besten Therapeut:innen für dich.</p>
            <p>Du bekommst deine Matches innerhalb von 24 Stunden.</p>
            <p className="font-medium">Wichtig: Bitte bestätige deine E-Mail-Adresse, damit wir dir deine Matches schicken können.</p>
            <div>
              <Button asChild className="h-12">
                <a href="/confirm" rel="nofollow">E-Mail wurde gesendet – jetzt checken</a>
              </Button>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Track completion for last screen before submit
      {
        const now = Date.now();
        const elapsed = now - (screenStartRef.current || now);
        const miss = missingRequiredForStep(5, data);
        void trackEvent('screen_completed', { step: 5, duration_ms: elapsed, missing_required: miss });
      }
      // Trigger email confirmation after completion (EARTH-190)
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'patient',
          name: data.name,
          email: data.email,
          form_session_id: sessionIdRef.current || undefined,
          confirm_redirect_path: '/fragebogen/confirmed',
        }),
      });
      if (!res.ok) throw new Error('Lead submit failed');
      void trackEvent('form_completed', { steps: 5 });
      // Go to final screen
      goToStep(6);
    } catch {
      // Friendly retry UI could be added here; keep minimal per step 1 delivery
      console.warn('Submit failed, staying on current step');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <ProgressBar value={PROGRESS[Math.max(0, Math.min(PROGRESS.length - 1, step - 1))]} />
      {renderScreen()}
      {/* Footer status only (per-screen navigation handles actions) */}
      <div className="flex items-center justify-end pt-2">
        <div className="text-sm text-muted-foreground">{saving ? 'Speichern…' : 'Gespeichert'}</div>
      </div>
    </div>
  );
}
