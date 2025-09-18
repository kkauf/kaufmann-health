"use client";

import { useMemo } from "react";

export default function VariantGate({ show, children }: { show: "A" | "B"; children: React.ReactNode }) {
  const variant = useMemo<"A" | "B">(() => {
    try {
      const url = new URL(window.location.href);
      const v = (url.searchParams.get("v") || "A").toUpperCase();
      return v === "B" ? "B" : "A";
    } catch {
      return "A";
    }
  }, []);

  if (variant !== show) return null;
  return <>{children}</>;
}
