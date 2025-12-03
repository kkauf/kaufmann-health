"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";

export default function TherapistLoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/public/therapist-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Ein Fehler ist aufgetreten.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-800 font-medium">
          Falls ein Konto existiert, haben wir dir einen Login-Link per E-Mail gesendet.
        </p>
        <p className="text-xs text-emerald-700 mt-1">
          Bitte prüfe auch deinen Spam-Ordner.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="therapist-login-email" className="text-sm font-medium text-gray-700">
          E-Mail-Adresse
        </Label>
        <Input
          id="therapist-login-email"
          type="email"
          placeholder="deine@email.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-10"
        />
      </div>
      <Button 
        type="submit" 
        disabled={loading || !email.includes("@")}
        className="w-full h-10"
      >
        {loading ? (
          "Wird gesendet..."
        ) : (
          <>
            <LogIn className="h-4 w-4 mr-2" />
            Login-Link senden
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
