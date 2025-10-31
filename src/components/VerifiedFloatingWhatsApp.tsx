"use client";

import { useEffect, useState } from "react";
import FloatingWhatsApp from "./FloatingWhatsApp";

export default function VerifiedFloatingWhatsApp() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/public/session");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json?.data?.verified) {
          setShow(true);
        }
      } catch {}
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;
  return <FloatingWhatsApp />;
}
