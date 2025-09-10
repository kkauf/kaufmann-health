"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { therapistId: string; mode?: 'license' | 'certs' };

export default function UploadForm({ therapistId, mode = 'license' }: Props) {
  const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    // Client-side validation for file sizes to avoid 413 from server
    const formEl = e.currentTarget;
    const licenseInput = formEl.querySelector<HTMLInputElement>("#psychotherapy_license");
    const specInput = formEl.querySelector<HTMLInputElement>("#specialization_cert");
    const licenseFile = licenseInput?.files?.[0];
    const specFiles = Array.from(specInput?.files || []);

    if (mode === 'license') {
      if (!licenseFile) {
        setMessage("Bitte laden Sie Ihre staatliche Psychotherapie-Berechtigung hoch.");
        return;
      }
      if (licenseFile.size > MAX_FILE_BYTES) {
        setMessage("Datei zu groß (max. 4MB). Bitte reduzieren Sie die Dateigröße oder laden Sie ein kleineres PDF/Bild hoch.");
        return;
      }
      const totalBytes = licenseFile.size;
      if (totalBytes > MAX_FILE_BYTES) {
        setMessage("Gesamtgröße der Dateien überschreitet 4MB. Bitte reduzieren Sie die Dateigröße.");
        return;
      }
    } else {
      // certs mode: require at least one certificate
      if (specFiles.length === 0) {
        setMessage("Bitte laden Sie mindestens ein Abschlusszertifikat hoch.");
        return;
      }
      const tooLarge = specFiles.find((f) => f.size > MAX_FILE_BYTES);
      if (tooLarge) {
        setMessage("Ein Zertifikat überschreitet 4MB. Bitte reduzieren Sie die Dateigröße.");
        return;
      }
      const totalBytes = specFiles.reduce((sum, f) => sum + f.size, 0);
      if (totalBytes > MAX_FILE_BYTES) {
        setMessage("Gesamtgröße der Zertifikate überschreitet 4MB. Bitte laden Sie eine Datei nach der anderen hoch.");
        return;
      }
    }

    const formData = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch(`/api/therapists/${therapistId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (res.status === 413) {
        throw new Error("Datei zu groß (max. 4MB). Bitte reduzieren Sie die Dateigröße.");
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Upload fehlgeschlagen");
      setSubmitted(true);
      (e.target as HTMLFormElement).reset();
      requestAnimationFrame(() => {
        statusRef.current?.focus();
        statusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
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
          className="rounded-lg border bg-white p-4 mb-6"
          aria-live="polite"
        >
          <h2 className="text-lg font-semibold">Dokumente hochgeladen</h2>
          <p className="text-sm text-gray-700 mt-2">
            Ihre Dokumente wurden übermittelt. Wir prüfen diese und melden uns in 24h.
          </p>
          {message && (
            <p className="text-xs text-gray-600 mt-2">{message}</p>
          )}
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
            <Input id="psychotherapy_license" name="psychotherapy_license" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" required />
            <p className="text-xs text-gray-500">Hinweis: Ein Abschlusszertifikat ist erforderlich. Wenn Ihre Dateien zusammen größer als 4MB sind, laden Sie zuerst nur Ihre Zulassung hoch.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="specialization_cert">
              Abschlusszertifikat(e) Ihrer Therapieverfahren <span className="text-red-600">*</span>
              <span className="text-xs text-gray-500"> (je Datei max. 4MB)</span>
            </Label>
            <Input id="specialization_cert" name="specialization_cert" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" multiple required />
            <p className="text-xs text-gray-500">Mindestens ein Zertifikat ist erforderlich.</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Hochladen…" : "Dokumente hochladen"}
          </Button>
          {mode === 'license' && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSubmitted(true);
                setMessage("Sie können die Zertifikate später hochladen. Die Profilprüfung startet erst nach Eingang der Zulassung als Psychotherapeut.");
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

