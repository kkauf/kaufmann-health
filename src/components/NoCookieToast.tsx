"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "noCookieToastShown";

export default function NoCookieToast() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (sessionStorage.getItem(STORAGE_KEY) !== "1") {
        setVisible(true);
        const t = setTimeout(() => {
          setVisible(false);
          try {
            sessionStorage.setItem(STORAGE_KEY, "1");
          } catch {}
        }, 5000);
        return () => clearTimeout(t);
      }
    } catch {
      // sessionStorage may be unavailable (e.g., SSR or privacy mode); fail gracefully.
    }
  }, []);

  if (!mounted) return null;
  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none p-4 sm:p-6">
      <div className="flex justify-center">
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-auto w-full max-w-md rounded-xl border bg-white/95 backdrop-blur shadow-lg ring-1 ring-black/5 transition-all duration-300 ease-out motion-reduce:transition-none translate-y-0 opacity-100"
        >
          <div className="flex items-start gap-3 p-4">
            <div className="text-xl" aria-hidden>🍪</div>
            <div className="flex-1 text-sm text-gray-800">
              <p className="font-medium">Keine Krümel hier.</p>
              <p className="mt-0.5 text-gray-600">
                Dein Besuch hinterlässt keine Spuren – kein Tracking, keine Cookies. {" "}
                <Link
                  href="/datenschutz#cookies"
                  className="underline decoration-gray-300 underline-offset-4 hover:text-gray-900"
                >
                  Mehr Infos
                </Link>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setVisible(false);
                try {
                  sessionStorage.setItem(STORAGE_KEY, "1");
                } catch {}
              }}
              className="-m-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
              aria-label="Hinweis schließen"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
