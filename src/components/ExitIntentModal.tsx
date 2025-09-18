"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Minimal exit-intent modal for public pages.
 * - Appears once per session when the user moves the mouse out at the top edge
 * - No cookies; uses sessionStorage flag only
 */
export default function ExitIntentModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "kh_exit_intent_shown";
    const onMouseOut = (e: MouseEvent) => {
      // Show only when cursor leaves viewport at the top and not moving to another element
      if (e.relatedTarget) return;
      if (e.clientY > 0) return;
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
      setOpen(true);
    };
    window.addEventListener("mouseout", onMouseOut);
    return () => window.removeEventListener("mouseout", onMouseOut);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Moment! Ein:e Therapeut:in hat gerade einen Termin frei</h3>
        <p className="mt-2 text-sm text-slate-700">
          Wenn du magst, schick uns kurz deine E-Mail. Wir melden uns innerhalb von 24 Stunden mit einer passenden Empfehlung.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Button asChild size="lg" className="bg-black text-white hover:bg-black/90">
            <a href="#top-form" onClick={() => setOpen(false)}>Passenden Therapeuten finden</a>
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>Später</Button>
        </div>
      </div>
    </div>
  );
}
