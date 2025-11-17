"use client";

import { ShieldCheck, Lock } from "lucide-react";
import { COOKIES_ENABLED } from "@/lib/config";
import { useCallback } from "react";

export default function Footer() {
  const openCookieSettings = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    try {
      window.dispatchEvent(new Event('open-cookie-settings'));
    } catch {}
  }, []);
  return (
    <footer className="border-t border-gray-200/60 bg-gradient-to-b from-white to-slate-50/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid gap-10 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">
          <section aria-labelledby="footer-contact">
            <h2 id="footer-contact" className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-900">
              Kontakt
            </h2>
            <ul className="space-y-2">
              <li className="text-gray-800 font-medium">Konstantin Kaufmann - Kaufmann Health</li>
              <li>
                Email:{" "}
                <a className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900 hover:decoration-gray-900 transition-colors" href="mailto:kontakt@kaufmann-health.de">
                  kontakt@kaufmann-health.de
                </a>
              </li>
              <li>
                Beratung & Projekte:{" "}
                <a
                  href="/beratung"
                  className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900 hover:decoration-gray-900 transition-colors"
                >
                  Digitale Lösungen
                </a>
              </li>
            </ul>
          </section>
          <nav aria-labelledby="footer-legal">
            <h2 id="footer-legal" className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-900">
              Rechtliches
            </h2>
            <ul className="space-y-2">
              <li>
                <a className="hover:text-gray-900 transition-colors" href="/impressum">Impressum</a>
              </li>
              <li>
                <a className="hover:text-gray-900 transition-colors" href="/agb">AGB</a>
              </li>
              <li>
                <a className="hover:text-gray-900 transition-colors" href="/datenschutz">Datenschutz</a>
              </li>
              {COOKIES_ENABLED && (
                <li>
                  <a href="#" onClick={openCookieSettings} className="hover:text-gray-900 transition-colors">Cookie-Einstellungen</a>
                </li>
              )}
            </ul>
          </nav>
          <section aria-labelledby="footer-about" className="sm:col-span-2 lg:col-span-2">
            <h2 id="footer-about" className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-900">
              Über Kaufmann Health
            </h2>
            <p className="max-w-prose text-sm leading-relaxed text-gray-700">
              Kaufmann Health bringt Menschen mit qualifizierten körperorientierten Therapeut:innen zusammen. Wir schlagen passende Therapeut:innen vor und stellen Kontakte her, vermitteln aber keine therapeutischen Leistungen. Die Therapiewahl liegt allein bei dir.
            </p>
          </section>
        </div>
        {/* Trust badges row */}
        <div className="mt-10 rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm font-medium text-gray-700" aria-label="Sicherheitsmerkmale">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <span>DSGVO-konform</span>
            </span>
            {!COOKIES_ENABLED && (
              <span className="inline-flex items-center gap-2">
                <Lock className="h-5 w-5 text-slate-700" />
                <span>Keine Cookies</span>
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <Lock className="h-5 w-5 text-indigo-600" />
              <span>Verschlüsselte Übertragung</span>
            </span>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-gray-200/60 pt-6 text-xs text-gray-500 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} Konstantin Kaufmann - Kaufmann Health. Alle Rechte vorbehalten.
          </p>
          <p className="font-medium">Berlin, Deutschland</p>
        </div>
      </div>
    </footer>
  );
}
