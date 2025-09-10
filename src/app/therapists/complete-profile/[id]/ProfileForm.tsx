"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  therapistId: string;
  showGender: boolean;
  showCity: boolean;
  showAcceptingNew: boolean;
  showApproachText: boolean;
  showProfilePhoto: boolean;
  defaults?: {
    gender?: string | null;
    city?: string | null;
    accepting_new?: boolean | null;
    approach_text?: string | null;
  };
};

export default function ProfileForm({ therapistId, showGender, showCity, showAcceptingNew, showApproachText, showProfilePhoto, defaults }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [approach, setApproach] = useState<string>(defaults?.approach_text || "");
  const [gender, setGender] = useState<string>(defaults?.gender || "");
  const [city, setCity] = useState<string>(defaults?.city || "");
  const [acceptingNew, setAcceptingNew] = useState<boolean>(Boolean(defaults?.accepting_new));
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const storageKey = useMemo(() => `kh_profile_draft_${therapistId}`, [therapistId]);

  // Load draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (typeof draft.gender === 'string') setGender(draft.gender);
        if (typeof draft.city === 'string') setCity(draft.city);
        if (typeof draft.approach === 'string') setApproach(draft.approach);
        if (typeof draft.acceptingNew === 'boolean') setAcceptingNew(draft.acceptingNew);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save every 30s
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const draft = { gender, city, approach, acceptingNew };
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, [storageKey, gender, city, approach, acceptingNew]);

  const onPhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } else {
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, []);

  const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const form = new FormData(e.currentTarget);
      // Include only fields that are shown
      if (!showGender) form.delete('gender'); else form.set('gender', gender);
      if (!showCity) form.delete('city'); else form.set('city', city);
      if (!showAcceptingNew) form.delete('accepting_new'); else form.set('accepting_new', acceptingNew ? 'true' : 'false');
      if (!showApproachText) form.delete('approach_text'); else form.set('approach_text', approach);
      if (!showProfilePhoto) form.delete('profile_photo');

      const res = await fetch(`/api/therapists/${therapistId}/profile`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Speichern fehlgeschlagen');
      setSubmitted(true);
      try { localStorage.removeItem(storageKey); } catch {}
      requestAnimationFrame(() => {
        statusRef.current?.focus();
        statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Speichern fehlgeschlagen';
      setMessage(msg);
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  }, [therapistId, showGender, showCity, showAcceptingNew, showApproachText, showProfilePhoto, gender, city, acceptingNew, approach, storageKey]);

  const remaining = 2000 - approach.length;

  return (
    <div className="max-w-2xl">
      {submitted ? (
        <div ref={statusRef} tabIndex={-1} className="rounded-lg border bg-white p-4 mb-6" aria-live="polite">
          <h2 className="text-lg font-semibold">Profil aktualisiert</h2>
          <p className="text-sm text-gray-700 mt-2">Ihr Profil ist jetzt fast fertig. Als nächstes laden Sie bitte Ihre Lizenz hoch.</p>
          <div className="mt-3">
            <a className="underline" href={`/therapists/upload-documents/${therapistId}`}>Weiter: Dokumente hochladen</a>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} encType="multipart/form-data" className="space-y-6" hidden={submitted}>
        <div className="rounded-md border p-3 bg-amber-50 text-amber-900 text-sm">
          Fast geschafft! Ergänzen Sie die fehlenden Profilangaben. Das dauert nur 2–3 Minuten.
        </div>

        {showGender && (
          <div className="space-y-2">
            <Label htmlFor="gender">Geschlecht</Label>
            <select id="gender" name="gender" className="border-input w-full rounded-md border bg-white px-3 py-2 text-sm" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Bitte wählen</option>
              <option value="female">Weiblich</option>
              <option value="male">Männlich</option>
              <option value="diverse">Divers</option>
            </select>
          </div>
        )}

        {showCity && (
          <div className="space-y-2">
            <Label htmlFor="city">Stadt</Label>
            <Input id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="z.B. Berlin" />
          </div>
        )}

        {showAcceptingNew && (
          <div className="space-y-2">
            <Label htmlFor="accepting_new">Neue Klient:innen annehmen?</Label>
            <label className="flex items-center gap-2 text-sm">
              <input id="accepting_new" name="accepting_new" type="checkbox" className="h-4 w-4" checked={acceptingNew} onChange={(e) => setAcceptingNew(e.target.checked)} />
              <span>Ja, ich nehme neue Anfragen an</span>
            </label>
          </div>
        )}

        {showApproachText && (
          <div className="space-y-2">
            <Label htmlFor="approach_text">Ihr therapeutischer Ansatz</Label>
            <textarea
              id="approach_text"
              name="approach_text"
              rows={6}
              maxLength={2000}
              value={approach}
              onChange={(e) => setApproach(e.target.value)}
              placeholder="Beschreiben Sie Ihren therapeutischen Ansatz und wie Sie mit Klient:innen arbeiten..."
              className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
            <div className="text-xs text-gray-500 flex items-center justify-between">
              <span>Max. 2000 Zeichen</span>
              <span>{remaining} Zeichen verbleibend</span>
            </div>
            <div className="text-xs text-gray-600">
              Beispiele:
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>Fokus auf ressourcenorientierte, körperbasierte Arbeit (z.B. NARM, SE)</li>
                <li>Emotionsfokussierte Prozessbegleitung in sicherem Rahmen</li>
                <li>Klare Struktur: Orientierung – Vertiefung – Integration</li>
              </ul>
            </div>
          </div>
        )}

        {showProfilePhoto && (
          <div className="space-y-2">
            <Label htmlFor="profile_photo">Profilfoto (JPG/PNG, max 5MB)</Label>
            <Input id="profile_photo" name="profile_photo" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={onPhotoChange} />
            {photoPreview && (
              <div className="mt-2">
                <img src={photoPreview} alt="Vorschau" className="h-32 w-32 object-cover rounded-md border" />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading}>{loading ? 'Speichern…' : 'Profil speichern'}</Button>
          <span className="text-xs text-gray-500">Automatisches Zwischenspeichern alle 30s</span>
        </div>

        <div aria-live="polite" role="status">
          {!submitted && message && <p className="text-sm text-red-600">{message}</p>}
        </div>
      </form>
    </div>
  );
}
