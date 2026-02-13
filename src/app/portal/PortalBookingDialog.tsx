"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarCheck2,
  Clock,
  Video,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  UserPlus,
} from "lucide-react";
import type { CalNormalizedSlot } from "@/contracts/cal";
import { groupSlotsByDay } from "@/features/therapists/hooks/useCalBooking";
import { cn } from "@/lib/utils";

interface ClientOption {
  patient_id: string;
  name: string | null;
  email: string;
}

interface PortalBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  therapistId: string;
  calUsername: string;
  /** Pre-selected client (from "Buchen" button). null = show client picker. */
  client: {
    patient_id: string;
    name: string;
    email: string;
  } | null;
  /** All known clients for the therapist (shown in picker). */
  clients: ClientOption[];
  onBookingCreated: () => void;
}

type DialogStep =
  | "client-select"
  | "client-info"
  | "slots"
  | "booking"
  | "success"
  | "error";

function formatDayLabel(dateIso: string): string {
  const date = new Date(dateIso + "T12:00:00");
  return date.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/Berlin",
  });
}

function formatSuccessDateTime(slotUtc: string): string {
  const date = new Date(slotUtc);
  return date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }) +
    ", " +
    date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Berlin",
    }) +
    " Uhr";
}

export default function PortalBookingDialog({
  open,
  onOpenChange,
  therapistId,
  calUsername,
  client,
  clients,
  onBookingCreated,
}: PortalBookingDialogProps) {
  function getInitialStep(): DialogStep {
    if (client) return "slots";
    if (clients.length > 0) return "client-select";
    return "client-info";
  }
  const [step, setStep] = useState<DialogStep>(getInitialStep);
  // Internal selected client (set from picker or pre-filled from prop)
  const [pickedClient, setPickedClient] = useState<{
    patient_id: string;
    name: string;
    email: string;
  } | null>(client);
  const [slots, setSlots] = useState<CalNormalizedSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CalNormalizedSlot | null>(
    null
  );
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookedSlotUtc, setBookedSlotUtc] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setPickedClient(client);
      if (client) {
        setStep("slots");
      } else if (clients.length > 0) {
        setStep("client-select");
      } else {
        setStep("client-info");
      }
      setSlots([]);
      setSlotsLoading(true);
      setSlotsError(null);
      setSelectedDay(null);
      setSelectedSlot(null);
      setManualName("");
      setManualEmail("");
      setBookingLoading(false);
      setBookingError(null);
      setBookedSlotUtc(null);
    }
  }, [open, client, clients.length]);

  // Fetch slots when entering the slots step
  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true);
    setSlotsError(null);

    try {
      const today = new Date();
      const start = today.toISOString().split("T")[0];
      const end14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const url = new URL("/api/public/cal/slots", window.location.origin);
      url.searchParams.set("therapist_id", therapistId);
      url.searchParams.set("kind", "full_session");
      url.searchParams.set("start", start);
      url.searchParams.set("end", end14);

      const res = await fetch(url.toString());
      if (!res.ok) {
        setSlotsError("Termine konnten nicht geladen werden.");
        setSlotsLoading(false);
        return;
      }

      const json = (await res.json()) as {
        error?: string;
        data?: { slots?: CalNormalizedSlot[] };
      };

      if (json.error) {
        setSlotsError("Termine konnten nicht geladen werden.");
        setSlotsLoading(false);
        return;
      }

      let fetchedSlots: CalNormalizedSlot[] = Array.isArray(json.data?.slots)
        ? json.data.slots
        : [];

      // If sparse, extend to 28 days
      if (fetchedSlots.length < 5) {
        const end28 = new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        url.searchParams.set("end", end28);
        try {
          const res28 = await fetch(url.toString());
          if (res28.ok) {
            const json28 = (await res28.json()) as {
              error?: string;
              data?: { slots?: CalNormalizedSlot[] };
            };
            if (!json28.error && Array.isArray(json28.data?.slots)) {
              fetchedSlots = json28.data.slots;
            }
          }
        } catch {
          // Use what we have from 14-day fetch
        }
      }

      setSlots(fetchedSlots);

      // Auto-select first day
      if (fetchedSlots.length > 0) {
        const grouped = groupSlotsByDay(fetchedSlots);
        const firstDay = grouped.keys().next().value;
        if (firstDay) setSelectedDay(firstDay);
      }
    } catch {
      setSlotsError("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
      setSlotsLoading(false);
    }
  }, [therapistId]);

  // Fetch slots when step changes to 'slots'
  useEffect(() => {
    if (open && step === "slots") {
      fetchSlots();
    }
  }, [open, step, fetchSlots]);

  // Book the selected slot
  const bookSlot = useCallback(async () => {
    if (!selectedSlot) return;

    const name = pickedClient?.name || manualName;
    const email = pickedClient?.email || manualEmail;

    setBookingLoading(true);
    setBookingError(null);
    setStep("booking");

    try {
      const res = await fetch("/api/public/cal/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_id: therapistId,
          kind: "full_session",
          slot_utc: selectedSlot.time_utc,
          name,
          email,
          location_type: "video",
          metadata: {
            kh_source: "therapist_portal",
            kh_patient_id: pickedClient?.patient_id || undefined,
            kh_booking_kind: "full_session",
            kh_therapist_id: therapistId,
          },
        }),
      });

      const json = (await res.json()) as {
        data: {
          success: boolean;
          booking?: { uid: string; startTime: string; endTime: string };
          error?: string;
          canRetry?: boolean;
          fallbackToRedirect?: boolean;
          message?: string;
        } | null;
        error: string | null;
      };

      if (json.error) {
        setBookingError(json.error);
        setStep("error");
        return;
      }

      if (!json.data) {
        setBookingError("Keine Antwort vom Server.");
        setStep("error");
        return;
      }

      if (json.data.success) {
        setBookedSlotUtc(selectedSlot.time_utc);
        setStep("success");
      } else if (json.data.canRetry) {
        // Slot no longer available — re-fetch and go back to picker
        setBookingError(
          "Dieser Termin ist leider nicht mehr verfügbar. Bitte wähle eine andere Zeit."
        );
        setSelectedSlot(null);
        setStep("slots");
        fetchSlots();
      } else {
        setBookingError(
          json.data.message || "Buchung fehlgeschlagen. Bitte versuche es erneut."
        );
        setStep("error");
      }
    } catch {
      setBookingError("Verbindungsfehler. Bitte versuche es erneut.");
      setStep("error");
    } finally {
      setBookingLoading(false);
    }
  }, [selectedSlot, pickedClient, manualName, manualEmail, therapistId, fetchSlots]);

  const isManualFormValid =
    manualName.trim().length >= 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manualEmail);

  const grouped = groupSlotsByDay(slots);
  const days = Array.from(grouped.keys());
  const daySlots = selectedDay ? grouped.get(selectedDay) || [] : [];

  const dialogTitle =
    step === "client-select"
      ? "Termin buchen"
      : pickedClient
        ? `Nächste Sitzung buchen`
        : `Neue:n Klient:in buchen`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck2 className="h-5 w-5 text-emerald-600" />
            {dialogTitle}
          </DialogTitle>
          {pickedClient && step === "slots" && (
            <p className="text-sm text-muted-foreground mt-1">
              Für {pickedClient.name}
            </p>
          )}
        </DialogHeader>

        {/* Client Select Step (pick existing or add new) */}
        {step === "client-select" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Für wen möchtest du einen Termin buchen?
            </p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {clients.map((c) => (
                <button
                  key={c.patient_id}
                  type="button"
                  onClick={() => {
                    setPickedClient({
                      patient_id: c.patient_id,
                      name: c.name || c.email,
                      email: c.email,
                    });
                    setStep("slots");
                  }}
                  className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-sm font-medium shrink-0">
                    {(c.name || c.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {c.name || c.email}
                    </p>
                    {c.name && (
                      <p className="text-xs text-gray-500 truncate">{c.email}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setPickedClient(null);
                  setStep("client-info");
                }}
                className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-emerald-50 transition-colors border border-dashed border-gray-200 hover:border-emerald-300"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shrink-0">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    Neue:n Klient:in hinzufügen <span className="text-emerald-600 font-normal">(kostenlos)</span>
                  </p>
                  <p className="text-xs text-gray-500">Klient:in ist noch nicht auf der Plattform</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Client Info Step (manual entry) */}
        {step === "client-info" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Name</Label>
              <Input
                id="client-name"
                placeholder="Vor- und Nachname"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email">E-Mail</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="email@beispiel.de"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!isManualFormValid}
              onClick={() => setStep("slots")}
            >
              Weiter
            </Button>
          </div>
        )}

        {/* Slots Step */}
        {step === "slots" && (
          <div className="space-y-4">
            {/* Slot mismatch error banner */}
            {bookingError && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            {slotsLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Termine werden geladen...
                </p>
              </div>
            )}

            {slotsError && !slotsLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-8 w-8 text-red-400 mb-3" />
                <p className="text-sm text-muted-foreground">{slotsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={fetchSlots}
                >
                  Erneut versuchen
                </Button>
              </div>
            )}

            {!slotsLoading && !slotsError && slots.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarCheck2 className="h-8 w-8 text-gray-300 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Keine freien Termine in den nächsten 2 Wochen.
                </p>
                <a
                  href={`https://cal.kaufmann.health/${calUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
                >
                  Verfügbarkeit in Cal.com prüfen
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {!slotsLoading && !slotsError && slots.length > 0 && (
              <>
                {/* Day chips */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {days.map((day) => (
                    <button
                      key={day}
                      onClick={() => {
                        setSelectedDay(day);
                        setSelectedSlot(null);
                      }}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                        selectedDay === day
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      )}
                    >
                      {formatDayLabel(day)}
                    </button>
                  ))}
                </div>

                {/* Time grid */}
                {selectedDay && (
                  <div className="grid grid-cols-3 gap-2">
                    {daySlots.map((slot) => (
                      <button
                        key={slot.time_utc}
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                          selectedSlot?.time_utc === slot.time_utc
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {slot.time_label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Book button */}
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!selectedSlot}
                  onClick={bookSlot}
                >
                  <Video className="h-4 w-4" />
                  Termin buchen
                </Button>
              </>
            )}
          </div>
        )}

        {/* Booking in progress */}
        {step === "booking" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm text-muted-foreground">
              Termin wird gebucht...
            </p>
          </div>
        )}

        {/* Success */}
        {step === "success" && bookedSlotUtc && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mb-4">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Termin gebucht!
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatSuccessDateTime(bookedSlotUtc)}
            </p>
            {client && (
              <p className="mt-1 text-sm text-muted-foreground">
                {client.name} erhält eine Bestätigung per E-Mail.
              </p>
            )}
            <Button
              className="mt-6 w-full"
              onClick={() => {
                onBookingCreated();
                onOpenChange(false);
              }}
            >
              Fertig
            </Button>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Buchung fehlgeschlagen
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {bookingError || "Ein unerwarteter Fehler ist aufgetreten."}
            </p>
            <Button
              variant="outline"
              className="mt-6 w-full"
              onClick={() => {
                setBookingError(null);
                setSelectedSlot(null);
                setStep("slots");
                fetchSlots();
              }}
            >
              Erneut versuchen
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
