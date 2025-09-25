'use client';

import { useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { buildEventId } from '@/lib/analytics';
import { TERMS_VERSION } from '@/content/therapist-terms';
import { getAttribution } from '@/lib/attribution';
import { getOrCreateSessionId } from '@/lib/attribution';
import { getEmailError } from '@/lib/validation';
import Link from 'next/link';
import { ShieldCheck, Lock, UserCheck } from 'lucide-react';
import { COOKIES_ENABLED } from '@/lib/config';

// Re-export for tests to assert version consistency
export const THERAPIST_TERMS_VERSION = TERMS_VERSION;

function fireGoogleAdsTherapistConversion(leadId?: string) {
  try {
    const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    const label = process.env.NEXT_PUBLIC_GAD_CONV_THERAPIST;
    if (!adsId || !label) return;
    if (typeof window === 'undefined') return;

    const dedupeKey = leadId ? `ga_conv_therapist_registration${leadId}` : 'ga_conv_therapist_registration';
    try {
      if (window.sessionStorage.getItem(dedupeKey) === '1') return;
      if (window.localStorage.getItem(dedupeKey) === '1') return;
    } catch {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).gtag as ((...args: any[]) => void) | undefined;
    const sendTo = `${adsId}/${label}`;
    const payload: Record<string, unknown> = { send_to: sendTo, value: 25, currency: 'EUR' };
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
  } catch {}
}

export default function TherapistApplicationForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const startedTracked = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setSubmitted(false);
    setErrors({});

    const form = new FormData(e.currentTarget);
    // Honeypot field: if filled, silently accept and bail
    const honeypot = form.get('company')?.toString() || '';
    if (honeypot) {
      // Pretend success for bots; show success banner
      setSubmitted(true);
      requestAnimationFrame(() => {
        statusRef.current?.focus();
        statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    // Client-side validation (German messages)
    const emailRaw = form.get('email')?.toString();
    const emailErr = getEmailError(emailRaw);
    if (emailErr) {
      setErrors({ email: emailErr });
      return;
    }
    const email = (emailRaw || '').trim();
    const qualification = form.get('qualification')?.toString() || '';
    if (!qualification) {
      setErrors({ qualification: 'Bitte wähle deine Qualifikation.' });
      return;
    }
    const experience = form.get('experience')?.toString() || '';
    if (!experience) {
      setErrors({ experience: 'Bitte wähle deine Berufserfahrung.' });
      return;
    }

    // Sitzungsart erfassen (Pflicht, Mehrfachauswahl möglich)
    const session_preferences = form
      .getAll('session_preference')
      .map((v) => v.toString())
      .filter((v) => v === 'online' || v === 'in_person') as ('online' | 'in_person')[];
    if (session_preferences.length === 0) {
      setErrors({ session_preference: 'Bitte wähle deine Sitzungsart.' });
      return;
    }

    // Normalize website: auto-prefix https:// if missing
    let website = form.get('website')?.toString().trim();
    if (website) {
      // Treat bare protocol as empty
      if (/^https?:\/\/$/i.test(website)) {
        website = '';
      } else if (!/^https?:\/\//i.test(website)) {
        website = `https://${website}`;
      }
    }

    const specializations = form.getAll('specializations').map((v) => v.toString());
    // Require at least one modality (EARTH-71)
    if (specializations.length === 0) {
      setErrors({ specialization: 'Bitte wähle mindestens einen Schwerpunkt.' });
      return;
    }

    // Build JSON payload (EARTH-71)
    const sid = getOrCreateSessionId();
    const payload = {
      type: 'therapist',
      name: (form.get('name')?.toString() || '').trim() || undefined,
      email,
      phone: form.get('phone')?.toString() || undefined,
      notes: form.get('notes')?.toString() || undefined,
      city: (form.get('city')?.toString() || '').trim() || undefined,
      session_preferences,
      specializations,
      session_id: sid || undefined,
    };

    setLoading(true);
    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Request failed');

      const leadId = (json?.data?.id as string | undefined) || undefined;

      // Lightweight conversion tracking
      try {
        const builtId = buildEventId(
          typeof window !== 'undefined' ? window.location.pathname : '',
          'form',
          'submit',
          'therapist-apply'
        );
        const attrs = getAttribution();
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'therapist_apply_submitted', id: builtId, ...attrs }),
          keepalive: true,
        });
      } catch {}

      // Fire Google Ads conversion for therapist registration (client-side)
      fireGoogleAdsTherapistConversion(leadId);

      setSubmitted(true);
      // High-level cookieless analytics
      try { track('Therapist Application Submitted'); } catch {}
      setSubmittedEmail(email);
      requestAnimationFrame(() => {
        statusRef.current?.focus();
        statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Senden.';
      const map: Record<string, string> = {
        'Invalid email': 'Bitte gib eine gültige E‑Mail‑Adresse ein.',
        'Rate limited': 'Zu viele Anfragen. Bitte versuche es in einer Minute erneut.',
        'Failed to save lead': 'Speichern fehlgeschlagen. Bitte später erneut versuchen.',
        'Invalid JSON': 'Ungültige Eingabe. Bitte Formular prüfen.',
        'Missing required documents': 'Bitte lade alle erforderlichen Dokumente hoch.',
        'Unsupported file type': 'Dateityp nicht unterstützt. Erlaubt sind PDF, JPG oder PNG.',
        'File too large': 'Datei zu groß. Maximal 10MB erlaubt.',
      };
      if (map[msg]) {
        const friendly = map[msg];
        if (friendly.includes('E‑Mail-Adresse')) {
          setErrors({ email: friendly });
          setMessage(null);
        } else {
          setMessage(friendly);
        }
      } else {
        setMessage(msg);
      }
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {submitted && (
        <Card ref={statusRef} tabIndex={-1} className="max-w-2xl scroll-mt-28 mb-6">
          <CardHeader>
            <CardTitle>Registrierung erfolgreich</CardTitle>
            <CardDescription>Wir haben deine Registrierung erhalten.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Wir haben dir eine Bestätigungs‑E‑Mail{submittedEmail ? ` an ${submittedEmail}` : ''} gesendet. Bitte prüfe auch deinen SPAM‑Ordner, solltest du die E‑Mail nicht erhalten haben.
            </p>
            <p className="text-sm mt-3 font-medium">
              Dokumente‑Upload erforderlich für Aktivierung. Bitte öffne den Link in der E‑Mail, um deine Nachweise hochzuladen.
            </p>
            <p className="text-sm mt-3">
              Falls deine E‑Mail‑Adresse falsch ist, schreib uns direkt: <a className="underline" href="mailto:kontakt@kaufmann-health.de">kontakt@kaufmann-health.de</a>.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/" className="underline text-sm">Zur Startseite</Link>
          </CardFooter>
        </Card>
      )}
      <form
        id="apply-form"
        onSubmit={onSubmit}
        noValidate
        className="max-w-2xl scroll-mt-28 space-y-6"
        onFocus={() => {
          if (!startedTracked.current) {
            try { track('Therapist Applied'); } catch {}
            startedTracked.current = true;
          }
        }}
        hidden={submitted}
      >

      {/* Honeypot field (leave empty) */}
      <div className="sr-only" aria-hidden="true">
        <Label htmlFor="company">Firma</Label>
        <Input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Trust panel */}
      <div className="rounded-lg border bg-white p-4 sm:p-5">
        <h3 className="text-sm font-medium text-gray-800">Unser Versprechen</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
            <div>
              <p className="font-medium">Geprüfte Anfragen</p>
              <p className="text-xs text-gray-600">Qualifizierte, passende Klienten</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <Lock className="mt-0.5 h-4 w-4 text-slate-700" />
            <div>
              <p className="font-medium">{COOKIES_ENABLED ? 'Datenschutzfreundlich' : 'Keine Cookies'}</p>
              <p className="text-xs text-gray-600">{COOKIES_ENABLED ? 'Minimales Conversion‑Signal; keine Analytics‑Cookies.' : 'DSGVO‑konform, kein Tracking'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <UserCheck className="mt-0.5 h-4 w-4 text-indigo-600" />
            <div>
              <p className="font-medium">Transparente Daten</p>
              <p className="text-xs text-gray-600">Nutzung nur zur Vermittlung</p>
            </div>
          </div>
        </div>
      </div>

      {/* Compact two‑column layout */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Dein Name</Label>
          <Input id="name" name="name" placeholder="Vor- und Nachname" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Deine Stadt</Label>
          <Input id="city" name="city" placeholder="z. B. Berlin" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input id="email" name="email" type="email" placeholder="E-Mail-Adresse" aria-invalid={Boolean(errors.email)} className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : undefined} />
          {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefonnummer</Label>
          <Input id="phone" name="phone" type="tel" placeholder="Telefonnummer" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Webseite (optional)</Label>
          <Input id="website" name="website" type="text" placeholder="https://" />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Sitzungsart</legend>
          <div className="mt-1 flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="session_preference" value="online" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Online
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="session_preference" value="in_person" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Vor Ort (Praxis)
            </label>
          </div>
          <p className="text-xs text-gray-500">Wähle eine oder beide Optionen.</p>
          {errors.session_preference && <p className="text-xs text-red-600">{errors.session_preference}</p>}
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="qualification">Qualifikation</Label>
          <select
            id="qualification"
            name="qualification"
            defaultValue=""
            className={
              "border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm" +
              (errors.qualification ? ' border-red-500 focus-visible:ring-red-500' : '')
            }
          >
            <option value="" disabled>Bitte wählen</option>
            <option value="Heilpraktiker für Psychotherapie">Heilpraktiker für Psychotherapie</option>
            <option value="Approbierter Psychotherapeut">Approbierter Psychotherapeut</option>
          </select>
          {errors.qualification && <p className="text-xs text-red-600">{errors.qualification}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="experience">Berufserfahrung</Label>
          <select
            id="experience"
            name="experience"
            defaultValue=""
            className={
              "border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm" +
              (errors.experience ? ' border-red-500 focus-visible:ring-red-500' : '')
            }
          >
            <option value="" disabled>Bitte wählen</option>
            <option value="< 2 Jahre">Weniger als 2 Jahre</option>
            <option value="2-4 Jahre">2–4 Jahre</option>
            <option value="> 4 Jahre">Mehr als 4 Jahre</option>
          </select>
          {errors.experience && <p className="text-xs text-red-600">{errors.experience}</p>}
        </div>

        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">Schwerpunkte (mindestens einer erforderlich)</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="specializations" value="narm" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              NARM
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="specializations" value="hakomi" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Hakomi
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="specializations" value="somatic-experiencing" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Somatic Experiencing
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="specializations" value="core-energetics" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              Core Energetics
            </label>
          </div>
          <p className="text-xs text-gray-500">Bitte wähle mindestens einen Schwerpunkt aus.</p>
          {errors.specialization && <p className="text-xs text-red-600">{errors.specialization}</p>}
        </fieldset>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Bemerkungen (optional)</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            placeholder="Kurze Notiz (z.B. Spezialisierung, Verfügbarkeit)"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-amber-50 p-4 text-sm">
        <p className="text-gray-800">
          Mit dem Klick auf „Jetzt registrieren“ akzeptierst du unsere{' '}
          <a href="/therapist-terms" target="_blank" className="underline font-medium">
            25%-Provisionsvereinbarung
          </a>{' '}
          und{' '}
          <a href="/agb" target="_blank" className="underline font-medium">
            Allgemeinen Geschäftsbedingungen.
          </a>.
        </p>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Registrieren…' : 'Jetzt registrieren'}
      </Button>
      <small className="block text-xs text-gray-600">Erfolgsbasierte Konditionen. Keine Mindestlaufzeit.</small>

      {/* Non-success inline status for errors */}
      <div aria-live="polite" role="status">
        {!submitted && message && <p className="text-sm text-red-600">{message}</p>}
      </div>
    </form>
    </>
  );
}
