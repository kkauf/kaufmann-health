"use client";

import { useMemo } from "react";

export default function VariantGate({ show, children }: { show: "A" | "B" | "C"; children: React.ReactNode }) {
  const variant = useMemo<"A" | "B" | "C">(() => {
    try {
      const url = new URL(window.location.href);
      const v = (url.searchParams.get("v") || "A").toUpperCase();
      if (v === "B") return "B";
      if (v === "C") return "C";
      return "A";
    } catch {
      return "A";
    }
  }, []);

  if (variant !== show) return null;
  return <>{children}</>;
}
