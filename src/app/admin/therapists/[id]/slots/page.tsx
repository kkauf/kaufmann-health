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

  const [day, setDay] = useState<number | "">("");
  const [time, setTime] = useState<string>("");
  const [format, setFormat] = useState<"online" | "in_person">("online");
  const [address, setAddress] = useState<string>("");
  const [duration, setDuration] = useState<string>("60");
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  // Quick add by date
  const [quickDate, setQuickDate] = useState<string>(""); // YYYY-MM-DD
  const [quickTime, setQuickTime] = useState<string>(""); // HH:MM

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
      const d = typeof day === "number" ? day : NaN;
      if (!Number.isInteger(d)) throw new Error("Wochentag wählen");
      if (!/^\d{2}:\d{2}$/.test(time)) throw new Error("Zeit im Format HH:MM eingeben");
      if (format === "in_person" && !address.trim()) throw new Error("Adresse angeben");
      const durationNum = parseInt(duration);
      if (isNaN(durationNum) || durationNum < 30 || durationNum > 240) {
        throw new Error("Dauer muss zwischen 30 und 240 Minuten liegen");
      }
      const body = {
        slots: [
          {
            day_of_week: d,
            time_local: time.slice(0, 5),
            format,
            address: format === "in_person" ? address.trim() : "",
            duration_minutes: durationNum,
            active: true,
          },
        ],
      };
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
      setDay("");
      setTime("");
      setAddress("");
      setDuration(String(durationNum));
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

  function applyQuickDate() {
    try {
      if (!quickDate) throw new Error("Datum wählen");
      if (!/^\d{2}:\d{2}$/.test(quickTime)) throw new Error("Zeit wählen (HH:MM)");
      const d = new Date(quickDate + "T12:00:00"); // noon to avoid TZ edge cases
      const dow = d.getDay(); // 0=So,1=Mo,...
      setDay(dow as 0 | 1 | 2 | 3 | 4 | 5 | 6);
      setTime(quickTime);
      setMessage(null);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ungültiges Datum/Zeit";
      setError(msg);
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
            <CardTitle className="text-base">Neue Terminserie hinzufügen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 rounded-md border p-3 bg-slate-50">
              <div className="text-sm font-medium mb-2">Schnell hinzufügen (ein bestimmtes Datum)</div>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-1 flex-1 min-w-0">
                  <Label>Datum</Label>
                  <Input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <Label>Uhrzeit</Label>
                  <Input type="time" value={quickTime} onChange={(e) => setQuickTime(e.target.value)} />
                </div>
                <div className="flex-shrink-0 sm:ml-auto">
                  <Button type="button" variant="outline" onClick={applyQuickDate} className="w-full sm:w-auto whitespace-nowrap">Wochentag & Zeit übernehmen</Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-600">Hinweis: Der Termin wird als wöchentliche Serie gespeichert. Einmalige Termine bitte später wieder entfernen.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
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
              <div className="space-y-1 lg:col-span-2">
                <Label>Uhrzeit</Label>
                <Input type="time" placeholder="HH:MM" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="space-y-1 lg:col-span-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={(v: "online" | "in_person") => setFormat(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="in_person">Vor Ort</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                <Label>Adresse (bei Vor Ort)</Label>
                <Input placeholder="Straße, PLZ Ort" value={address} onChange={(e) => setAddress(e.target.value)} disabled={format !== "in_person"} />
              </div>
              <div className="space-y-1 lg:col-span-2">
                <Label>Dauer (Minuten)</Label>
                <Input type="number" min={30} max={240} value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
              <div className="lg:col-span-1">
                <Button onClick={addSlot} disabled={saving || activeCount >= 5} className="w-full">{saving ? "Speichert…" : "Hinzufügen"}</Button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Maximal 5 aktive Serien pro Therapeut:in.</p>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            {message && <p className="text-sm text-emerald-700 mt-2">{message}</p>}
          </CardContent>
        </Card>
      </section>

      <section className="border rounded-md p-4">
        <h2 className="text-base font-semibold mb-3">Aktive Serien</h2>
        {loading ? (
          <p className="text-sm text-gray-600">Laden…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-gray-600">Keine Serien vorhanden</p>
        ) : (
          <div className="space-y-2">
            {slots.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between border rounded-md p-3">
                <div className="text-sm">
                  <span className="font-medium mr-2">{DAYS.find((d) => d.value === s.day_of_week)?.label || s.day_of_week}</span>
                  <span className="mr-2">{s.time_local.slice(0,5)} Uhr</span>
                  <span className="mr-2">{s.format === "online" ? "Online" : "Vor Ort"}</span>
                  {s.format === "in_person" && s.address ? <span className="text-gray-600">{s.address}</span> : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{s.duration_minutes} Min</span>
                  <Button size="sm" variant="outline" onClick={() => removeSlot(s.id)} disabled={saving}>Löschen</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
