"use client";

import { useCallback, useState } from "react";
import { fireGoogleAdsBookingConversion } from "@/lib/gtag";
import { getOrCreateSessionId } from "@/lib/attribution";

type BookParams = {
  therapist_id: string;
  date_iso: string;
  time_label: string; // HH:MM
  format: "online" | "in_person";
};

export function useBookAppointment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const book = useCallback(async (params: BookParams) => {
    setLoading(true);
    setError(null);
    try {
      const session_id = getOrCreateSessionId();
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, session_id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to book");

      const data = (json?.data || {}) as { booking_id?: string; dry_run?: boolean };
      if (!data?.dry_run && data?.booking_id) {
        try {
          fireGoogleAdsBookingConversion(data.booking_id);
        } catch {}
      }

      return { ok: true, data } as const;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Booking failed";
      setError(msg);
      return { ok: false, error: msg } as const;
    } finally {
      setLoading(false);
    }
  }, []);

  return { book, loading, error } as const;
}
