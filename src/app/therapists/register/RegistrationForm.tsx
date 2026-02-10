'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buildEventId } from '@/lib/analytics';
import { getAttribution } from '@/lib/attribution';
import { getOrCreateSessionId } from '@/lib/attribution';
import { getEmailError } from '@/features/leads/lib/validation';
import Link from 'next/link';
import { fireGoogleAdsTherapistConversion } from '@/lib/gtag';
import ConsentSection from '@/components/ConsentSection';

const STORAGE_KEY = 'kh_therapist_registration_draft';

type FormDraft = {
  name: string;
  email: string;
  phone: string;
  gender: string;
  qualification: string;
  specializations: string[];
};

export default function RegistrationForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [consentChecked, setConsentChecked] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const startedTracked = useRef(false);

  // Form state with localStorage persistence
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [qualification, setQualification] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);

  // Load draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const draft: FormDraft = JSON.parse(raw);
        if (draft.name) setName(draft.name);
        if (draft.email) setEmail(draft.email);
        if (draft.phone) setPhone(draft.phone);
        if (draft.gender) setGender(draft.gender);
        if (draft.qualification) setQualification(draft.qualification);
        if (Array.isArray(draft.specializations)) setSpecializations(draft.specializations);
      }
    } catch {}
  }, []);

  // Save draft on change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const draft: FormDraft = { name, email, phone, gender, qualification, specializations };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch {}
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [name, email, phone, gender, qualification, specializations]);

  const handleSpecializationChange = useCallback((value: string, checked: boolean) => {
    setSpecializations(prev =>
      checked ? [...prev, value] : prev.filter(s => s !== value)
    );
  }, []);

  const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    setSubmitted(false);
    setErrors({});

    // Honeypot check
    const form = new FormData(e.currentTarget);
    const honeypot = form.get('company')?.toString() || '';
    if (honeypot) {
      setSubmitted(true);
      requestAnimationFrame(() => {
        statusRef.current?.focus();
        statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    // Validation
    if (!name.trim()) {
      setErrors({ name: 'Bitte gib deinen Namen ein.' });
      return;
    }
    const emailErr = getEmailError(email);
    if (emailErr) {
      setErrors({ email: emailErr });
      return;
    }
    if (!qualification) {
      setErrors({ qualification: 'Bitte wähle deine Qualifikation.' });
      return;
    }
    if (!gender) {
      setErrors({ gender: 'Bitte wähle dein Geschlecht.' });
      return;
    }
    if (specializations.length === 0) {
      setErrors({ specialization: 'Bitte wähle mindestens einen Schwerpunkt.' });
      return;
    }
    if (!consentChecked) {
      setErrors({ consent: 'Bitte bestätige, dass du die AGB, den Maklervertrag und die Datenschutzerklärung gelesen hast.' });
      return;
    }

    const sid = getOrCreateSessionId();
    const payload = {
      type: 'therapist',
      name: name.trim() || undefined,
      email: email.trim(),
      phone: phone || undefined,
      specializations,
      qualification: qualification || undefined,
      gender,
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

      // Track conversion
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

      fireGoogleAdsTherapistConversion(leadId);

      // Clear draft on success
      try { localStorage.removeItem(STORAGE_KEY); } catch {}

      setSubmitted(true);
      try { track('Therapist Application Submitted'); } catch {}
      setSubmittedEmail(email);
      requestAnimationFrame(() => {
        statusRef.current?.focus();
        statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Senden.';
      const map: Record<string, string> = {
        'Invalid email': 'Bitte gib eine gültige E‑Mail‑Adresse ein.',
        'Rate limited': 'Zu viele Anfragen. Bitte versuche es in einer Minute erneut.',
        'Failed to save lead': 'Speichern fehlgeschlagen. Bitte später erneut versuchen.',
        'Invalid JSON': 'Ungültige Eingabe. Bitte Formular prüfen.',
      };
      if (map[msg]) {
        const friendly = map[msg];
        if (friendly.includes('E‑Mail')) {
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
  }, [name, email, phone, gender, qualification, specializations, consentChecked]);

  if (submitted) {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        aria-live="polite"
        className="rounded-lg border border-emerald-200 bg-emerald-50 p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600">
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-emerald-900">Registrierung erfolgreich!</h2>
            <p className="mt-1 text-sm text-emerald-800">
              Wir haben dir eine E-Mail{submittedEmail ? ` an ${submittedEmail}` : ''} gesendet.
            </p>
            <p className="mt-3 text-sm text-emerald-800">
              <strong>Nächster Schritt:</strong> Öffne den Link in der E-Mail, um dein Profil zu vervollständigen und deine Dokumente hochzuladen.
            </p>
            <p className="mt-4 text-sm text-emerald-700">
              Bitte prüfe auch deinen Spam-Ordner. Falls deine E-Mail-Adresse falsch ist, schreib uns an{' '}
              <a className="underline" href="mailto:kontakt@kaufmann-health.de">kontakt@kaufmann-health.de</a>.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              Zur Startseite
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-6"
      onFocus={() => {
        if (!startedTracked.current) {
          try { track('Therapist Applied'); } catch {}
          startedTracked.current = true;
        }
      }}
    >
      {/* Honeypot */}
      <div className="sr-only" aria-hidden="true">
        <Label htmlFor="company">Firma</Label>
        <Input id="company" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Dein Name *</Label>
          <Input
            id="name"
            name="name"
            placeholder="Vor- und Nachname"
            value={name}
            onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((prev) => { const { name: _, ...rest } = prev; return rest; }); }}
            aria-invalid={Boolean(errors.name)}
            className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : undefined}
          />
          {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefonnummer</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="Telefonnummer"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">E-Mail-Adresse *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="E-Mail-Adresse"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : undefined}
          />
          {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Geschlecht *</Label>
          <select
            id="gender"
            name="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className={
              "border-input placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm" +
              (errors.gender ? ' border-red-500 focus-visible:ring-red-500' : '')
            }
          >
            <option value="" disabled>Bitte wählen</option>
            <option value="female">Weiblich</option>
            <option value="male">Männlich</option>
            <option value="non-binary">Nicht-binär</option>
          </select>
          {errors.gender && <p className="text-xs text-red-600">{errors.gender}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="qualification">Qualifikation *</Label>
          <select
            id="qualification"
            name="qualification"
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            className={
              "border-input placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm" +
              (errors.qualification ? ' border-red-500 focus-visible:ring-red-500' : '')
            }
          >
            <option value="" disabled>Bitte wählen</option>
            <option value="Heilpraktiker für Psychotherapie">Heilpraktiker für Psychotherapie</option>
            <option value="Approbierte:r Psychotherapeut:in">Approbierte:r Psychotherapeut:in</option>
            <option value="Heilpraktiker:in">Heilpraktiker:in</option>
            <option value="Psychologische:r Berater:in">Psychologische:r Berater:in</option>
            <option value="Coach">Coach</option>
          </select>
          {errors.qualification && <p className="text-xs text-red-600">{errors.qualification}</p>}
        </div>

        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">Schwerpunkte * (mindestens einer)</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {[
              { value: 'narm', label: 'NARM' },
              { value: 'hakomi', label: 'Hakomi' },
              { value: 'somatic-experiencing', label: 'Somatic Experiencing' },
              { value: 'core-energetics', label: 'Core Energetics' },
            ].map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="specializations"
                  value={value}
                  checked={specializations.includes(value)}
                  onChange={(e) => handleSpecializationChange(value, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                {label}
              </label>
            ))}
          </div>
          {errors.specialization && <p className="text-xs text-red-600">{errors.specialization}</p>}
        </fieldset>
      </div>

      <div>
        <ConsentSection
          actor="therapist"
          compact={false}
          requireCheckbox={true}
          checked={consentChecked}
          onChange={setConsentChecked}
        />
        {errors.consent && <p className="mt-1 text-xs text-red-600">{errors.consent}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading || !consentChecked}>
          {loading ? 'Registrieren…' : 'Jetzt registrieren'}
        </Button>
        <span className="text-xs text-gray-500">Eingaben werden automatisch gespeichert</span>
      </div>
      <p className="text-xs text-gray-600">
        Erfolgsbasierte Provision (25% auf die ersten 10 Sitzungen). Keine Grundgebühr. Keine Mindestlaufzeit.
      </p>

      <div aria-live="polite" role="status">
        {message && <p className="text-sm text-red-600">{message}</p>}
      </div>
    </form>
  );
}
