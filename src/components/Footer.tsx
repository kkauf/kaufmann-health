import CookieSettingsLink from "@/components/CookieSettingsLink";

export default function Footer() {
  return (
    <footer className="border-t bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-8 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
          <section aria-labelledby="footer-contact">
            <h2 id="footer-contact" className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
              Kontakt
            </h2>
            <ul className="space-y-1">
              <li className="text-gray-800">Konstantin Kaufmann - Kaufmann Health</li>
              <li>
                Email:{" "}
                <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900" href="mailto:kontakt@kaufmann-health.de">
                  kontakt@kaufmann-health.de
                </a>
              </li>
            </ul>
          </section>
          <nav aria-labelledby="footer-legal">
            <h2 id="footer-legal" className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
              Rechtliches
            </h2>
            <ul className="space-y-1">
              <li>
                <a className="hover:text-gray-900" href="/impressum">Impressum</a>
              </li>
              <li>
                <a className="hover:text-gray-900" href="/agb">AGB</a>
              </li>
              <li>
                <a className="hover:text-gray-900" href="/datenschutz">Datenschutz</a>
              </li>
              <li>
                <CookieSettingsLink />
              </li>
            </ul>
          </nav>
          <section aria-labelledby="footer-about" className="sm:col-span-2 lg:col-span-2">
            <h2 id="footer-about" className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700">
              Über Kaufmann Health
            </h2>
            <p className="max-w-prose text-sm leading-relaxed text-gray-600">
              Kaufmann Health ist ein Informationsverzeichnis. Wir stellen Kontaktdaten zur Verfügung, vermitteln aber keine
              therapeutischen Leistungen. Die Therapiewahl liegt allein bei Ihnen.
            </p>
          </section>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t pt-4 text-xs text-gray-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} Konstantin Kaufmann - Kaufmann Health. Alle Rechte vorbehalten.
          </p>
          <p>Berlin, Deutschland</p>
        </div>
      </div>
    </footer>
  );
}
