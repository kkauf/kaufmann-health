"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { therapistId: string };

export default function UploadForm({ therapistId }: Props) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fetch(`/api/therapists/${therapistId}/documents`, {
        method: "POST",
        body: formData,
      });
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
            Ihre Dokumente wurden übermittelt. Wir prüfen diese und melden uns innerhalb von 2 Werktagen.
          </p>
        </div>
      ) : null}

      <form onSubmit={onSubmit} encType="multipart/form-data" className="space-y-6" hidden={submitted}>
        <h2 className="text-2xl font-semibold">Dokumente</h2>
        <div className="space-y-2">
          <Label htmlFor="psychotherapy_license">
            Staatlich anerkannte Psychotherapie-Berechtigung <span className="text-red-600">*</span>{" "}
            <span className="text-xs text-gray-500">(PDF, max 10MB)</span>
          </Label>
          <Input id="psychotherapy_license" name="psychotherapy_license" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="specialization_cert">
            Abschlusszertifikate Ihrer Therapieverfahren
            <span className="text-xs text-gray-500">(NARM, Hakomi, etc.)</span>
          </Label>
          <Input id="specialization_cert" name="specialization_cert" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" multiple required />
          <p className="text-xs text-gray-500">Mindestens ein Zertifikat ist erforderlich. Mehrere Dateien möglich.</p>
        </div>

        <h2 className="text-2xl font-semibold mt-8">Profil vervollständigen</h2>
        <div className="space-y-2">
          <Label htmlFor="profile_photo">
            Professionelles Foto <span className="text-xs text-gray-500">(JPG/PNG, max 5MB)</span>
          </Label>
          <Input id="profile_photo" name="profile_photo" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" />
          <p className="text-xs text-gray-500">Klarer, professioneller Portraitausschnitt für Ihr Profil</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="approach_text">
            Ihr therapeutischer Ansatz <span className="text-xs text-gray-500">(2-3 Absätze)</span>
          </Label>
          <textarea
            id="approach_text"
            name="approach_text"
            rows={6}
            maxLength={2000}
            placeholder="Beschreiben Sie Ihren therapeutischen Ansatz und wie Sie mit Klient:innen arbeiten..."
            className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          <p className="text-xs text-gray-500">Fokus auf Methode und Herangehensweise, kein Lebenslauf.</p>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Hochladen…" : "Dokumente hochladen"}
        </Button>

        <div aria-live="polite" role="status">
          {!submitted && message && <p className="text-sm text-red-600">{message}</p>}
        </div>
      </form>
    </div>
  );
}

