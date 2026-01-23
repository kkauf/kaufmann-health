"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageCropper } from "@/components/ImageCropper";

type Props = {
  therapistId: string;
  showGender: boolean;
  showCity: boolean;
  showAcceptingNew: boolean;
  showApproachText: boolean;
  showProfilePhoto: boolean;
  showBillingAddress: boolean;
  defaults?: {
    gender?: string | null;
    city?: string | null;
    accepting_new?: boolean | null;
    approach_text?: string | null;
    billing_street?: string | null;
    billing_postal_code?: string | null;
    billing_city?: string | null;
  };
};

export default function ProfileForm({ therapistId, showGender, showCity, showAcceptingNew, showApproachText, showProfilePhoto, showBillingAddress, defaults }: Props) {
  const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [approach, setApproach] = useState<string>(defaults?.approach_text || "");
  const [gender, setGender] = useState<string>(defaults?.gender || "");
  const [city, setCity] = useState<string>(defaults?.city || "");
  const [acceptingNew, setAcceptingNew] = useState<boolean>(Boolean(defaults?.accepting_new));
  const [billingStreet, setBillingStreet] = useState<string>(defaults?.billing_street || "");
  const [billingPostalCode, setBillingPostalCode] = useState<string>(defaults?.billing_postal_code || "");
  const [billingCity, setBillingCity] = useState<string>(defaults?.billing_city || "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        if (typeof draft.billingStreet === 'string') setBillingStreet(draft.billingStreet);
        if (typeof draft.billingPostalCode === 'string') setBillingPostalCode(draft.billingPostalCode);
        if (typeof draft.billingCity === 'string') setBillingCity(draft.billingCity);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save every 30s
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const draft = { gender, city, approach, acceptingNew, billingStreet, billingPostalCode, billingCity };
        localStorage.setItem(storageKey, JSON.stringify(draft));
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, [storageKey, gender, city, approach, acceptingNew, billingStreet, billingPostalCode, billingCity]);

  const onPhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_PHOTO_BYTES) {
        setMessage('Profilfoto zu groß (max. 4MB). Bitte reduziere die Dateigröße.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      // Open cropper instead of directly setting preview
      const url = URL.createObjectURL(file);
      setCropperImageSrc(url);
      setShowCropper(true);
    }
  }, []);

  const onCropComplete = useCallback((croppedBlob: Blob) => {
    const croppedFile = new File([croppedBlob], 'profile-photo.jpg', { type: 'image/jpeg' });
    setPhotoFile(croppedFile);
    
    const url = URL.createObjectURL(croppedBlob);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    
    if (cropperImageSrc) URL.revokeObjectURL(cropperImageSrc);
    setCropperImageSrc(null);
    setShowCropper(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [cropperImageSrc]);

  const onCropCancel = useCallback(() => {
    if (cropperImageSrc) URL.revokeObjectURL(cropperImageSrc);
    setCropperImageSrc(null);
    setShowCropper(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [cropperImageSrc]);

  const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      // Validate required billing address fields
      if (showBillingAddress) {
        if (!billingStreet.trim() || !billingPostalCode.trim() || !billingCity.trim()) {
          throw new Error('Bitte fülle alle Felder der Rechnungsadresse aus.');
        }
      }

      const form = new FormData(e.currentTarget);
      // Include only fields that are shown
      if (!showGender) form.delete('gender'); else form.set('gender', gender);
      if (!showCity) form.delete('city'); else form.set('city', city);
      if (!showAcceptingNew) form.delete('accepting_new'); else form.set('accepting_new', acceptingNew ? 'true' : 'false');
      if (!showApproachText) form.delete('approach_text'); else form.set('approach_text', approach);

      // Include billing address fields
      if (showBillingAddress) {
        form.set('billing_street', billingStreet.trim());
        form.set('billing_postal_code', billingPostalCode.trim());
        form.set('billing_city', billingCity.trim());
      }

      // Use cropped photo file if available
      form.delete('profile_photo');
      if (showProfilePhoto && photoFile) {
        form.set('profile_photo', photoFile);
      }

      const res = await fetch(`/api/public/therapists/${therapistId}/profile`, {
        method: 'POST',
        body: form,
      });
      if (res.status === 413) {
        throw new Error('Profilfoto zu groß (max. 4MB). Bitte reduziere die Dateigröße.');
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Speichern fehlgeschlagen');
      setSubmitted(true);
      try { localStorage.removeItem(storageKey); } catch {}
      requestAnimationFrame(() => {
        statusRef.current?.focus();
        statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      // Auto-redirect to documents page after 2 seconds
      setTimeout(() => {
        window.location.href = `/therapists/upload-documents/${therapistId}`;
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Speichern fehlgeschlagen';
      setMessage(msg);
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  }, [
    therapistId,
    showGender,
    showCity,
    showAcceptingNew,
    showApproachText,
    showProfilePhoto,
    showBillingAddress,
    gender,
    city,
    acceptingNew,
    approach,
    billingStreet,
    billingPostalCode,
    billingCity,
    storageKey,
    photoFile,
  ]);

  const remaining = 500 - approach.length;

  return (
    <div className="rounded-lg border bg-white p-6">
      {submitted ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          aria-live="polite"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-6"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600">
              <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-emerald-900">Profil gespeichert!</h2>
              <p className="mt-1 text-sm text-emerald-800">Wird weitergeleitet zum Dokumente-Upload...</p>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} encType="multipart/form-data" className="space-y-6" hidden={submitted}>

        {showGender && (
          <div className="space-y-2">
            <Label htmlFor="gender">Was ist dein Geschlecht?</Label>
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

        {showBillingAddress && (
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Rechnungsadresse</Label>
              <p className="text-xs text-gray-500 mt-1">Wird für die Rechnungsstellung verwendet und nicht öffentlich angezeigt.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_street">Straße und Hausnummer</Label>
              <Input
                id="billing_street"
                name="billing_street"
                value={billingStreet}
                onChange={(e) => setBillingStreet(e.target.value)}
                placeholder="z.B. Musterstraße 123"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="billing_postal_code">PLZ</Label>
                <Input
                  id="billing_postal_code"
                  name="billing_postal_code"
                  value={billingPostalCode}
                  onChange={(e) => setBillingPostalCode(e.target.value)}
                  placeholder="12345"
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="billing_city">Stadt</Label>
                <Input
                  id="billing_city"
                  name="billing_city"
                  value={billingCity}
                  onChange={(e) => setBillingCity(e.target.value)}
                  placeholder="Berlin"
                  required
                />
              </div>
            </div>
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
            <Label htmlFor="approach_text">Dein therapeutischer Ansatz</Label>
            <textarea
              id="approach_text"
              name="approach_text"
              rows={6}
              maxLength={500}
              value={approach}
              onChange={(e) => setApproach(e.target.value)}
              placeholder="Beschreibe deinen therapeutischen Ansatz und wie du mit Klient:innen arbeitest..."
              className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
            <div className="text-xs text-gray-500 flex items-center justify-between">
              <span>Max. 500 Zeichen</span>
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
            <Label htmlFor="profile_photo">Profilfoto (JPG/PNG, max. 4MB)</Label>
            <p className="text-xs text-gray-500 mb-2">
              Du kannst das Foto nach dem Auswählen zuschneiden und zoomen.
            </p>
            <Input 
              ref={fileInputRef}
              id="profile_photo" 
              name="profile_photo" 
              type="file" 
              accept="image/jpeg,image/png,.jpg,.jpeg,.png" 
              onChange={onPhotoChange} 
            />
            {photoPreview && (
              <div className="mt-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="Vorschau" className="h-24 w-24 object-cover rounded-full border-2 border-emerald-500" />
                <span className="text-sm text-emerald-700">✓ Foto zugeschnitten</span>
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

      {/* Image Cropper Modal */}
      {showCropper && cropperImageSrc && (
        <ImageCropper
          imageSrc={cropperImageSrc}
          onCropComplete={onCropComplete}
          onCancel={onCropCancel}
          aspectRatio={1}
          cropShape="round"
        />
      )}
    </div>
  );
}
