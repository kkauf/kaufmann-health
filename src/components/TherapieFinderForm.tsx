'use client';

import { useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrCreateSessionId } from '@/lib/attribution';
import Link from 'next/link';
import { getEmailError } from '@/lib/validation';
import { ShieldCheck, Lock, UserCheck } from 'lucide-react';
import { buildEventId } from '@/lib/analytics';
// CTA form for Therapie-Finder landing

// Keep in sync with Datenschutz "Stand/Version" for consent proof
const PRIVACY_VERSION = '2025-09-01.v1';

export default function TherapieFinderForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const startedTracked = useRef(false);

  // Multi-step state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1 fields
  const [name, setName] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [cityChoice, setCityChoice] = useState(''); // major cities or 'other'
  const [cityOther, setCityOther] = useState('');

  // Step 2 fields
  const [issue, setIssue] = useState('');
  const [isSelfPay, setIsSelfPay] = useState<null | boolean>(null);

  // Step 3 fields
  const [sessionFormat, setSessionFormat] = useState<'online' | 'in_person' | 'both' | ''>('');
  const [genderPreference, setGenderPreference] = useState<'male' | 'female' | 'no_preference' | ''>('');

  function getCityValue() {
    const c = cityChoice === 'other' ? cityOther.trim() : cityChoice.trim();
    return c || undefined;
  }

  function validateStep1() {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = 'Bitte geben Sie Ihren Namen ein.';
    const emailErr = getEmailError(emailValue.trim());
    if (emailErr) nextErrors.email = emailErr;
    if (!getCityValue()) nextErrors.city = 'Bitte geben Sie Ihre Stadt ein.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateStep2() {
    const nextErrors: Record<string, string> = {};
    if (isSelfPay === null) nextErrors.is_self_pay = 'Bitte treffen Sie eine Auswahl.';
    setErrors(nextErrors);
    // Issue is optional. Allow proceed if self-pay is selected and not false
    return Object.keys(nextErrors).length === 0 && isSelfPay !== false;
  }

  async function logEvent(type: string, id: string, properties?: Record<string, unknown>) {
    try {
      const body = JSON.stringify({
        type,
        id,
        session_id: getOrCreateSessionId(),
        properties,
      });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon('/api/events', blob);
      } else {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        });
      }
    } catch {}
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setErrors({});

    // Validate steps before submission
    if (currentStep < 3) {
      // Defensive: prevent submit via Enter on earlier steps
      return;
    }

    const form = new FormData(e.currentTarget);
    const cityVal = getCityValue();
    const sessionPrefSingle = sessionFormat === 'online' || sessionFormat === 'in_person' ? sessionFormat : undefined;
    const sessionPrefs = sessionFormat === 'both' ? ['online', 'in_person'] : [];
    const payload = {
      name: name.trim() || undefined,
      email: emailValue.trim(),
      phone: form.get('phone')?.toString() || undefined,
      city: cityVal,
      session_preference: sessionPrefSingle,
      session_preferences: sessionPrefs,
      issue: issue.trim() || undefined,
      gender_preference: genderPreference || undefined,
      // Collect selected modalities as slugs the API expects
      specializations: (form.getAll('specializations') || []).map((v) => String(v)),
      session_id: getOrCreateSessionId(),
      // GDPR consent for sharing with therapists (explicit, patient leads)
      consent_share_with_therapists: true,
      privacy_version: PRIVACY_VERSION,
    } as Record<string, unknown>;

    // Client-side validation
    const nextErrors: Record<string, string> = {};
    const email = (payload.email as string).trim();
    const emailErr = getEmailError(payload.email as string);
    if (emailErr) nextErrors.email = emailErr;
    if (!payload.name) nextErrors.name = 'Bitte geben Sie Ihren Namen ein.';
    if (!payload.city) nextErrors.city = 'Bitte geben Sie Ihre Stadt ein.';
    // For session format: allow empty, but if user selected, it's already in state
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Request failed');
      setSubmitted(true);
      setSubmittedEmail(email);
      // High-level conversion tracking (cookieless)
      try { track('Lead Submitted'); } catch {}
      requestAnimationFrame(() => {
        statusRef.current?.focus();
        statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      (e.target as HTMLFormElement).reset();
      // Reset local state
      setName('');
      setEmailValue('');
      setCityChoice('');
      setCityOther('');
      setIssue('');
      setIsSelfPay(null);
      setSessionFormat('');
      setGenderPreference('');
      setCurrentStep(1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Senden.';
      const map: Record<string, string> = {
        'Invalid email': 'Bitte geben Sie eine gültige E‑Mail-Adresse ein.',
        'Rate limited': 'Zu viele Anfragen. Bitte versuchen Sie es in einer Minute erneut.',
        'Failed to save lead': 'Speichern fehlgeschlagen. Bitte später erneut versuchen.',
        'Invalid JSON': 'Ungültige Eingabe. Bitte Formular prüfen.',
        'Einwilligung zur Datenübertragung erforderlich':
          'Bitte stimmen Sie der Datenweitergabe an Therapeut:innen zu.',
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {submitted && (
        <Card ref={statusRef} tabIndex={-1} className="max-w-xl scroll-mt-28 mb-6">
          <CardHeader>
            <CardTitle>Anfrage erfolgreich</CardTitle>
            <CardDescription>Wir haben Ihre Anfrage erhalten.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Wir haben Ihnen eine Bestätigungs-E‑Mail{submittedEmail ? ` an ${submittedEmail}` : ''} gesendet. Bitte prüfen Sie auch Ihren SPAM‑Ordner, sollten Sie die E‑Mail nicht erhalten haben.
            </p>
            <p className="text-sm mt-3">
              Falls Ihre E‑Mail-Adresse falsch ist, schreiben Sie uns direkt: <a className="underline" href="mailto:kontakt@kaufmann-health.de">kontakt@kaufmann-health.de</a>.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/" className="underline text-sm">Zur Startseite</Link>
          </CardFooter>
        </Card>
      )}
      <form
        onSubmit={onSubmit}
        onFocus={() => {
          if (!startedTracked.current) {
            try { track('Lead Started'); } catch {}
            startedTracked.current = true;
          }
        }}
        className="space-y-6 max-w-xl"
        hidden={submitted}
      >
      {/* Step indicator */}
      <div>
        <p className="text-xs text-gray-600">Schritt {currentStep} von 3</p>
        <h2 className="text-xl font-semibold mt-1">{currentStep === 1 ? 'Wie können wir Ihnen helfen?' : currentStep === 2 ? 'Ihre Situation' : 'Ihre Präferenzen'}</h2>
      </div>

      {/* STEP 1 */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Spitzname oder Vorname</Label>
            <Input id="name" name="name" placeholder="Wie dürfen wir Sie ansprechen?" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : undefined} />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="city_select">Ihre Stadt</Label>
            <select
              id="city_select"
              className={
                "border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm" +
                (errors.city ? ' border-red-500 focus-visible:ring-red-500' : '')
              }
              value={cityChoice}
              onChange={(e) => setCityChoice(e.target.value)}
            >
              <option value="">Bitte auswählen</option>
              <option value="Berlin">Berlin</option>
              <option value="Hamburg">Hamburg</option>
              <option value="München">München</option>
              <option value="Köln">Köln</option>
              <option value="Frankfurt">Frankfurt</option>
              <option value="Stuttgart">Stuttgart</option>
              <option value="Düsseldorf">Düsseldorf</option>
              <option value="Leipzig">Leipzig</option>
              <option value="Dortmund">Dortmund</option>
              <option value="Bremen">Bremen</option>
              <option value="Dresden">Dresden</option>
              <option value="Hannover">Hannover</option>
              <option value="Nürnberg">Nürnberg</option>
              <option value="other">Andere Stadt…</option>
            </select>
            {cityChoice === 'other' && (
              <Input id="city_other" placeholder="Ihre Stadt (z.B. Potsdam)" value={cityOther} onChange={(e) => setCityOther(e.target.value)} aria-invalid={Boolean(errors.city)} className={errors.city ? 'border-red-500 focus-visible:ring-red-500 mt-2' : 'mt-2'} />
            )}
            {errors.city && <p className="text-xs text-red-600">{errors.city}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input id="email" name="email" type="email" placeholder="E-Mail-Adresse" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} aria-invalid={Boolean(errors.email)} className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : undefined} />
              {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefonnummer (optional)</Label>
              <Input id="phone" name="phone" type="tel" placeholder="Telefonnummer (optional)" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => {
                if (validateStep1()) {
                  void logEvent('form_step', buildEventId('/therapie-finden', 'form', 'step', '1-2'), { from: 1, to: 2 });
                  setCurrentStep(2);
                }
              }}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="issue">Was belastet Sie? (optional)</Label>
            <textarea
              id="issue"
              name="issue"
              rows={4}
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 w-full rounded-md border bg-white px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
              placeholder="Optional, aber hilft uns bei der Einordnung."
            />
          </div>

          <div className="space-y-2">
            <Label>Sind Sie Selbstzahler:in?</Label>
            <div className="flex gap-4 items-center text-sm">
              <label className="inline-flex items-center gap-2"><input type="radio" name="is_self_pay" value="yes" checked={isSelfPay === true} onChange={() => { setIsSelfPay(true); void logEvent('self_pay_confirmed', buildEventId('/therapie-finden', 'form', 'selfpay-confirm'), { step: 2 }); }} /> Ja</label>
              <label className="inline-flex items-center gap-2"><input type="radio" name="is_self_pay" value="no" checked={isSelfPay === false} onChange={() => { setIsSelfPay(false); void logEvent('self_pay_declined', buildEventId('/therapie-finden', 'form', 'selfpay-decline'), { step: 2 }); }} /> Nein</label>
            </div>
            {errors.is_self_pay && <p className="text-xs text-red-600">{errors.is_self_pay}</p>}
          </div>

          {isSelfPay === true && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded">
              <p className="text-sm text-gray-800">
                Wir arbeiten lediglich mit Privatzahlern. Das heißt keine Diagnosen in deiner Akte, keine Anträge, keine Rechtfertigung. Volle Diskretion und Freiheit in der Gestaltung deiner Therapie.
              </p>
            </div>
          )}

          {isSelfPay === false && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded">
              <p className="text-sm text-gray-800">
                Aktuell arbeiten wir nur mit Selbstzahler:innen. Wenn Sie über die gesetzliche Krankenkasse abrechnen möchten,
                wenden Sie sich bitte an Ihre Krankenkasse oder suchen Sie nach Kassensitzen in Ihrer Region.
              </p>
              <p className="text-xs text-gray-600 mt-2">Sie können uns jederzeit unter <a href="mailto:kontakt@kaufmann-health.de" className="underline">kontakt@kaufmann-health.de</a> schreiben.</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>Zurück</Button>
            <Button
              type="button"
              onClick={() => {
                if (validateStep2()) {
                  void logEvent('form_step', buildEventId('/therapie-finden', 'form', 'step', '2-3'), { from: 2, to: 3, is_self_pay: isSelfPay === true });
                  setCurrentStep(3);
                }
              }}
              disabled={isSelfPay === false}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session_format">Bevorzugte Sitzungsform</Label>
            <select
              id="session_format"
              className={
                "border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
              }
              value={sessionFormat}
              onChange={(e) => setSessionFormat(e.target.value as typeof sessionFormat)}
            >
              <option value="">Keine Präferenz</option>
              <option value="online">Online</option>
              <option value="in_person">Vor Ort (Praxis)</option>
              <option value="both">Beides</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Präferenz Therapeut:in</Label>
            <div className="flex gap-4 items-center text-sm">
              <label className="inline-flex items-center gap-2"><input type="radio" name="gender_preference" value="no_preference" checked={genderPreference === 'no_preference'} onChange={() => setGenderPreference('no_preference')} /> Keine Präferenz</label>
              <label className="inline-flex items-center gap-2"><input type="radio" name="gender_preference" value="female" checked={genderPreference === 'female'} onChange={() => setGenderPreference('female')} /> Weiblich</label>
              <label className="inline-flex items-center gap-2"><input type="radio" name="gender_preference" value="male" checked={genderPreference === 'male'} onChange={() => setGenderPreference('male')} /> Männlich</label>
            </div>
          </div>

          {/* Modality preferences (optional) */}
          <div className="space-y-2">
            <Label>Bevorzugte Methoden (optional)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="specializations" value="narm" className="h-4 w-4" />
                <span>NARM</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="specializations" value="hakomi" className="h-4 w-4" />
                <span>Hakomi</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="specializations" value="somatic-experiencing" className="h-4 w-4" />
                <span>Somatic Experiencing</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="specializations" value="core-energetics" className="h-4 w-4" />
                <span>Core Energetics</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>Zurück</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Senden…' : 'Jetzt Therapeuten finden →'}</Button>
          </div>

          <p className="mt-2 text-xs text-gray-600">
            Durch Absenden stimmen Sie der Weitergabe Ihrer Daten an passende Therapeuten zu. Details:{' '}
            <Link href="/datenschutz" className="underline">Datenschutzerklärung</Link>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700" aria-label="Vertrauen">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Geprüfte Profile
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-700" />
              Keine Cookies
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
              Transparente Datenverarbeitung
            </span>
          </div>
          <small className="block text-xs text-gray-600">100% kostenlos & unverbindlich</small>
        </div>
      )}

      {/* Non-success inline status */}
      {!submitted && message && <p className="text-sm text-red-600">{message}</p>}
      </form>
    </>
  );
}
