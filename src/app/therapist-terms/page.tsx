import type { Metadata } from "next";
import { TermsBody, TERMS_TITLE } from "@/content/therapist-terms";

export const metadata: Metadata = {
  title: `${TERMS_TITLE} | Kaufmann Health`,
  description:
    "25% Erfolgsprovision für die ersten 10 Sitzungen pro vermitteltem Klienten, monatliche Berichterstattung, 1 Monat Kündigungsfrist.",
  alternates: { canonical: "/therapist-terms" },
  openGraph: {
    title: TERMS_TITLE,
    description:
      "25% Erfolgsprovision (erste 10 Sitzungen), monatliche Berichterstattung, Kündigungsfrist 1 Monat.",
  },
};

export default function TherapistTermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{TERMS_TITLE}</h1>
      <TermsBody />
    </main>
  );
}
