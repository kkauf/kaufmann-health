"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarCheck2,
  Clock,
  Video,
  MapPin,
  Users,
  ChevronDown,
  ChevronUp,
  Plus,
  ExternalLink,
  Loader2,
  AlertCircle,
  CalendarPlus,
} from "lucide-react";
import PortalBookingDialog from "./PortalBookingDialog";

// ============================================================================
// Types (mirror API response shape)
// ============================================================================

interface BookingSummary {
  id: string;
  cal_uid: string;
  patient_id: string | null;
  patient_name: string | null;
  patient_email: string | null;
  booking_kind: string | null;
  start_time: string;
  end_time: string | null;
  source: string | null;
  video_url: string | null;
  location_type: string | null;
  status: string | null;
}

interface ClientSummary {
  patient_id: string;
  name: string | null;
  email: string;
  total_intros: number;
  total_sessions: number;
  last_session_date: string | null;
  next_session_date: string | null;
  status: "active" | "idle" | "new";
}

interface BookingsResponse {
  upcoming: BookingSummary[];
  past: BookingSummary[];
  clients: ClientSummary[];
  error?: string;
}

// ============================================================================
// Date helpers
// ============================================================================

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }) + ", " + date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }) + " Uhr";
}

function formatDateShort(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Berlin",
  });
}

// ============================================================================
// Sub-components
// ============================================================================

function BookingKindBadge({ kind }: { kind: string | null }) {
  if (kind === "intro") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
        Kennenlernen
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
      Sitzung
    </Badge>
  );
}

function LocationBadge({ videoUrl, locationType }: { videoUrl: string | null; locationType: string | null }) {
  if (locationType === "in_person") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <MapPin className="h-3 w-3" />
        Vor Ort
      </span>
    );
  }
  if (videoUrl) {
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
      >
        <Video className="h-3 w-3" />
        Online
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <Video className="h-3 w-3" />
      Online
    </span>
  );
}

function StatusDot({ status }: { status: "active" | "idle" | "new" }) {
  const colors = {
    active: "bg-emerald-500",
    idle: "bg-gray-400",
    new: "bg-blue-500",
  };
  const labels = {
    active: "Aktiv",
    idle: "Inaktiv",
    new: "Neu",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className={`h-2 w-2 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  );
}

function BookingRow({ booking, dimmed = false }: { booking: BookingSummary; dimmed?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-3 ${dimmed ? "opacity-60" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">
            {booking.patient_name || booking.patient_email || "Unbekannt"}
          </span>
          <BookingKindBadge kind={booking.booking_kind} />
          <LocationBadge videoUrl={booking.video_url} locationType={booking.location_type} />
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          {formatDateTime(booking.start_time)}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface BookingsViewProps {
  therapistId: string;
  calUsername?: string;
}

export default function BookingsView({ therapistId, calUsername }: BookingsViewProps) {
  const [data, setData] = useState<BookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{
    patient_id: string;
    name: string;
    email: string;
  } | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/portal/bookings", { credentials: "include" });
      if (!res.ok) {
        throw new Error("Daten konnten nicht geladen werden");
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleBookClient = useCallback(
    (client: ClientSummary) => {
      setSelectedClient({
        patient_id: client.patient_id,
        name: client.name || client.email,
        email: client.email,
      });
      setDialogOpen(true);
    },
    []
  );

  const handleBookNew = useCallback(() => {
    setSelectedClient(null);
    setDialogOpen(true);
  }, []);

  const handleBookingCreated = useCallback(() => {
    setDialogOpen(false);
    fetchBookings();
  }, [fetchBookings]);

  // Loading state
  if (loading && !data) {
    return (
      <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
        <div className="p-8 flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Termine werden geladen...</p>
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border border-red-200 shadow-md bg-red-50/80 backdrop-blur-sm">
        <div className="p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchBookings}
              className="mt-3"
            >
              Erneut versuchen
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const hasNoBookings =
    !data ||
    (data.upcoming.length === 0 &&
      data.past.length === 0 &&
      data.clients.length === 0);

  // Empty state
  if (hasNoBookings) {
    return (
      <>
        <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
          <div className="p-8 text-center">
            <CalendarCheck2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Noch keine Termine
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              Sobald Klient:innen Termine bei dir buchen, erscheinen sie hier.
              Teile deinen Buchungslink, um loszulegen.
            </p>
            {calUsername && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://cal.kaufmann.health/${calUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Buchungsseite ansehen
                  </a>
                </Button>
                <Button size="sm" onClick={handleBookNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Neuen Termin buchen
                </Button>
              </div>
            )}
          </div>
        </Card>

        {calUsername && (
          <PortalBookingDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            therapistId={therapistId}
            calUsername={calUsername}
            client={selectedClient}
            clients={[]}
            onBookingCreated={handleBookingCreated}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upcoming Sessions */}
      <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CalendarCheck2 className="h-5 w-5 text-emerald-600" />
              Anstehende Termine
            </h2>
            {data.upcoming.length > 0 && (
              <Badge variant="secondary">{data.upcoming.length}</Badge>
            )}
          </div>

          {data.upcoming.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">
              Keine anstehenden Termine
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.upcoming.map((booking) => (
                <BookingRow key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Client List */}
      <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Klient:innen
            </h2>
            {calUsername && (
              <Button size="sm" variant="outline" onClick={handleBookNew}>
                <CalendarPlus className="h-4 w-4 mr-1.5" />
                Neuen Termin
              </Button>
            )}
          </div>

          {data.clients.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">
              Noch keine Klient:innen
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.clients.map((client) => (
                <div
                  key={client.patient_id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {client.name || client.email}
                      </span>
                      <StatusDot status={client.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>
                        {client.total_intros > 0 && `${client.total_intros} Kennenlernen`}
                        {client.total_intros > 0 && client.total_sessions > 0 && " · "}
                        {client.total_sessions > 0 && `${client.total_sessions} ${client.total_sessions === 1 ? "Sitzung" : "Sitzungen"}`}
                      </span>
                      {client.last_session_date && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>Letzte: {formatDateShort(client.last_session_date)}</span>
                        </>
                      )}
                      {client.next_session_date && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="text-emerald-600">
                            Nächste: {formatDateShort(client.next_session_date)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {calUsername && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBookClient(client)}
                      className="shrink-0 text-xs"
                    >
                      <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                      Buchen
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Past Sessions (collapsible) */}
      {data.past.length > 0 && (
        <Card className="border border-gray-200/60 shadow-md bg-white/80 backdrop-blur-sm">
          <div className="p-6">
            <button
              type="button"
              onClick={() => setShowPast(!showPast)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-400" />
                Vergangene Termine
              </h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{data.past.length}</Badge>
                {showPast ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </button>

            {showPast && (
              <div className="divide-y divide-gray-100 mt-4">
                {data.past.map((booking) => (
                  <BookingRow key={booking.id} booking={booking} dimmed />
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Booking Dialog */}
      {calUsername && (
        <PortalBookingDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          therapistId={therapistId}
          calUsername={calUsername}
          client={selectedClient}
          clients={(data?.clients || []).map(c => ({
            patient_id: c.patient_id,
            name: c.name,
            email: c.email,
          }))}
          onBookingCreated={handleBookingCreated}
        />
      )}
    </div>
  );
}
