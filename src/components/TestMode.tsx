"use client";

import { useEffect, useState } from "react";

export default function TestMode() {
  const [isTest, setIsTest] = useState(false);

  useEffect(() => {
    try {
      const hasWindow = typeof window !== "undefined";
      const sp = new URLSearchParams(hasWindow ? window.location.search : "");
      const tt = sp.get("tt");
      const secure = hasWindow && window.location.protocol === "https:" ? "; Secure" : "";

      if (tt === "1") {
        document.cookie = `kh_test=1; Max-Age=7776000; Path=/; SameSite=Lax${secure}`;
      } else if (tt === "0") {
        document.cookie = `kh_test=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
      }

      const cookie = document.cookie || "";
      const active = cookie.split(";").some((p) => {
        const [k, v] = p.trim().split("=");
        return k === "kh_test" && v === "1";
      });

      setIsTest(active);

      if (hasWindow && window.document?.body) {
        if (active) {
          window.document.body.dataset.khTest = "1";
        } else {
          delete window.document.body.dataset.khTest;
        }
      }
    } catch {}
  }, []);

  if (!isTest) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[130] flex justify-center pointer-events-none">
      <div className="pointer-events-auto mt-2 rounded-full bg-blue-600 text-white px-4 py-1 text-xs font-semibold shadow-lg">
        TEST-MODUS aktiv – Daten werden als Test markiert
      </div>
    </div>
  );
}
