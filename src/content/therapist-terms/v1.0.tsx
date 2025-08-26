import React from "react";

export const version = "v1.0";
export const title = "Provisionsvereinbarung für Therapeuten";
export const sourceFileName = "v1.0.tsx";

export default function TermsBody() {
  return (
    <>
      <p className="mt-3 text-gray-700">
        Diese Seite fasst die wesentlichen Vertragsbedingungen zusammen. Mit Klick auf „Jetzt registrieren&quot; in der
        Therapeuten-Registrierung akzeptieren Sie diese Bedingungen und unsere AGB.
      </p>

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="text-xl font-semibold">1. Vertragsgegenstand</h2>
          <p className="mt-2 text-gray-700">
            Kaufmann Health stellt über die Plattform Kontakt zwischen dem Auftragnehmer (Heilpraktiker für
            Psychotherapie bzw. Psychotherapeut) und interessierten Klienten her. Für erfolgreich vermittelte Klienten,
            die zu einer ersten Sitzung erscheinen, zahlt der Auftragnehmer eine erfolgsbasierte Provision.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">2. Provisionsregelung</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700">
            <li>Provisionshöhe: 25% des Bruttohonorars pro Sitzung</li>
            <li>Umfang: Für die ersten 10 Sitzungen eines vermittelten Klienten</li>
            <li>Obergrenze: Maximal 250% eines durchschnittlichen Sitzungshonorars pro vermitteltem Klienten</li>
            <li>Berechnungsgrundlage: Das dem Klienten berechnete Honorar</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold">3. Berichterstattung und Abrechnung</h2>
          <p className="mt-2 text-gray-700">
            Der Auftragnehmer verpflichtet sich zur monatlichen Berichterstattung über stattgefundene Sitzungen mit
            vermittelten Klienten und zur pünktlichen Zahlung der fälligen Provisionen. Die Abrechnung erfolgt
            monatlich, auf Basis der gemeldeten Sitzungen.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">4. Kündigung</h2>
          <p className="mt-2 text-gray-700">Kündigungsfrist: 1 Monat zum Monatsende.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">5. Datenschutz</h2>
          <p className="mt-2 text-gray-700">
            Wir verarbeiten personenbezogene Daten gemäß unserer Datenschutzerklärung. Bei Registrierung speichern wir
            Zeitpunkt, IP-Adresse (gehasht) und User Agent zu Nachweis- und Sicherheitszwecken.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold">6. Sonstiges</h2>
          <p className="mt-2 text-gray-700">
            Es gelten ergänzend unsere <a href="/agb" className="underline">AGB</a>. Diese Zusammenfassung dient der
            Transparenz. Maßgeblich sind die vertraglichen Bedingungen in ihrer jeweils gültigen Fassung.
          </p>
        </section>
      </div>
    </>
  );
}
