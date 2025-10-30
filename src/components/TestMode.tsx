"use client";

import { useEffect } from "react";

export default function TestMode() {
  useEffect(() => {
    try {
      const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const tt = sp.get("tt");
      if (!tt) return;
      const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
      if (tt === "1") {
        document.cookie = `kh_test=1; Max-Age=7776000; Path=/; SameSite=Lax${secure}`;
      } else if (tt === "0") {
        document.cookie = `kh_test=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
      }
    } catch {}
  }, []);
  return null;
}
