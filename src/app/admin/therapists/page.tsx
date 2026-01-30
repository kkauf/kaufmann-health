"use client";

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageCropper } from "@/components/ImageCropper";
import { TherapistDetailModal } from "@/features/therapists/components/TherapistDetailModal";
import type { TherapistData } from "@/lib/therapist-mapper";
import { Eye } from "lucide-react";

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
  status: "pending_verification" | "verified" | "rejected" | "declined" | string | null;
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
  is_test?: boolean;
  is_hidden?: boolean;
  cal_slots?: {
    intro: number;
    full: number;
  };
};

type RejectionHistoryItem = {
  sent_at: string;
  admin_notes: string | null;
  missing_documents: boolean;
  photo_issue: string | null;
  approach_issue: string | null;
};

type DataCompleteness = {
  has_name: boolean;
  has_email: boolean;
  has_phone: boolean;
  has_city: boolean;
  has_who_comes_to_me: boolean;
  has_session_values: boolean;
  has_first_session_expectations: boolean;
  has_about_me: boolean;
  has_approach_text: boolean;
  has_practice_address: boolean;
  has_billing_address: boolean;
  has_photo: boolean;
  has_license: boolean;
  has_specialization: boolean;
};

type TherapistDetail = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  hidden?: boolean;
  profile: {
    photo_pending_url?: string;
    approach_text?: string;
    photo_url?: string;
  };
  documents: {
    has_license: boolean;
    has_specialization: boolean;
    specialization_certs?: Record<string, string[]>; // { slug: [paths] }
  };
  modalities?: string[]; // Selected modalities from signup (e.g., ['narm', 'se'])
  // Cal.com integration
  cal_username?: string | null;
  cal_enabled?: boolean;
  cal_user_id?: number | null;
  // Rejection history
  rejection_history?: RejectionHistoryItem[];
  // Data completeness
  data_completeness?: DataCompleteness;
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
  const [status, setStatus] = useState<"pending_verification" | "verified" | "rejected" | "declined">("verified");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [specialization, setSpecialization] = useState<string>("");
  const [profileFilter, setProfileFilter] = useState<"all" | "complete" | "photo_only" | "approach_only" | "incomplete">("all");
  const [requireActionOnly, setRequireActionOnly] = useState<boolean>(true);
  const [optedOutOnly, setOptedOutOnly] = useState<boolean>(false);
  const [testAccountsOnly, setTestAccountsOnly] = useState<boolean>(false);

  // Detect staging environment for showing test filter
  const [isStaging, setIsStaging] = useState(false);
  useEffect(() => {
    const host = window.location.hostname;
    setIsStaging(host === 'staging.kaufmann-health.de' || host === 'localhost' || host === '127.0.0.1');
  }, []);

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
  const [editedCity, setEditedCity] = useState("");
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [_approvePhoto, setApprovePhoto] = useState(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  // Cal.com integration state
  const [calUsername, setCalUsername] = useState<string>("");
  const [calEnabled, setCalEnabled] = useState<boolean>(false);
  // Hidden profile state
  const [profileHidden, setProfileHidden] = useState<boolean>(false);
  const [calStatus, setCalStatus] = useState<{
    provisioned: boolean;
    ready_for_bookings: boolean;
    issues: string[];
    booking_url: string | null;
    event_types: {
      intro: { exists: boolean; visible: boolean; has_schedule: boolean; schedule_name?: string } | null;
      full_session: { exists: boolean; visible: boolean; has_schedule: boolean; schedule_name?: string } | null;
    };
    schedules: { id: number; name: string; has_availability: boolean }[];
  } | null>(null);
  const [calStatusLoading, setCalStatusLoading] = useState(false);

  // Bulk selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Upload state for admin-side uploads
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [specFiles, setSpecFiles] = useState<FileList | null>(null);
  
  // Image cropper state
  const [showCropper, setShowCropper] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Profile preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<TherapistData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
      // Test accounts filter: when enabled, only show test accounts
      if (testAccountsOnly && !t.is_test) return false;
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
  }, [q, list, profileFilter, requireActionOnly, optedOutOnly, testAccountsOnly]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [status, city, q, specialization, profileFilter, requireActionOnly, optedOutOnly, testAccountsOnly, list.length]);

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
      // Use startTransition to prevent blocking UI during large list re-render
      startTransition(() => {
        setList((json.data || []) as Therapist[]);
      });
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
    setEditedCity("");
    setApprovePhoto(false);
    setCalUsername("");
    setCalEnabled(false);
    setProfileHidden(false);
    try {
      const res = await fetch(`/api/admin/therapists/${id}`, { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Laden fehlgeschlagen");
      const d = json.data as TherapistDetail;
      setDetail(d);
      setApproachText(d?.profile?.approach_text || "");
      setEditedCity(d?.city || "");
      setCalUsername(d?.cal_username || "");
      setCalEnabled(Boolean(d?.cal_enabled));
      setProfileHidden(Boolean(d?.hidden));
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
    setEditedCity("");
    setMessage(null);
    setDetailError(null);
    setApprovePhoto(false);
    setCalUsername("");
    setCalEnabled(false);
    setCalStatus(null);
    setProfileHidden(false);
  }, []);

  const openPreview = useCallback(async (therapistId: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/therapists/${therapistId}/preview`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Fehler beim Laden der Vorschau");
      setPreviewData(json.data as TherapistData);
      setPreviewOpen(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setMessage(msg);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewData(null);
  }, []);

  const fetchCalStatus = useCallback(async (therapistId: string) => {
    setCalStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/therapists/${therapistId}/cal-status`, { credentials: "include", cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.data) {
        setCalStatus(json.data);
      }
    } catch {
      // Ignore errors, just don't show status
    } finally {
      setCalStatusLoading(false);
    }
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

  async function updateStatus(newStatus: "verified" | "rejected" | "declined") {
    if (!openId) return;
    // Declined requires a reason
    if (newStatus === 'declined' && !notes.trim()) {
      setMessage('Bitte gib einen Grund für die Ablehnung an (wird dem Therapeuten mitgeteilt).');
      return;
    }
    try {
      setUpdating(true);
      setMessage(null);
      type UpdatePayload = {
        status?: "pending_verification" | "verified" | "rejected" | "declined";
        verification_notes?: string;
        approve_profile?: boolean;
        approach_text?: string;
      };
      const body: UpdatePayload = { status: newStatus };
      if (notes.trim()) body.verification_notes = notes.trim();
      // Auto-approve photo when verifying (simplified flow)
      if (newStatus === 'verified' && detail?.profile.photo_pending_url) {
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
      const statusMsg = newStatus === "verified" ? "Therapeut verifiziert" : 
                        newStatus === "declined" ? "Therapeut abgelehnt (E-Mail gesendet)" : 
                        "Rückfrage gesendet";
      setMessage(statusMsg);
      // Refresh list row
      await fetchTherapists();
      // Close modal after successful action
      setTimeout(closeDetail, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setMessage(msg);
    } finally {
      setUpdating(false);
    }
  }

  async function saveCalSettings() {
    if (!openId) return;
    try {
      setUpdating(true);
      setMessage(null);
      const res = await fetch(`/api/admin/therapists/${openId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cal_username: calUsername.trim() || null, cal_enabled: calEnabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Update fehlgeschlagen");
      setMessage("Cal.com Einstellungen gespeichert");
      await openDetail(openId);
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
              onValueChange={(v) => setStatus(v as "pending_verification" | "verified" | "rejected" | "declined")}
            >
              <SelectTrigger className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending_verification">Ausstehend</SelectItem>
                <SelectItem value="verified">Verifiziert</SelectItem>
                <SelectItem value="rejected">Rückfrage</SelectItem>
                <SelectItem value="declined">Abgelehnt</SelectItem>
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
          {isStaging && (
            <label className="flex items-center gap-2 text-sm text-orange-600 font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-orange-500"
                checked={testAccountsOnly}
                onChange={(e) => setTestAccountsOnly(e.target.checked)}
              />
              Nur Test-Accounts
            </label>
          )}
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
            const _hasApproach = Boolean(t.profile?.has_approach_text);
            return (
              <Card key={t.id} className={`transition-all hover:shadow-md ${isPending ? "border-amber-400 bg-amber-50/50" : "hover:border-gray-300"}`}>
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle className="truncate flex items-center gap-2" title={t.name || undefined}>
                      {t.name || "—"}
                      {t.is_test && <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">TEST</Badge>}
                      {t.is_hidden && <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">VERSTECKT</Badge>}
                    </CardTitle>
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
                        {hasPhoto && (<Badge className="bg-green-100 text-green-700 border-green-200">Foto ✓</Badge>)}
                        {!hasPhoto ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200">Foto fehlt</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-gray-500">E‑Mail‑Status:</span>
                      {t.opted_out ? <Badge className="bg-red-100 text-red-700 border-red-200">Opt-out</Badge> : <span className="text-green-700 font-medium">Aktiv</span>}
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-gray-500">Kapazität:</span>
                      {t.accepting_new !== false ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Verfügbar</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-red-200">Keine Kapazität</Badge>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-gray-500">Cal-Slots:</span>
                      <Badge className={t.cal_slots?.intro ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                        {t.cal_slots?.intro || 0} Intro
                      </Badge>
                      <Badge className={t.cal_slots?.full ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                        {t.cal_slots?.full || 0} Sitzung
                      </Badge>
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
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            value={editedCity}
                            onChange={(e) => setEditedCity(e.target.value)}
                            placeholder="Stadt"
                            className="h-7 w-40 text-sm"
                          />
                          {editedCity !== (detail.city || "") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={updating}
                              onClick={async () => {
                                setUpdating(true);
                                try {
                                  const res = await fetch(`/api/admin/therapists/${detail.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ city: editedCity.trim() }),
                                  });
                                  const json = await res.json();
                                  if (!res.ok) throw new Error(json?.error || "Speichern fehlgeschlagen");
                                  setMessage("Stadt gespeichert");
                                  // Update local detail state
                                  setDetail((prev) => prev ? { ...prev, city: editedCity.trim() } : prev);
                                  // Refresh list
                                  void fetchTherapists();
                                } catch (e) {
                                  const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
                                  setMessage(msg);
                                } finally {
                                  setUpdating(false);
                                }
                              }}
                            >
                              Speichern
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Preview button - shows what users see in /therapeuten */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={previewLoading}
                          onClick={() => detail.id && openPreview(detail.id)}
                          title="Profil-Vorschau anzeigen (wie Nutzer es sehen)"
                        >
                          <Eye className="h-4 w-4" />
                          {previewLoading ? "..." : "Vorschau"}
                        </Button>
                        {/* Hide toggle - subtle button for verified therapists */}
                        {detail.status === 'verified' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={`gap-1.5 ${profileHidden ? 'border-red-300 text-red-700 hover:bg-red-50' : 'text-gray-500 hover:text-gray-700'}`}
                            disabled={updating}
                            onClick={async () => {
                              const newHiddenState = !profileHidden;
                              const confirmMsg = newHiddenState
                                ? 'Profil verstecken? Das Profil wird aus dem öffentlichen Verzeichnis entfernt.'
                                : 'Profil wieder sichtbar machen?';
                              if (!window.confirm(confirmMsg)) return;
                              try {
                                setUpdating(true);
                                setMessage(null);
                                const res = await fetch(`/api/admin/therapists/${detail.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ hidden: newHiddenState }),
                                });
                                const json = await res.json();
                                if (!res.ok) throw new Error(json?.error || 'Update fehlgeschlagen');
                                setProfileHidden(newHiddenState);
                                setMessage(newHiddenState ? 'Profil versteckt' : 'Profil wieder sichtbar');
                                void fetchTherapists();
                              } catch (e) {
                                const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
                                setMessage(msg);
                              } finally {
                                setUpdating(false);
                              }
                            }}
                            title={profileHidden
                              ? 'Profil wieder im Verzeichnis anzeigen'
                              : 'Profil aus dem Verzeichnis entfernen (z.B. bei Bounce-E-Mails)'}
                          >
                            {profileHidden ? '🚫 Versteckt' : '👁️'}
                          </Button>
                        )}
                        <Badge
                          variant={detail.status === "verified" ? "default" : "secondary"}
                          className={
                            detail.status === "declined" ? "bg-red-600 text-white border-transparent" :
                            detail.status === "rejected" ? "bg-amber-500 text-white border-transparent" : undefined
                          }
                        >
                          {detail.status === "verified" ? "Verifiziert" :
                           detail.status === "declined" ? "Abgelehnt" :
                           detail.status === "rejected" ? "Rückfrage" : "Ausstehend"}
                        </Badge>
                      </div>
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
                        {/* Approach text no longer required during onboarding - therapists complete in portal after verification */}
                      </div>
                    </div>

                    {/* Data Completeness Overview */}
                    {detail.data_completeness && (
                      <div className="bg-white rounded-md p-4 border border-gray-200 mt-4">
                        <h4 className="font-medium text-sm mb-3 text-gray-900">📋 Datenvollständigkeit</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className={detail.data_completeness.has_name ? "text-green-600" : "text-red-500"}>
                              {detail.data_completeness.has_name ? "✓" : "✗"}
                            </span>
                            <span className="text-gray-600">Name</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={detail.data_completeness.has_email ? "text-green-600" : "text-red-500"}>
                              {detail.data_completeness.has_email ? "✓" : "✗"}
                            </span>
                            <span className="text-gray-600">E-Mail</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={detail.data_completeness.has_phone ? "text-green-600" : "text-gray-400"}>
                              {detail.data_completeness.has_phone ? "✓" : "–"}
                            </span>
                            <span className="text-gray-600">Telefon</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={detail.data_completeness.has_city ? "text-green-600" : "text-red-500"}>
                              {detail.data_completeness.has_city ? "✓" : "✗"}
                            </span>
                            <span className="text-gray-600">Stadt</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={detail.data_completeness.has_practice_address ? "text-green-600" : "text-gray-400"}>
                              {detail.data_completeness.has_practice_address ? "✓" : "–"}
                            </span>
                            <span className="text-gray-600">Praxisadresse</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={detail.data_completeness.has_billing_address ? "text-green-600" : "text-amber-500"}>
                              {detail.data_completeness.has_billing_address ? "✓" : "⚠"}
                            </span>
                            <span className="text-gray-600">Rechnungsadresse</span>
                          </div>
                          <div className="col-span-2 border-t pt-1 mt-1"></div>
                          <div className="flex items-center gap-1.5">
                            <span className={detail.data_completeness.has_who_comes_to_me ? "text-green-600" : "text-gray-400"}>
                              {detail.data_completeness.has_who_comes_to_me ? "✓" : "–"}
                            </span>
                            <span className="text-gray-600">Profil: Wer kommt</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={detail.data_completeness.has_session_values ? "text-green-600" : "text-gray-400"}>
                              {detail.data_completeness.has_session_values ? "✓" : "–"}
                            </span>
                            <span className="text-gray-600">Profil: Sitzungswerte</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={detail.data_completeness.has_first_session_expectations ? "text-green-600" : "text-gray-400"}>
                              {detail.data_completeness.has_first_session_expectations ? "✓" : "–"}
                            </span>
                            <span className="text-gray-600">Profil: Erste Sitzung</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={detail.data_completeness.has_about_me ? "text-green-600" : "text-gray-400"}>
                              {detail.data_completeness.has_about_me ? "✓" : "–"}
                            </span>
                            <span className="text-gray-600">Profil: Über mich</span>
                          </div>
                        </div>
                        {!detail.data_completeness.has_billing_address && (
                          <p className="text-xs text-amber-600 mt-2">
                            ⚠ Rechnungsadresse fehlt (für Abrechnungen erforderlich)
                          </p>
                        )}
                      </div>
                    )}
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
                                Aus Sicherheitsgründen kann das Dokument nicht direkt angezeigt werden.
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
                            {(detail.status === "pending_verification" || detail.status === "rejected") && (
                              <div className="mt-3 pt-3 border-t">
                                <input
                                  id="licenseFile"
                                  type="file"
                                  accept="application/pdf,image/jpeg,image/png"
                                  className="hidden"
                                  onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                                />
                                {!licenseFile ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => document.getElementById('licenseFile')?.click()}
                                  >
                                    📤 Lizenz hochladen
                                  </Button>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-green-700 flex-1">✓ {licenseFile.name}</span>
                                    <Button
                                      size="sm"
                                      disabled={updating}
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
                                      Speichern
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setLicenseFile(null)}
                                    >
                                      ✕
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Modalities & Specialization Certs */}
                      <div className="bg-white rounded-lg border p-4">
                        <h4 className="font-semibold text-base mb-3 flex items-center gap-2">
                          🎓 Spezialisierung
                          {detail.documents.has_specialization && <Badge variant="outline" className="text-green-700 border-green-700">Vorhanden</Badge>}
                        </h4>
                        
                        {/* Selected modalities */}
                        {detail.modalities && detail.modalities.length > 0 ? (
                          <div className="mb-3">
                            <div className="text-sm text-gray-600 mb-2">Gewählte Modalitäten:</div>
                            <div className="flex flex-wrap gap-2">
                              {detail.modalities.map((mod) => (
                                <Badge key={mod} className="bg-indigo-100 text-indigo-700 border-indigo-200 uppercase text-xs">
                                  {mod}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 mb-3">Keine Modalität ausgewählt</p>
                        )}

                        {/* Specialization certificates */}
                        {detail.documents.specialization_certs && Object.keys(detail.documents.specialization_certs).length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-sm text-gray-600">Zertifikate:</div>
                            {Object.entries(detail.documents.specialization_certs).map(([slug, paths]) => (
                              <div key={slug} className="flex items-center gap-2">
                                <Badge variant="outline" className="uppercase text-xs">{slug}</Badge>
                                {paths.map((path, idx) => (
                                  <a
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100"
                                    href={`/api/admin/therapists/${detail.id}/documents/specialization/${slug}/${idx}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    📄 Zertifikat {idx + 1}
                                  </a>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Keine Spezialisierungs-Zertifikate hochgeladen</p>
                        )}

                        {/* Admin cert upload */}
                        {(detail.status === "pending_verification" || detail.status === "rejected") && (
                          <div className="mt-3 pt-3 border-t">
                            <input
                              id="specFiles"
                              type="file"
                              accept="application/pdf,image/jpeg,image/png"
                              multiple
                              className="hidden"
                              onChange={(e) => setSpecFiles(e.target.files)}
                            />
                            {!specFiles?.length ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() => document.getElementById('specFiles')?.click()}
                              >
                                📤 Zertifikate hochladen
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-green-700 flex-1">✓ {specFiles.length} Datei(en)</span>
                                <Button
                                  size="sm"
                                  disabled={updating}
                                  onClick={async () => {
                                    if (!detail?.id || !specFiles?.length) return;
                                    try {
                                      setUpdating(true);
                                      setMessage(null);
                                      const fd = new FormData();
                                      Array.from(specFiles).forEach((f) => fd.append('specialization_cert', f));
                                      const res = await fetch(`/api/public/therapists/${detail.id}/documents`, { method: 'POST', body: fd });
                                      const json = await res.json();
                                      if (!res.ok) throw new Error(json?.error || 'Upload fehlgeschlagen');
                                      setMessage('Zertifikate hochgeladen');
                                      setSpecFiles(null);
                                      const input = document.getElementById('specFiles') as HTMLInputElement;
                                      if (input) input.value = '';
                                      await openDetail(detail.id);
                                    } catch (e) {
                                      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
                                      setMessage(msg);
                                    } finally {
                                      setUpdating(false);
                                    }
                                  }}
                                >
                                  Speichern
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSpecFiles(null);
                                    const input = document.getElementById('specFiles') as HTMLInputElement;
                                    if (input) input.value = '';
                                  }}
                                >
                                  ✕
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right column: Profile Photo */}
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg border p-4">
                        <h4 className="font-semibold text-base mb-3 flex items-center gap-2">
                          📸 Profilfoto
                          {detail.profile.photo_url && !detail.profile.photo_pending_url && (
                            <Badge className="bg-green-100 text-green-700 border-green-200">✓ Veröffentlicht</Badge>
                          )}
                          {detail.profile.photo_pending_url && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200">Wartet auf Freigabe</Badge>
                          )}
                          {!detail.profile.photo_url && !detail.profile.photo_pending_url && (
                            <Badge className="bg-red-100 text-red-700 border-red-200">Fehlt</Badge>
                          )}
                        </h4>

                        {/* Single photo display */}
                        <div className="flex flex-col items-center">
                          {(detail.profile.photo_pending_url || detail.profile.photo_url) ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={detail.profile.photo_pending_url || String(detail.profile.photo_url)} 
                                alt="Profilfoto" 
                                className="w-32 h-32 object-cover rounded-full border-4 border-gray-200 mb-3" 
                              />
                              {detail.profile.photo_pending_url && detail.profile.photo_url && (
                                <p className="text-xs text-gray-500 mb-2">Neues Foto wartet auf Freigabe</p>
                              )}
                            </>
                          ) : (
                            <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3 border-4 border-gray-200">
                              <span className="text-3xl">👤</span>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex flex-wrap gap-2 justify-center">
                            {detail.profile.photo_pending_url && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={updating}
                                  onClick={() => {
                                    setCropperImageSrc(detail.profile.photo_pending_url!);
                                    setShowCropper(true);
                                  }}
                                >
                                  ✂️ Zuschneiden
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={updating}
                                  onClick={approveProfilePhoto}
                                >
                                  ✓ Freigeben
                                </Button>
                              </>
                            )}
                            <input
                              ref={photoInputRef}
                              type="file"
                              accept="image/jpeg,image/png"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const url = URL.createObjectURL(file);
                                  setCropperImageSrc(url);
                                  setShowCropper(true);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => photoInputRef.current?.click()}
                            >
                              📤 {detail.profile.photo_pending_url || detail.profile.photo_url ? 'Ersetzen' : 'Hochladen'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cal.com Integration - only show for verified therapists */}
                  {detail.status === 'verified' && (
                  <div className="bg-white rounded-lg border p-4">
                    <h4 className="font-semibold text-base mb-3 flex items-center gap-2">
                      📅 Cal.com Integration
                      {calStatus?.ready_for_bookings ? (
                        <Badge variant="outline" className="text-green-700 border-green-700 bg-green-50">✓ Buchbar</Badge>
                      ) : calStatus && !calStatus.ready_for_bookings ? (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">⚠ Probleme</Badge>
                      ) : detail.cal_enabled && detail.cal_username ? (
                        <Badge variant="outline" className="text-blue-600 border-blue-300">Aktiv</Badge>
                      ) : null}
                      {detail.cal_user_id && !calStatus && (
                        <Badge variant="outline" className="text-gray-500 border-gray-300">ID: {detail.cal_user_id}</Badge>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-6 px-2 text-xs"
                        disabled={calStatusLoading}
                        onClick={() => detail?.id && fetchCalStatus(detail.id)}
                      >
                        {calStatusLoading ? '...' : '🔄 Status prüfen'}
                      </Button>
                    </h4>
                    
                    {/* Health Status Display */}
                    {calStatus && (
                      <div className={`mb-4 p-3 rounded-md text-sm ${calStatus.ready_for_bookings ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                        {calStatus.ready_for_bookings ? (
                          <p className="text-green-800 font-medium">✓ Terminbuchung funktioniert</p>
                        ) : (
                          <>
                            <p className="text-amber-800 font-medium mb-2">⚠ Folgende Probleme gefunden:</p>
                            <ul className="list-disc list-inside text-amber-700 space-y-1">
                              {calStatus.issues.map((issue, i) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                          </>
                        )}
                        {calStatus.booking_url && (
                          <p className="mt-2 text-xs text-gray-600">
                            Buchungsseite: <a href={calStatus.booking_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{calStatus.booking_url}</a>
                          </p>
                        )}
                        {calStatus.schedules.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer">Zeitpläne anzeigen</summary>
                            <ul className="mt-1 text-xs text-gray-600 space-y-0.5">
                              {calStatus.schedules.map(s => (
                                <li key={s.id} className="flex items-center gap-1">
                                  {s.has_availability ? '✓' : '⚠'} {s.name}
                                  {!s.has_availability && <span className="text-amber-600">(keine Verfügbarkeit)</span>}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="cal_username" className="text-sm font-medium">Cal.com Benutzername</Label>
                        <div className="flex gap-2 mt-1">
                          <input
                            id="cal_username"
                            type="text"
                            className="border-input placeholder:text-muted-foreground flex-1 rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            value={calUsername}
                            onChange={(e) => setCalUsername(e.target.value)}
                            placeholder="z.B. max-mustermann"
                          />
                        </div>
                        {calUsername && (
                          <p className="text-xs text-gray-500 mt-1">
                            Booking URL: <a href={`https://cal.kaufmann.health/${calUsername}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">cal.kaufmann.health/{calUsername}</a>
                          </p>
                        )}
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-green-600"
                          checked={calEnabled}
                          onChange={(e) => setCalEnabled(e.target.checked)}
                        />
                        <span className="text-sm">Cal.com Booking aktiviert</span>
                      </label>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updating}
                          onClick={saveCalSettings}
                        >
                          Cal.com Einstellungen speichern
                        </Button>
                        {detail.cal_user_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updating}
                            onClick={async () => {
                              if (!detail?.id) return;
                              try {
                                setUpdating(true);
                                setMessage(null);
                                const res = await fetch(`/api/admin/therapists/${detail.id}/fix-cal-events`, {
                                  method: 'POST',
                                  credentials: 'include',
                                });
                                const json = await res.json();
                                if (!res.ok) throw new Error(json?.error || 'Fix fehlgeschlagen');
                                const fixes = json.data?.fixes || [];
                                if (json.data?.ok && fixes.length > 0) {
                                  setMessage(`✓ Repariert: ${fixes.join('; ')}`);
                                } else if (json.data?.ok) {
                                  setMessage(json.data?.message || '✓ Cal.com Setup ist korrekt');
                                } else {
                                  setMessage(json.data?.message || json.data?.error || 'Teilweise erfolgreich');
                                }
                                // Refresh Cal.com status after fix
                                await fetchCalStatus(detail.id);
                              } catch (e) {
                                const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
                                setMessage(msg);
                              } finally {
                                setUpdating(false);
                              }
                            }}
                            className="text-green-700 border-green-300 hover:bg-green-50"
                          >
                            🔧 Cal.com reparieren
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Rejection History */}
                  {detail.rejection_history && detail.rejection_history.length > 0 && (
                    <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                      <h4 className="font-semibold text-base mb-3 text-amber-800">
                        📋 Bisherige Rückfragen ({detail.rejection_history.length})
                      </h4>
                      <div className="space-y-3">
                        {detail.rejection_history.map((item, idx) => (
                          <div key={idx} className="bg-white rounded border border-amber-100 p-3 text-sm">
                            <div className="text-xs text-gray-500 mb-2">
                              {new Date(item.sent_at).toLocaleString('de-DE', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </div>
                            {item.admin_notes && (
                              <div className="text-gray-700 mb-2">
                                <span className="font-medium">Nachricht:</span> {item.admin_notes}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 text-xs">
                              {item.missing_documents && (
                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">Dokumente fehlen</span>
                              )}
                              {item.photo_issue && (
                                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Foto-Problem</span>
                              )}
                              {item.approach_issue && (
                                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Text fehlt</span>
                              )}
                              {!item.admin_notes && !item.missing_documents && !item.photo_issue && !item.approach_issue && (
                                <span className="text-gray-400 italic">Keine Details verfügbar</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes / Reason field */}
                  <div className="bg-white rounded-lg border p-4">
                    <h4 className="font-semibold text-base mb-2 flex items-center gap-2">
                      📝 Nachricht an Therapeut
                      {detail.status === 'pending_verification' && (
                        <span className="text-xs font-normal text-gray-500">(erforderlich bei Rückfrage/Ablehnung)</span>
                      )}
                    </h4>
                    <textarea
                      id="notes"
                      rows={3}
                      className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      placeholder="Bitte lade noch dein NARM-Zertifikat hoch..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Nur den Inhalt eingeben – Anrede und Signatur werden automatisch hinzugefügt.
                    </p>
                  </div>
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
                {/* Photo is now approved automatically with verification - simplified flow */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="text-xs text-gray-500">
                    <kbd className="px-2 py-1 bg-gray-100 border rounded text-xs">Esc</kbd> zum Schließen
                  </div>
                  <div className="flex gap-2 justify-end flex-wrap">
                    <Button size="sm" variant="outline" disabled={updating} onClick={sendReminder}>
                      📧 Erinnerung
                    </Button>
                    {detail?.status !== 'verified' && detail?.status !== 'declined' && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-red-400 text-red-700 hover:bg-red-50"
                          disabled={updating} 
                          onClick={() => {
                            const ok = window.confirm(
                              '⚠️ ENDGÜLTIGE ABLEHNUNG\n\n' +
                              'Dies ist eine finale Entscheidung. Der Therapeut wird informiert, dass er nicht ins Netzwerk aufgenommen wird.\n\n' +
                              'Für Rückfragen (z.B. fehlende Dokumente) nutze stattdessen "Rückfrage".\n\n' +
                              'Fortfahren?'
                            );
                            if (!ok) return;
                            void updateStatus('declined');
                          }}
                          title="Endgültige Ablehnung - Therapeut wird nicht ins Netzwerk aufgenommen"
                        >
                          ✗ Ablehnen
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="border-amber-400 text-amber-700 hover:bg-amber-50"
                          disabled={updating} 
                          onClick={() => {
                            const ok = window.confirm('Rückfrage senden? Der Therapeut erhält eine E-Mail mit deinen Anmerkungen und kann sein Profil ergänzen.');
                            if (!ok) return;
                            void updateStatus('rejected');
                          }}
                          title="Profil unvollständig - Therapeut kann nachbessern"
                        >
                          ↩ Rückfrage
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={updating} 
                          onClick={() => updateStatus('verified')}
                        >
                          ✓ Freigeben {detail?.profile.photo_pending_url ? '(inkl. Foto)' : ''}
                        </Button>
                      </>
                    )}
                    {detail?.status === 'declined' && (
                      <span className="text-sm text-gray-500 italic">Dieser Therapeut wurde bereits abgelehnt.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {showCropper && cropperImageSrc && detail && (
        <ImageCropper
          imageSrc={cropperImageSrc}
          onCropComplete={async (croppedBlob) => {
            // Auto-save immediately - no separate "Speichern" step
            const croppedFile = new File([croppedBlob], 'profile-photo.jpg', { type: 'image/jpeg' });
            
            if (cropperImageSrc) URL.revokeObjectURL(cropperImageSrc);
            setCropperImageSrc(null);
            setShowCropper(false);
            if (photoInputRef.current) photoInputRef.current.value = '';
            
            // Upload immediately
            try {
              setUpdating(true);
              setMessage(null);
              const fd = new FormData();
              fd.append('profile_photo', croppedFile);
              const endpoint = detail.status === 'pending_verification'
                ? `/api/public/therapists/${detail.id}/documents`
                : `/api/admin/therapists/${detail.id}/photo`;
              const res = await fetch(endpoint, { 
                method: 'POST', 
                body: fd,
                ...(detail.status !== 'pending_verification' && { credentials: 'include' })
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json?.error || 'Upload fehlgeschlagen');
              setMessage('✓ Foto gespeichert');
              await openDetail(detail.id);
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
              setMessage(`Fehler: ${msg}`);
            } finally {
              setUpdating(false);
            }
          }}
          onCancel={() => {
            if (cropperImageSrc) URL.revokeObjectURL(cropperImageSrc);
            setCropperImageSrc(null);
            setShowCropper(false);
            if (photoInputRef.current) photoInputRef.current.value = '';
          }}
          aspectRatio={1}
          cropShape="round"
        />
      )}

      {/* Profile Preview Modal */}
      {previewData && (
        <TherapistDetailModal
          therapist={previewData}
          open={previewOpen}
          onClose={closePreview}
          previewMode={true}
        />
      )}
    </main>
  );
}
