"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { therapistId: string; mode?: 'license' | 'certs' };

export default function UploadForm({ therapistId, mode = 'license' }: Props) {
  const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB
  const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5MB (profile photo)
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hasFiles, setHasFiles] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  // Track file selection to enable/disable submit button
  function handleFileChange() {
    const licenseInput = document.querySelector<HTMLInputElement>('#psychotherapy_license');
    const specInput = document.querySelector<HTMLInputElement>('#specialization_cert');
    const hasLicense = (licenseInput?.files?.length ?? 0) > 0;
    const hasSpec = (specInput?.files?.length ?? 0) > 0;
    setHasFiles(hasLicense || hasSpec);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    // Client-side validation for file sizes to avoid 413 from server
    const formEl = e.currentTarget;
    const licenseInput = formEl.querySelector<HTMLInputElement>("#psychotherapy_license");
    const specInput = formEl.querySelector<HTMLInputElement>("#specialization_cert");
    const licenseFile = licenseInput?.files?.[0];
    const specFiles = Array.from(specInput?.files || []);
    const profilePhotoInput = formEl.querySelector<HTMLInputElement>("#profile_photo");
    const profilePhoto = profilePhotoInput?.files?.[0];

    if (mode === 'license') {
      if (!licenseFile) {
        setMessage("Bitte lade deine staatliche Psychotherapie-Berechtigung hoch.");
        return;
      }
      if (licenseFile.size > MAX_FILE_BYTES) {
        setMessage("Datei zu groß (max. 4MB). Bitte reduziere die Dateigröße oder lade ein kleineres PDF/Bild hoch.");
        return;
      }
      const totalBytes = licenseFile.size;
      if (totalBytes > MAX_FILE_BYTES) {
        setMessage("Gesamtgröße der Dateien überschreitet 4MB. Bitte reduziere die Dateigröße.");
        return;
      }
    } else {
      // certs mode: require at least one file to be selected
      if (specFiles.length === 0) {
        setMessage("Bitte wähle mindestens ein Zertifikat aus.");
        return;
      }
      const tooLarge = specFiles.find((f) => f.size > MAX_FILE_BYTES);
      if (tooLarge) {
        setMessage("Ein Zertifikat überschreitet 4MB. Bitte reduziere die Dateigröße.");
        return;
      }
      const totalBytes = specFiles.reduce((sum, f) => sum + f.size, 0);
      if (totalBytes > MAX_FILE_BYTES) {
        setMessage("Gesamtgröße der Zertifikate überschreitet 4MB. Bitte lade eine Datei nach der anderen hoch.");
        return;
      }
    }

    // Optional profile photo validation (applies in both modes)
    if (profilePhoto && profilePhoto.size > PHOTO_MAX_BYTES) {
      setMessage("Profilfoto zu groß (max. 5MB). Bitte reduziere die Dateigröße.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch(`/api/public/therapists/${therapistId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (res.status === 413) {
        throw new Error("Datei zu groß (max. 4MB). Bitte reduziere die Dateigröße.");
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Upload fehlgeschlagen");
      if (mode === 'license') {
        // After license upload, advance to certificates step by reloading the page with a step hint
        const url = `/therapists/upload-documents/${therapistId}?step=certs&ts=${Date.now()}`;
        router.replace(url);
        // Hard fallback to bypass any caching issues
        setTimeout(() => { try { window.location.replace(url); } catch { /* noop */ } }, 0);
        return;
      }
      // Certificates uploaded successfully - redirect to completion
      setSubmitted(true);
      (e.target as HTMLFormElement).reset();
      requestAnimationFrame(() => {
        statusRef.current?.focus();
        statusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      // Auto-redirect to completion page after 2 seconds
      setTimeout(() => {
        window.location.href = `/therapists/onboarding-complete/${therapistId}`;
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
      setMessage(msg);
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {submitted ? (
        <div
          ref={statusRef}
          tabIndex={-1}
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 mb-6"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600">
              <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-emerald-900">Dokumente hochgeladen!</h2>
              <p className="text-sm text-emerald-800 mt-1">
                Deine Dokumente wurden übermittelt. Wird weitergeleitet...
              </p>
              {message && (
                <p className="text-xs text-emerald-700 mt-2">{message}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} encType="multipart/form-data" className="space-y-6" hidden={submitted}>
        <h2 className="text-2xl font-semibold">Dokumente</h2>
        {mode === 'license' ? (
          <div className="space-y-2">
            <Label htmlFor="psychotherapy_license">
              Staatlich anerkannte Psychotherapie-Berechtigung <span className="text-red-600">*</span>{" "}
              <span className="text-xs text-gray-500">(PDF/Bild, max. 4MB)</span>
            </Label>
            <Input id="psychotherapy_license" name="psychotherapy_license" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" required onChange={handleFileChange} />
            <p className="text-xs text-gray-500">Hinweis: Ein Abschlusszertifikat ist erforderlich. Wenn deine Dateien zusammen größer als 4MB sind, lade zuerst nur deine Zulassung hoch.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="specialization_cert">
              Abschlusszertifikat(e) deiner Therapieverfahren <span className="text-xs text-gray-500">(optional, je Datei max. 4MB)</span>
            </Label>
            <Input id="specialization_cert" name="specialization_cert" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" multiple onChange={handleFileChange} />
            <p className="text-xs text-gray-500">Du kannst Zertifikate auch später nachreichen.</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading || (mode === 'certs' && !hasFiles)}>
            {loading ? "Hochladen…" : "Dokumente hochladen"}
          </Button>
          {mode === 'license' && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSubmitted(true);
                setMessage("Du kannst die Zertifikate später hochladen. Die Profilprüfung startet erst nach Eingang der Zulassung als Psychotherapeut:in.");
                requestAnimationFrame(() => {
                  statusRef.current?.focus();
                  statusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            >
              Später hochladen
            </Button>
          )}
          {mode === 'certs' && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSubmitted(true);
                setMessage("Du kannst Zertifikate später hochladen. Dieser Schritt ist optional.");
                requestAnimationFrame(() => {
                  statusRef.current?.focus();
                  statusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                });
              }}
            >
              Später hochladen
            </Button>
          )}
        </div>

        <div aria-live="polite" role="status">
          {!submitted && message && <p className="text-sm text-red-600">{message}</p>}
        </div>
      </form>
    </div>
  );
}

