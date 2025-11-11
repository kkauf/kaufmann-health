"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  documents: {
    has_license: boolean;
    has_specialization: boolean;
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
  const [status, setStatus] = useState<"pending_verification" | "verified" | "rejected">("verified");
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
  const [approvePhoto, setApprovePhoto] = useState(false);
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
    setApprovePhoto(false);
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
    setApprovePhoto(false);
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
      // Auto-approve photo if checkbox is checked and there's a pending photo
      if (approvePhoto && detail?.profile.photo_pending_url) {
        body.approve_profile = true;
      }
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
      // Close modal after successful verification
      setTimeout(closeDetail, 1500);
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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <header>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Therapeuten-Verifizierung</h1>
          <p className="mt-1 text-base text-gray-600">Prüfe und verwalte eingehende Therapeuten-Anträge</p>
        </header>

        <section className="bg-white rounded-lg shadow-sm border p-6">
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-4">Filter & Suche</h2>
          <div className="flex flex-wrap gap-3 items-end">
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
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>

        <div className="space-y-4">
          {/* Pagination header */}
          <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-4 py-3 border">
            <div className="font-medium text-gray-700">
              Zeige {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} von {total}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Zurück</Button>
              <span className="text-gray-600">Seite {page} / {totalPages}</span>
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
              <Card key={t.id} className={`transition-all hover:shadow-md ${isPending ? "border-amber-400 bg-amber-50/50" : "hover:border-gray-300"}`}>
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
                    <Link href={`/admin/therapists/${t.id}/slots`}>
                      <Button size="sm" variant="outline">Slots</Button>
                    </Link>
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
                        {hasPhoto && (<Badge className="bg-green-100 text-green-700 border-green-200">Foto ✓</Badge>)}
                        {hasApproach && (<Badge className="bg-green-100 text-green-700 border-green-200">Ansatz ✓</Badge>)}
                        {!hasPhoto || !hasApproach ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200">Unvollständig</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-gray-500">E‑Mail‑Status:</span>
                      {t.opted_out ? <Badge className="bg-red-100 text-red-700 border-red-200">Opt-out</Badge> : <span className="text-green-700 font-medium">Aktiv</span>}
                    </div>
                    <div className="col-span-2 text-xs text-gray-500">Eingang: {formatDate(t.created_at)}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && !loading && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
              <p className="text-gray-500">Keine Therapeuten gefunden</p>
              <p className="text-sm text-gray-400 mt-1">Versuche die Filter anzupassen</p>
            </div>
          )}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Laden...</span>
              </div>
              <p className="text-gray-500 mt-3">Lade Therapeuten...</p>
            </div>
          )}
          {/* Pagination footer */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-4 py-3 border">
              <div className="font-medium text-gray-700">
                Zeige {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} von {total}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Zurück</Button>
                <span className="text-gray-600">Seite {page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Weiter</Button>
              </div>
            </div>
          )}
        </div>
        </section>
      </div>

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

            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading && <p className="text-sm text-gray-600">Laden…</p>}
              {detailError && <p className="text-sm text-red-600">{detailError}</p>}

              {detail && (
                <div className="space-y-6">
                  {/* Header with therapist info and approval checklist */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{detail.name || "—"}</h3>
                        <div className="text-sm text-gray-600 mt-1">{detail.email || "—"}</div>
                        <div className="text-sm text-gray-600">{detail.city || "—"}</div>
                      </div>
                      <Badge 
                        variant={detail.status === "verified" ? "default" : "secondary"}
                        className={detail.status === "rejected" ? "bg-red-600 text-white border-transparent" : undefined}
                      >
                        {detail.status === "verified" ? "Verifiziert" : detail.status === "rejected" ? "Abgelehnt" : "Ausstehend"}
                      </Badge>
                    </div>

                    {/* Approval Checklist */}
                    <div className="bg-white rounded-md p-4 border border-blue-100">
                      <h4 className="font-medium text-sm mb-3 text-gray-900">Verifizierungs-Checkliste</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {detail.documents.has_license ? (
                            <Badge variant="default" className="bg-green-600 border-transparent text-white">✓ Lizenz vorhanden</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-red-600 text-white border-transparent">✗ Lizenz fehlt</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {detail.profile.photo_url ? (
                            <Badge variant="default" className="bg-green-600 border-transparent text-white">✓ Foto veröffentlicht</Badge>
                          ) : detail.profile.photo_pending_url ? (
                            <Badge variant="secondary" className="bg-amber-500 text-white border-transparent">⚠ Foto wartet auf Freigabe</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-red-600 text-white border-transparent">✗ Foto fehlt</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {detail.profile.approach_text && detail.profile.approach_text.length > 50 ? (
                            <Badge variant="default" className="bg-green-600 border-transparent text-white">✓ Ansatz-Text vorhanden</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-600 text-white border-transparent">⚠ Ansatz-Text fehlt/kurz</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left column: Documents */}
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg border p-4">
                        <h4 className="font-semibold text-base mb-3 flex items-center gap-2">
                          📄 Lizenz-Dokument
                          {detail.documents.has_license && <Badge variant="outline" className="text-green-700 border-green-700">Vorhanden</Badge>}
                        </h4>
                        {detail.documents.has_license ? (
                          <>
                            <div className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center bg-gray-50">
                              <div className="text-sm text-gray-700 mb-3">
                                📄 Lizenz-Dokument vorhanden
                              </div>
                              <p className="text-xs text-gray-500 mb-4">
                                Aus Sicherheitsgründen kann das Dokument nicht inline angezeigt werden.
                              </p>
                              <a
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                                href={`/api/admin/therapists/${detail.id}/documents/license`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                Dokument in neuem Tab öffnen
                              </a>
                            </div>
                          </>
                        ) : (
                          <div className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center">
                            <p className="text-sm text-gray-500 mb-2">Kein Lizenz-Dokument hochgeladen</p>
                            {detail.status === "pending_verification" && (
                              <details className="mt-3 text-left">
                                <summary className="cursor-pointer text-sm font-medium text-blue-700">Für Therapeut hochladen</summary>
                                <div className="mt-2 space-y-2">
                                  <input
                                    id="licenseFile"
                                    type="file"
                                    accept="application/pdf,image/jpeg,image/png"
                                    onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                                    className="text-sm"
                                  />
                                  <Button
                                    size="sm"
                                    disabled={updating || !licenseFile}
                                    onClick={async () => {
                                      if (!detail?.id || !licenseFile) return;
                                      try {
                                        setUpdating(true);
                                        setMessage(null);
                                        const fd = new FormData();
                                        fd.append('psychotherapy_license', licenseFile);
                                        const res = await fetch(`/api/public/therapists/${detail.id}/documents`, { method: 'POST', body: fd });
                                        const json = await res.json();
                                        if (!res.ok) throw new Error(json?.error || 'Upload fehlgeschlagen');
                                        setMessage('Lizenz hochgeladen');
                                        setLicenseFile(null);
                                        await openDetail(detail.id);
                                      } catch (e) {
                                        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
                                        setMessage(msg);
                                      } finally {
                                        setUpdating(false);
                                      }
                                    }}
                                  >
                                    Hochladen
                                  </Button>
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right column: Profile */}
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg border p-4">
                        <h4 className="font-semibold text-base mb-3 flex items-center gap-2">
                          📸 Profilfoto
                          {detail.profile.photo_url && <Badge variant="outline" className="text-green-700 border-green-700">Veröffentlicht</Badge>}
                          {!detail.profile.photo_url && detail.profile.photo_pending_url && <Badge variant="outline" className="text-amber-700 border-amber-700">Wartet auf Freigabe</Badge>}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Pending photo */}
                          <div className="border rounded-md p-3 bg-amber-50">
                            <div className="text-xs font-medium text-gray-700 mb-2">Zur Freigabe</div>
                            {detail.profile.photo_pending_url ? (
                              <div className="space-y-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={detail.profile.photo_pending_url} alt="Pending" className="w-full h-40 object-cover rounded" />
                                <Button
                                  size="sm"
                                  className="w-full"
                                  disabled={updating}
                                  onClick={approveProfilePhoto}
                                >
                                  Jetzt freigeben
                                </Button>
                              </div>
                            ) : (
                              <div className="h-40 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-500">
                                Kein Foto
                              </div>
                            )}
                          </div>

                          {/* Published photo */}
                          <div className="border rounded-md p-3 bg-green-50">
                            <div className="text-xs font-medium text-gray-700 mb-2">Veröffentlicht</div>
                            {detail.profile.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={String(detail.profile.photo_url)} alt="Public" className="w-full h-40 object-cover rounded" />
                            ) : (
                              <div className="h-40 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-500">
                                Noch nicht veröffentlicht
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Upload new photo */}
                        <details className="mt-3 border-t pt-3">
                          <summary className="cursor-pointer text-sm font-medium text-blue-700">Neues Foto hochladen</summary>
                          <div className="mt-2 space-y-2">
                            <input
                              id="profilePhoto"
                              type="file"
                              accept="image/jpeg,image/png"
                              onChange={(e) => setProfilePhotoFile(e.target.files?.[0] || null)}
                              className="text-sm w-full"
                            />
                            {detail.status !== 'pending_verification' && (
                              <p className="text-xs text-amber-700">⚠ Admin-Upload wird sofort veröffentlicht</p>
                            )}
                            <Button
                              size="sm"
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
                                    res = await fetch(`/api/public/therapists/${detail.id}/documents`, { method: 'POST', body: fd });
                                  } else {
                                    res = await fetch(`/api/admin/therapists/${detail.id}/photo`, { method: 'POST', body: fd, credentials: 'include' });
                                  }
                                  const json = await res.json();
                                  if (!res.ok) throw new Error(json?.error || 'Upload fehlgeschlagen');
                                  setMessage('Foto hochgeladen');
                                  setProfilePhotoFile(null);
                                  await openDetail(detail.id);
                                } catch (e) {
                                  const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
                                  setMessage(msg);
                                } finally {
                                  setUpdating(false);
                                }
                              }}
                            >
                              Hochladen
                            </Button>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>

                  {/* Approach text - full width */}
                  <div className="bg-white rounded-lg border p-4">
                    <h4 className="font-semibold text-base mb-3 flex items-center gap-2">
                      ✍️ Therapie-Ansatz
                      {detail.profile.approach_text && detail.profile.approach_text.length > 50 && (
                        <Badge variant="outline" className="text-green-700 border-green-700">Vorhanden</Badge>
                      )}
                    </h4>
                    <div className="space-y-2">
                      <textarea
                        id="approach"
                        rows={5}
                        className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        value={approachText}
                        onChange={(e) => setApproachText(e.target.value)}
                        maxLength={500}
                        placeholder="Beschreibung des therapeutischen Ansatzes..."
                      />
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Max. 500 Zeichen</span>
                        <span className={approachText.length > 450 ? "text-amber-600 font-medium" : ""}>{approachText.length} / 500</span>
                      </div>
                    </div>
                  </div>

                  {/* Internal notes */}
                  <details className="bg-gray-50 rounded-lg border open:bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-gray-100 rounded-lg">📝 Interne Notizen (nur für Admins sichtbar)</summary>
                    <div className="p-4 pt-2">
                      <textarea
                        id="notes"
                        rows={3}
                        className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                        placeholder="Begründung bei Ablehnung oder interne Hinweise..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </details>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t px-6 py-4 shadow-lg">
              {message && (
                <div className={`mb-3 p-3 rounded-md text-sm ${message.includes('fehlgeschlagen') || message.includes('Fehler') ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                  {message}
                </div>
              )}
              <div className="flex flex-col gap-4">
                {/* Photo approval checkbox - only show if there's a pending photo */}
                {detail?.profile.photo_pending_url && !detail?.profile.photo_url && (
                  <label className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md cursor-pointer hover:bg-amber-100">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-green-600"
                      checked={approvePhoto}
                      onChange={(e) => setApprovePhoto(e.target.checked)}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">Profilfoto bei Freigabe automatisch veröffentlichen</div>
                      <div className="text-xs text-gray-600 mt-0.5">Wenn aktiviert, wird das Foto zusammen mit der Verifizierung freigegeben</div>
                    </div>
                  </label>
                )}
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="text-xs text-gray-500">
                    <kbd className="px-2 py-1 bg-gray-100 border rounded text-xs">Esc</kbd> zum Schließen
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" disabled={updating} onClick={sendReminder}>
                      📧 Erinnerung
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50"
                      disabled={updating} 
                      onClick={() => updateStatus('rejected')}
                    >
                      ✗ Ablehnen
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={updating} 
                      onClick={() => updateStatus('verified')}
                    >
                      ✓ Freigeben {approvePhoto && detail?.profile.photo_pending_url ? '(inkl. Foto)' : ''}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
