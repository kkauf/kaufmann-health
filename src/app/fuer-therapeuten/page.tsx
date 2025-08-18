import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Für Therapeuten | Kaufmann Health",
  description:
    "Werden Sie Teil unseres Therapeuten-Verzeichnisses. Kontakt: kontakt@kaufmann-health.de",
};

export default function TherapistsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Für Therapeuten</h1>
      <p className="mt-4 text-gray-600">
        Möchten Sie in unser Verzeichnis aufgenommen werden? Schreiben Sie uns eine E-Mail.
      </p>
      <div className="mt-6">
        <Button
          asChild
          size="lg"
          data-cta="therapists-email"
          data-audience="therapists"
        >
          <Link href="mailto:kontakt@kaufmann-health.de?subject=Verzeichnis-Aufnahme&body=Bitte senden Sie mir Informationen zur Aufnahme in das Therapeuten-Verzeichnis.">
            E-Mail an info@kaufmann-health.de
          </Link>
        </Button>
      </div>
    </main>
  );
}
