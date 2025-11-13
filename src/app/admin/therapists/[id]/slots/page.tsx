"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Slot = {
  id: string;
  therapist_id: string;
  day_of_week: number;
  time_local: string;
  format: "online" | "in_person";
  address: string;
  duration_minutes: number;
  active: boolean;
  created_at?: string;
  is_recurring: boolean;
  specific_date?: string | null;
  end_date?: string | null;
};

type TherapistInfo = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  city?: string | null;
  status?: string | null;
  photo_url?: string | null;
  profile?: {
    photo_url?: string | null;
    photo_pending_url?: string | null;
    practice_address?: string;
  } | null;
};

type NewSlotPayload = {
  is_recurring: boolean;
  day_of_week?: number;
  specific_date?: string;
  time_local: string;
  format: "online" | "in_person";
  duration_minutes: number;
  active: boolean;
  end_date?: string;
};

const DAYS = [
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
  { value: 4, label: "Donnerstag" },
  { value: 5, label: "Freitag" },
  { value: 6, label: "Samstag" },
  { value: 0, label: "Sonntag" },
];

export default function TherapistSlotsPage(props: { params: Promise<{ id: string }> }) {
  const [therapistId, setTherapistId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);

  const [therapist, setTherapist] = useState<TherapistInfo | null>(null);
  const [tLoading, setTLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [practiceAddress, setPracticeAddress] = useState<string>("");

  const [appointmentType, setAppointmentType] = useState<"recurring" | "one-time">("recurring");
  const [day, setDay] = useState<number | "">("");
  const [specificDate, setSpecificDate] = useState<string>(""); // YYYY-MM-DD
  const [time, setTime] = useState<string>("");
  const [format, setFormat] = useState<"online" | "in_person" | "both">("online");
  const [duration, setDuration] = useState<string>("60");
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [endDate, setEndDate] = useState<string>(""); // YYYY-MM-DD (optional for recurring)

  useEffect(() => {
    (async () => {
      const { id } = await props.params;
      setTherapistId(id);
    })();
  }, [props.params]);

  useEffect(() => {
    if (!therapistId) return;
    setTLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/admin/therapists/${therapistId}`, { credentials: "include", cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Fehler beim Laden");
        const data = json.data as TherapistInfo;
        setTherapist(data);
        setPracticeAddress((data?.profile?.practice_address || '').toString());
      } catch {
        setTherapist(null);
      } finally {
        setTLoading(false);
      }
    })();
  }, [therapistId]);

  useEffect(() => {
    setImgError(false);
  }, [therapistId, therapist?.profile?.photo_url, therapist?.profile?.photo_pending_url, therapist?.photo_url]);

  const photoSrc = useMemo(() => {
    const src = therapist?.profile?.photo_url || therapist?.photo_url || therapist?.profile?.photo_pending_url || "";
    return imgError ? "" : src;
  }, [therapist?.profile?.photo_url, therapist?.profile?.photo_pending_url, therapist?.photo_url, imgError]);

  const activeCount = useMemo(() => slots.filter((s) => s.active).length, [slots]);

  const fetchSlots = useCallback(async () => {
    if (!therapistId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/therapists/${therapistId}/slots`, { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Fehler beim Laden");
      setSlots(json.data as Slot[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(msg);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [therapistId]);

  useEffect(() => {
    fetchSlots().catch(() => {});
  }, [fetchSlots]);

  useEffect(() => {
    if (defaultsApplied) return;
    if (!slots || slots.length === 0) return;
    const last = [...slots]
      .sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      })[0] || slots[slots.length - 1];
    if (last) {
      setFormat(last.format);
      setDuration(String(last.duration_minutes || 60));
      setDefaultsApplied(true);
    }
  }, [slots, defaultsApplied]);

  async function addSlot() {
    if (!therapistId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (!/^\d{2}:\d{2}$/.test(time)) throw new Error("Zeit im Format HH:MM eingeben");
      const durationNum = parseInt(duration);
      if (isNaN(durationNum) || durationNum < 30 || durationNum > 240) {
        throw new Error("Dauer muss zwischen 30 und 240 Minuten liegen");
      }

      const isRecurring = appointmentType === "recurring";

      if (isRecurring) {
        const d = typeof day === "number" ? day : NaN;
        if (!Number.isInteger(d)) throw new Error("Wochentag wählen");
        const slotsPayload: NewSlotPayload[] = [];
        const pushRecurring = (fmt: "online" | "in_person") => {
          slotsPayload.push({
            is_recurring: true,
            day_of_week: d,
            time_local: time.slice(0, 5),
            format: fmt,
            duration_minutes: durationNum,
            active: true,
            ...(endDate ? { end_date: endDate } : {}),
          });
        };
        if (format === "both") {
          pushRecurring("online");
          pushRecurring("in_person");
        } else {
          pushRecurring(format);
        }
        const body = { slots: slotsPayload };
        const res = await fetch(`/api/admin/therapists/${therapistId}/slots`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Speichern fehlgeschlagen");
        setSlots(json.data as Slot[]);
        setMessage("Terminserie gespeichert");
        // Keep previous inputs to speed up adding multiple series
      } else {
        // One-time appointment
        if (!specificDate) throw new Error("Datum wählen");
        const slotsPayload: NewSlotPayload[] = [];
        const pushOneTime = (fmt: "online" | "in_person") => {
          slotsPayload.push({
            is_recurring: false,
            specific_date: specificDate,
            time_local: time.slice(0, 5),
            format: fmt,
            duration_minutes: durationNum,
            active: true,
          });
        };
        if (format === "both") {
          pushOneTime("online");
          pushOneTime("in_person");
        } else {
          pushOneTime(format);
        }
        const body = { slots: slotsPayload };
        const res = await fetch(`/api/admin/therapists/${therapistId}/slots`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Speichern fehlgeschlagen");
        setSlots(json.data as Slot[]);
        setMessage("Termin gespeichert");
        setSpecificDate("");
        setTime("");
        setDuration(String(durationNum));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function removeSlot(slotId: string) {
    if (!therapistId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/therapists/${therapistId}/slots/${slotId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Löschen fehlgeschlagen");
      await fetchSlots();
      setMessage("Gelöscht");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function savePracticeAddress() {
    if (!therapistId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body = {
        profile: {
          practice_address: practiceAddress,
        },
      };
      const res = await fetch(`/api/admin/therapists/${therapistId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Speichern fehlgeschlagen");
      setMessage("Praxis-Adresse gespeichert");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }


  return (
    <main className="min-h-screen p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Verfügbare Termine verwalten</h1>

      <Card>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 ring-2 ring-gray-100">
              {therapist?.profile?.photo_url ? (
                <AvatarImage src={therapist.profile.photo_url} alt="Profilfoto" />
              ) : (
                <AvatarFallback>{`${((therapist?.first_name?.[0] || therapist?.name?.[0] || "").toUpperCase())}${((therapist?.last_name?.[0] || therapist?.name?.split(" ")?.[1]?.[0] || "").toUpperCase())}`}</AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0">
              <div className="text-lg font-semibold break-words">
                {therapist?.name || `${therapist?.first_name || ""} ${therapist?.last_name || ""}`}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-sm">
                {therapist?.city ? <Badge variant="outline">{therapist.city}</Badge> : null}
                {therapist?.status ? (
                  <Badge className={therapist.status === "verified" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : undefined}>
                    {therapist.status === "verified" ? "Verifiziert" : therapist.status === "pending_verification" ? "Prüfung ausstehend" : therapist.status}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="border rounded-md p-4">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Praxis-Adresse (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="space-y-1 flex-1 min-w-0">
                <Label>Adresse</Label>
                <Input
                  placeholder="Straße, PLZ Ort"
                  value={practiceAddress}
                  onChange={(e) => setPracticeAddress(e.target.value)}
                />
              </div>
              <div className="flex-shrink-0">
                <Button onClick={savePracticeAddress} disabled={saving} className="w-full sm:w-auto">{saving ? "Speichert…" : "Speichern"}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Neuen Termin hinzufügen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Step 1: Select appointment type */}
              <div className="space-y-2">
                <Label>Terminart</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAppointmentType("one-time")}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      appointmentType === "one-time"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium">Einmaliger Termin</div>
                    <div className="text-xs text-gray-600 mt-1">Ein spezifisches Datum</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppointmentType("recurring")}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      appointmentType === "recurring"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium">Wöchentliche Serie</div>
                    <div className="text-xs text-gray-600 mt-1">Jeden Wochentag zur selben Zeit</div>
                  </button>
                </div>
              </div>

              {/* Step 2: Date/Day and time selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                {appointmentType === "one-time" ? (
                  <div className="space-y-1 lg:col-span-2">
                    <Label>Datum</Label>
                    <Input
                      type="date"
                      value={specificDate}
                      onChange={(e) => setSpecificDate(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-1 lg:col-span-2">
                    <Label>Wochentag</Label>
                    <Select value={day === "" ? undefined : String(day)} onValueChange={(v) => setDay(Number(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1 lg:col-span-2">
                  <Label>Uhrzeit</Label>
                  <Input type="time" placeholder="HH:MM" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>

                {/* Step 3: Format and Duration */}
                <div className="space-y-1 lg:col-span-1">
                  <Label>Format</Label>
                  <Select value={format} onValueChange={(v: "online" | "in_person" | "both") => setFormat(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="in_person">Vor Ort</SelectItem>
                      <SelectItem value="both">Beides</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 lg:col-span-1">
                  <Label>Dauer (Min)</Label>
                  <Input type="number" min={30} max={240} value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
              </div>

              {appointmentType === "recurring" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                  <div className="space-y-1 lg:col-span-2">
                    <Label>Enddatum (optional)</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-gray-500">
                  {format === "in_person" && practiceAddress
                    ? `Adresse: ${practiceAddress}`
                    : format === "in_person"
                    ? "Hinweis: Bitte Praxis-Adresse oben angeben"
                    : "Maximal 5 aktive Serien/Termine pro Therapeut:in"}
                </p>
                <Button onClick={addSlot} disabled={saving || activeCount >= 5}>
                  {saving ? "Speichert…" : "Hinzufügen"}
                </Button>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {message && <p className="text-sm text-emerald-700">{message}</p>}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="border rounded-md p-4">
        <h2 className="text-base font-semibold mb-3">Aktive Serien und Termine</h2>
        {loading ? (
          <p className="text-sm text-gray-600">Laden…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-gray-600">Keine Termine vorhanden</p>
        ) : (
          <div className="space-y-3">
            {/* Recurring slots */}
            {slots.filter((s) => s.is_recurring).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Wöchentliche Serien</h3>
                <div className="space-y-2">
                  {slots
                    .filter((s) => s.is_recurring)
                    .map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center justify-between border rounded-md p-3 bg-blue-50/30">
                        <div className="text-sm">
                          <Badge variant="outline" className="mr-2 bg-blue-100 text-blue-700 border-blue-300">Serie</Badge>
                          <span className="font-medium mr-2">{DAYS.find((d) => d.value === s.day_of_week)?.label || s.day_of_week}</span>
                          <span className="mr-2">{s.time_local.slice(0, 5)} Uhr</span>
                          <span className="mr-2">{s.format === "online" ? "Online" : "Vor Ort"}</span>
                          {s.is_recurring && s.end_date ? (
                            <span className="text-gray-600 ml-2">bis {new Date((s.end_date as string) + "T12:00:00").toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" })}</span>
                          ) : null}
                          {s.format === "in_person" && s.address ? <span className="text-gray-600">{s.address}</span> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{s.duration_minutes} Min</span>
                          <Button size="sm" variant="outline" onClick={() => removeSlot(s.id)} disabled={saving}>
                            Löschen
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* One-time appointments */}
            {slots.filter((s) => !s.is_recurring).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Einmalige Termine</h3>
                <div className="space-y-2">
                  {slots
                    .filter((s) => !s.is_recurring)
                    .map((s) => {
                      const dateStr = s.specific_date
                        ? new Date(s.specific_date + "T12:00:00").toLocaleDateString("de-DE", {
                            weekday: "short",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })
                        : "";
                      return (
                        <div key={s.id} className="flex flex-wrap items-center justify-between border rounded-md p-3 bg-green-50/30">
                          <div className="text-sm">
                            <Badge variant="outline" className="mr-2 bg-green-100 text-green-700 border-green-300">Einmalig</Badge>
                            <span className="font-medium mr-2">{dateStr}</span>
                            <span className="mr-2">{s.time_local.slice(0, 5)} Uhr</span>
                            <span className="mr-2">{s.format === "online" ? "Online" : "Vor Ort"}</span>
                            {s.format === "in_person" && s.address ? <span className="text-gray-600">{s.address}</span> : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{s.duration_minutes} Min</span>
                            <Button size="sm" variant="outline" onClick={() => removeSlot(s.id)} disabled={saving}>
                              Löschen
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
