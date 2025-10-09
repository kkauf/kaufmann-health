"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// Types mirror existing Admin API shapes
type TherapistMeta = {
  city?: string;
  session_preferences?: ("online" | "in_person")[];
  specializations?: string[];
};

type Therapist = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  gender?: string | null;
  accepting_new?: boolean;
  status: "pending_verification" | "verified" | "rejected" | string | null;
  metadata: TherapistMeta;
  created_at: string | null;
  opted_out?: boolean;
  profile?: {
    has_photo_pending?: boolean;
    has_photo_public?: boolean;
    has_approach_text?: boolean;
  };
  documents?: {
    has_license_doc?: boolean;
    has_specialization_docs?: boolean;
  };
  requires_action?: boolean;
};

type TherapistDetail = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  profile: {
    photo_pending_url?: string;
    approach_text?: string;
    photo_url?: string;
  };
};

function formatDate(iso?: string | null) {
  try {
    return iso ? new Date(iso).toLocaleString() : "";
  } catch {
    return iso || "";
  }
}

export default function AdminTherapistsPage() {
  // Filters
  const [status, setStatus] = useState<"pending_verification" | "verified" | "rejected">("pending_verification");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [specialization, setSpecialization] = useState<string>("");
  const [profileFilter, setProfileFilter] = useState<"all" | "complete" | "photo_only" | "approach_only" | "incomplete">("all");
  const [requireActionOnly, setRequireActionOnly] = useState<boolean>(true);
  const [optedOutOnly, setOptedOutOnly] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<Therapist[]>([]);

  // Modal state
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TherapistDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [approachText, setApproachText] = useState("");
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;

  // Bulk selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Upload state for admin-side uploads
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [specFiles, setSpecFiles] = useState<FileList | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);

  const toggleSelected = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return list.filter((t) => {
      const hay = [t.name || "", t.email || "", t.metadata?.city || ""].join(" ").toLowerCase();
      const matchesText = ql ? hay.includes(ql) : true;
      if (!matchesText) return false;
      if (requireActionOnly && !t.requires_action) return false;
      if (optedOutOnly && !t.opted_out) return false;
      if (profileFilter === "all") return true;
      const p = t.profile || {};
      const hasPhoto = Boolean(p.has_photo_pending || p.has_photo_public);
      const hasApproach = Boolean(p.has_approach_text);
      switch (profileFilter) {
        case "complete":
          return hasPhoto && hasApproach;
        case "photo_only":
          return hasPhoto && !hasApproach;
        case "approach_only":
          return !hasPhoto && hasApproach;
        case "incomplete":
          return !hasPhoto || !hasApproach;
        default:
          return true;
      }
    });
  }, [q, list, profileFilter, requireActionOnly, optedOutOnly]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [status, city, q, specialization, profileFilter, requireActionOnly, optedOutOnly, list.length]);

  const fetchTherapists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/admin/therapists", window.location.origin);
      if (status) url.searchParams.set("status", status);
      if (city.trim()) url.searchParams.set("city", city.trim());
      if (specialization.trim()) url.searchParams.set("specialization", specialization.trim());
      url.searchParams.set("limit", "200");
      const res = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Fehler beim Laden der Therapeuten");
      setList((json.data || []) as Therapist[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(msg);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [status, city, specialization]);

  useEffect(() => {
    fetchTherapists().catch(() => {});
  }, [fetchTherapists]);

  const openDetail = useCallback(async (id: string) => {
    setOpenId(id);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    setNotes("");
    setApproachText("");
    try {
      const res = await fetch(`/api/admin/therapists/${id}`, { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Laden fehlgeschlagen");
      const d = json.data as TherapistDetail;
      setDetail(d);
      setApproachText(d?.profile?.approach_text || "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setDetailError(msg);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setOpenId(null);
    setDetail(null);
    setNotes("");
    setApproachText("");
    setMessage(null);
    setDetailError(null);
  }, []);

  // Improve modal UX: Esc to close and prevent background scroll while open
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openId, closeDetail]);

  async function updateStatus(newStatus: "verified" | "rejected") {
    if (!openId) return;
    try {
      setUpdating(true);
      setMessage(null);
      type UpdatePayload = {
        status?: "pending_verification" | "verified" | "rejected";
        verification_notes?: string;
        approve_profile?: boolean;
        approach_text?: string;
      };
      const body: UpdatePayload = { status: newStatus };
      if (notes.trim()) body.verification_notes = notes.trim();
      if (approachText.trim()) body.approach_text = approachText.trim();
      const res = await fetch(`/api/admin/therapists/${openId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Update fehlgeschlagen");
      setMessage(newStatus === "verified" ? "Therapeut verifiziert" : "Therapeut abgelehnt");
      // Refresh list row
      await fetchTherapists();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setMessage(msg);
    } finally {
      setUpdating(false);
    }
  }

  async function handleBulkApproveProfiles(ids: string[]) {
    if (!ids.length) return;
    try {
      setUpdating(true);
      setMessage(null);
      for (const id of ids) {
        const t = list.find((x: Therapist) => x.id === id);
        const hasPending = Boolean(t?.profile?.has_photo_pending);
        if (!hasPending) continue;
        await fetch(`/api/admin/therapists/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ approve_profile: true }),
        });
      }
      setMessage("Ausgewählte Profilfotos freigegeben");
      setSelected(new Set());
      await fetchTherapists();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setMessage(msg);
    } finally {
      setUpdating(false);
    }
  }

  async function approveProfilePhoto() {
    if (!openId) return;
    try {
      setUpdating(true);
      setMessage(null);
      type UpdatePayload = {
        status?: "pending_verification" | "verified" | "rejected";
        verification_notes?: string;
        approve_profile?: boolean;
        approach_text?: string;
      };
      const body: UpdatePayload = { approve_profile: true };
      if (approachText.trim()) body.approach_text = approachText.trim();
      const res = await fetch(`/api/admin/therapists/${openId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Profil-Foto Freigabe fehlgeschlagen");
      setMessage("Profil-Foto freigegeben");
      await openDetail(openId); // reload details
      await fetchTherapists();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setMessage(msg);
    } finally {
      setUpdating(false);
    }
  }

  async function sendReminder() {
    if (!openId) return;
    try {
      setUpdating(true);
      setMessage(null);
      const res = await fetch(`/api/admin/therapists/${openId}/reminder`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erinnerung fehlgeschlagen");

      if (json?.data?.skipped) {
        const reason = json.data.reason;
        const reasonMap: Record<string, string> = {
          no_missing: "Keine fehlenden Informationen",
          opt_out: "Therapeut hat Erinnerungen abbestellt",
          capped: "Maximale Anzahl an Erinnerungen erreicht (3)",
          cooldown: "Erinnerung bereits kürzlich gesendet (Wartezeit: 7 Tage)",
        };
        setMessage(reasonMap[reason] || "Erinnerung übersprungen");
      } else {
        setMessage("Erinnerungs-E-Mail gesendet");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setMessage(msg);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <main className="min-h-screen p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Therapeuten-Verifizierung</h1>

      {message && (
        <p className="text-sm text-emerald-700" role="status">{message}</p>
      )}

      <section className="border rounded-md p-4">
        <div className="flex flex-wrap gap-3 mb-3 items-end">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "pending_verification" | "verified" | "rejected")}
            >
              <SelectTrigger className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending_verification">Ausstehend</SelectItem>
                <SelectItem value="verified">Verifiziert</SelectItem>
                <SelectItem value="rejected">Abgelehnt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="city">Stadt</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="z.B. Berlin" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="q">Suche</Label>
            <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name/Email/Stadt" />
          </div>
          <div className="space-y-1">
            <Label>Spezialisierung</Label>
            <Select value={specialization || "any"} onValueChange={(v) => setSpecialization(v === "any" ? "" : v)}>
              <SelectTrigger className="min-w-48">
                <SelectValue placeholder="Beliebig" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Beliebig</SelectItem>
                <SelectItem value="narm">NARM</SelectItem>
                <SelectItem value="somatic-experiencing">Somatic Experiencing</SelectItem>
                <SelectItem value="hakomi">Hakomi</SelectItem>
                <SelectItem value="core-energetics">Core Energetics</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Profil</Label>
            <Select
              value={profileFilter}
              onValueChange={(v: "all" | "complete" | "photo_only" | "approach_only" | "incomplete") => setProfileFilter(v)}
            >
              <SelectTrigger className="min-w-40">
                <SelectValue placeholder="Profilstatus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Profile</SelectItem>
                <SelectItem value="complete">Vollständig</SelectItem>
                <SelectItem value="photo_only">Nur Foto</SelectItem>
                <SelectItem value="approach_only">Nur Ansatz</SelectItem>
                <SelectItem value="incomplete">Unvollständig</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={fetchTherapists} disabled={loading}>{loading ? "Lädt…" : "Filtern"}</Button>
          <Button
            variant="outline"
            disabled={selected.size === 0 || updating}
            onClick={() => handleBulkApproveProfiles(Array.from(selected))}
          >
            {`Profilfotos freigeben (${selected.size})`}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-black"
              checked={requireActionOnly}
              onChange={(e) => setRequireActionOnly(e.target.checked)}
            />
            Nur mit Aktion
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-black"
              checked={optedOutOnly}
              onChange={(e) => setOptedOutOnly(e.target.checked)}
            />
            Nur Opt-out
          </label>
        </div>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

        {/* Guidelines */}
        <div className="mb-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Richtlinien zur Profilprüfung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs space-y-1">
                <p><strong>Foto:</strong></p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Professionelles Erscheinungsbild</li>
                  <li>Gesicht klar und gut beleuchtet</li>
                  <li>Angemessene Kleidung</li>
                  <li>Keine Texte/Logos</li>
                </ul>
                <p className="mt-2"><strong>Ansatz-Text:</strong></p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Fokus auf therapeutische Methode</li>
                  <li>2–3 Absätze</li>
                  <li>Professionelle Sprache</li>
                  <li>Klar und verständlich</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          {/* Pagination header */}
          <div className="flex items-center justify-between text-sm">
            <div>
              Zeige {total === 0 ? 0 : (page - 1) * pageSize + 1}
              –{Math.min(page * pageSize, total)} von {total}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Zurück</Button>
              <span>Seite {page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Weiter</Button>
            </div>
          </div>

          {paginated.map((t) => {
            const meta: TherapistMeta = t.metadata || {};
            const city = meta.city || "—";
            const prefs = Array.isArray(meta.session_preferences) && meta.session_preferences.length
              ? meta.session_preferences.map((p) => (p === "in_person" ? "Vor Ort" : "Online")).join("/")
              : "—";
            const specs = Array.isArray(meta.specializations) && meta.specializations.length
              ? meta.specializations.join(", ")
              : "—";
            const isPending = t.status === "pending_verification";
            const hasPhoto = Boolean(t.profile?.has_photo_pending || t.profile?.has_photo_public);
            const hasApproach = Boolean(t.profile?.has_approach_text);
            return (
              <Card key={t.id} className={isPending ? "border-amber-400 bg-amber-50" : undefined}>
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle className="truncate" title={t.name || undefined}>{t.name || "—"}</CardTitle>
                    <CardDescription className="truncate" title={t.email || undefined}>{t.email || "—"}</CardDescription>
                    {t.phone && (
                      <CardDescription className="truncate" title={t.phone || undefined}>
                        <a className="underline font-mono" href={`tel:${t.phone}`}>{t.phone}</a>
                      </CardDescription>
                    )}
                  </div>
                  <CardAction className="flex gap-2 items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-black"
                      checked={selected.has(t.id)}
                      onChange={() => toggleSelected(t.id)}
                      aria-label="Auswählen"
                    />
                    <Button size="sm" onClick={() => openDetail(t.id)}>Dokumente prüfen</Button>
                    <Button size="sm" variant="outline" onClick={() => openDetail(t.id)}>Details</Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">Stadt:</span> {city}</div>
                    <div><span className="text-gray-500">Sitzung:</span> {prefs}</div>
                    <div className="col-span-2"><span className="text-gray-500">Spezialisierung:</span> {specs}</div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-gray-500">Profil:</span>
                      <div className="flex items-center gap-2">
                        {hasPhoto && (<Badge variant="outline">Foto ✓</Badge>)}
                        {hasApproach && (<Badge variant="outline">Ansatz ✓</Badge>)}
                        {!hasPhoto || !hasApproach ? (
                          <Badge variant="secondary">Unvollständig</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-gray-500">E‑Mail‑Status:</span>
                      {t.opted_out ? <Badge variant="outline">Opt-out</Badge> : <span>Aktiv</span>}
                    </div>
                    <div className="col-span-2 text-xs text-gray-500">Eingang: {formatDate(t.created_at)}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && !loading && (
            <p className="px-3 py-6 text-center text-gray-500">Keine Therapeuten gefunden</p>
          )}
          {loading && (
            <p className="px-3 py-6 text-center text-gray-500">Laden…</p>
          )}
          {/* Pagination footer */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div>
                Zeige {total === 0 ? 0 : (page - 1) * pageSize + 1}
                –{Math.min(page * pageSize, total)} von {total}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Zurück</Button>
                <span>Seite {page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Weiter</Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modal */}
      {openId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={closeDetail} />
          <div
            className="relative w-full max-w-5xl h-[85vh] md:h-[80vh] rounded-lg bg-white shadow-lg flex flex-col"
          >
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Verifizierung</h2>
              <button className="text-sm underline" onClick={closeDetail} title="Esc zum Schließen">Schließen</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {detailLoading && <p className="text-sm text-gray-600">Laden…</p>}
              {detailError && <p className="text-sm text-red-600">{detailError}</p>}

              {detail && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="mb-2">
                      <div className="font-medium">{detail.name || "—"}</div>
                      <div className="text-sm text-gray-600">{detail.email || "—"}</div>
                      <div className="text-sm text-gray-600">{detail.city || "—"}</div>
                      <div className="text-xs text-gray-500">Status: {detail.status}</div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="approach">Therapie-Ansatz (max 500 Zeichen)</Label>
                      <textarea
                        id="approach"
                        rows={4}
                        className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        value={approachText}
                        onChange={(e) => setApproachText(e.target.value)}
                        maxLength={500}
                      />
                      <div className="text-xs text-gray-500">{approachText.length} / 500</div>
                    </div>

                    <details className="mt-2 rounded-md border bg-gray-50 open:bg-white">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Notizen (nur intern)</summary>
                      <div className="p-3 pt-1">
                        <Label htmlFor="notes" className="sr-only">Notizen (nur intern)</Label>
                        <textarea
                          id="notes"
                          rows={3}
                          className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                          placeholder="Begründung bei Ablehnung oder Hinweise"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                    </details>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="mb-2">
                        <div className="font-medium">Unterlagen</div>
                      </div>
                      {/* License document viewer */}
                      <div className="mb-3">
                        <div className="text-sm text-gray-700 mb-1">Lizenz</div>
                        <div className="border rounded-md overflow-hidden">
                          <iframe
                            title="Lizenz"
                            src={`/api/admin/therapists/${detail.id}/documents/license`}
                            className="w-full h-[360px]"
                          />
                        </div>
                        <div className="mt-1">
                          <a
                            className="text-xs underline text-blue-700"
                            href={`/api/admin/therapists/${detail.id}/documents/license`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Herunterladen
                          </a>
                        </div>
                        {/* Admin upload controls for documents */}
                        {detail.status === "pending_verification" ? (
                          <details className="mt-3 rounded-md border bg-gray-50 open:bg-white">
                          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Dateien hochladen (optional)</summary>
                          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="licenseFile">Lizenz hochladen (PDF/JPG/PNG)</Label>
                              <input
                                id="licenseFile"
                                type="file"
                                accept="application/pdf,image/jpeg,image/png"
                                onChange={(e) => setLicenseFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="specFiles">Spezialisierung (optional, mehrere)</Label>
                              <input
                                id="specFiles"
                                type="file"
                                accept="application/pdf,image/jpeg,image/png"
                                multiple
                                onChange={(e) => setSpecFiles(e.target.files)}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updating || (!licenseFile && (!specFiles || specFiles.length === 0))}
                                onClick={async () => {
                                  if (!detail?.id) return;
                                  try {
                                    setUpdating(true);
                                    setMessage(null);
                                    const fd = new FormData();
                                    if (licenseFile) fd.append('psychotherapy_license', licenseFile);
                                    if (specFiles) {
                                      Array.from(specFiles).forEach((f) => fd.append('specialization_cert', f));
                                    }
                                    const res = await fetch(`/api/public/therapists/${detail.id}/documents`, { method: 'POST', body: fd });
                                    const json = await res.json();
                                    if (!res.ok) throw new Error(json?.error || 'Upload fehlgeschlagen');
                                    setMessage('Dokumente hochgeladen');
                                    setLicenseFile(null);
                                    setSpecFiles(null);
                                    await openDetail(detail.id);
                                  } catch (e) {
                                    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
                                    setMessage(msg);
                                  } finally {
                                    setUpdating(false);
                                  }
                                }}
                              >
                                Dokumente hochladen
                              </Button>
                            </div>
                          </div>
                          </details>
                        ) : (
                          <p className="mt-2 text-xs text-gray-500">
                            Dokument-Uploads sind nur im Status <strong>Ausstehend</strong> möglich.
                          </p>
                        )}
                      </div>

                      {/* Profile Photo (pending/public) */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm text-gray-700">Profilfoto</div>
                          {detail.profile.photo_pending_url && (
                            <Button size="sm" variant="secondary" disabled={updating} onClick={approveProfilePhoto}>Profil-Foto freigeben</Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="border rounded-md p-2">
                            <div className="text-xs text-gray-600 mb-1">Pending</div>
                            {detail.profile.photo_pending_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={detail.profile.photo_pending_url} alt="Pending profile" className="max-h-60 w-auto rounded" />
                            ) : (
                              <div className="text-xs text-gray-500">Kein ausstehendes Foto</div>
                            )}
                            <details className="mt-2 rounded-md border bg-gray-50 open:bg-white">
                              <summary className="cursor-pointer px-2 py-1 text-sm font-medium">Foto hochladen</summary>
                              <div className="p-2">
                                <Label htmlFor="profilePhoto">Profilfoto hochladen (JPG/PNG)</Label>
                                <input
                                  id="profilePhoto"
                                  type="file"
                                  accept="image/jpeg,image/png"
                                  onChange={(e) => setProfilePhotoFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                                />
                                {detail.status !== 'pending_verification' && (
                                  <p className="mt-1 text-xs text-gray-500">Hinweis: Admin‑Upload wird sofort veröffentlicht.</p>
                                )}
                                <div className="mt-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={updating || !profilePhotoFile}
                                    onClick={async () => {
                                      if (!detail?.id || !profilePhotoFile) return;
                                      try {
                                        setUpdating(true);
                                        setMessage(null);
                                        const fd = new FormData();
                                        fd.append('profile_photo', profilePhotoFile);
                                        let res: Response;
                                        if (detail.status === 'pending_verification') {
                                          // Public endpoint stores pending photo; requires no admin auth
                                          res = await fetch(`/api/public/therapists/${detail.id}/documents`, { method: 'POST', body: fd });
                                        } else {
                                          // Admin-only endpoint publishes directly
                                          res = await fetch(`/api/admin/therapists/${detail.id}/photo`, { method: 'POST', body: fd, credentials: 'include' });
                                        }
                                        const json = await res.json();
                                        if (!res.ok) throw new Error(json?.error || 'Upload fehlgeschlagen');
                                        setMessage(detail.status === 'pending_verification' ? 'Profilfoto hochgeladen' : 'Profilfoto hochgeladen und veröffentlicht');
                                        setProfilePhotoFile(null);
                                        await openDetail(detail.id);
                                        await fetchTherapists();
                                      } catch (e) {
                                        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
                                        setMessage(msg);
                                      } finally {
                                        setUpdating(false);
                                      }
                                    }}
                                  >
                                    Foto hochladen
                                  </Button>
                                </div>
                              </div>
                            </details>
                          </div>
                          <div className="border rounded-md p-2">
                            <div className="text-xs text-gray-600 mb-1">Veröffentlicht</div>
                            {detail.profile.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={String(detail.profile.photo_url)} alt="Public profile" className="max-h-60 w-auto rounded" />
                            ) : (
                              <div className="text-xs text-gray-500">Noch nicht veröffentlicht</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t px-4 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-xs text-gray-500">Drücke Esc oder klicke außerhalb zum Schließen</div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="secondary" disabled={updating} onClick={() => updateStatus('verified')}>Freigeben</Button>
                  <Button size="sm" variant="destructive" disabled={updating} onClick={() => updateStatus('rejected')}>Ablehnen</Button>
                  <Button size="sm" variant="outline" disabled={updating} onClick={sendReminder}>Erinnerung senden</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
