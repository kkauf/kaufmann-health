"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { track } from '@vercel/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TherapistPreview } from '@/components/TherapistPreview';
import { computeMismatches } from '@/features/leads/lib/match';

export const dynamic = 'force-dynamic';

type PersonMeta = {
  city?: string;
  session_preference?: 'online' | 'in_person';
  session_preferences?: ('online' | 'in_person')[];
  issue?: string;
  specializations?: string[];
  gender_preference?: 'male' | 'female' | 'no_preference';
  lost_reason?: string;
  lost_reason_at?: string;
  // GDPR consent (patient)
  consent_share_with_therapists?: boolean;
  consent_privacy_version?: string;
  consent_share_with_therapists_at?: string; // ISO timestamp
  // Selection email signals (patient-driven selection, Option B)
  selection_email_sent_at?: string; // ISO timestamp of last selection email sent
  selection_email_count?: number;   // optional: how many therapists were in that email
};

type Person = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  type: 'patient' | 'therapist';
  status: string | null;
  metadata: PersonMeta;
  created_at: string;
  accepting_new?: boolean;
  gender?: string | null;
  photo_url?: string | null; // public profile photo (if approved)
};

function formatDate(iso?: string) {
  try {
    return iso ? new Date(iso).toLocaleString() : '';
  } catch {
    return iso || '';
  }
}

function formatSession(meta?: PersonMeta): string {
  if (!meta) return '—';
  const arr = Array.isArray(meta.session_preferences) ? meta.session_preferences : [];
  const singles = meta.session_preference ? [meta.session_preference] : [];
  const set = new Set<"online" | "in_person">([...arr, ...singles]);
  if (set.size === 0) return '—';
  return Array.from(set)
    .map((v) => (v === 'in_person' ? 'Vor Ort' : 'Online'))
    .join('/');
}

export default function AdminLeadsPage() {
  const [leadCity, setLeadCity] = useState('');
  const [leadSessionPref, setLeadSessionPref] = useState<string>('');
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leads, setLeads] = useState<Person[]>([]);
  const [leadError, setLeadError] = useState<string | null>(null);
  // EARTH-131: filter to focus on actionable leads by default
  const [viewFilter, setViewFilter] = useState<'action' | 'all'>('action');

  const [selectedPatient, setSelectedPatient] = useState<Person | null>(null);

  const [therCity, setTherCity] = useState('');
  const [therSessionPref, setTherSessionPref] = useState<string>('');
  const [therSpecializations, setTherSpecializations] = useState<string[]>([]);
  const [loadingTherapists, setLoadingTherapists] = useState(false);
  const [therapists, setTherapists] = useState<Person[]>([]);
  const [therError, setTherError] = useState<string | null>(null);
  const [onlyPerfect, setOnlyPerfect] = useState<boolean>(false);

  // Simple flow mode to prevent triggering both flows at once
  const [flowMode, setFlowMode] = useState<'therapist' | 'patient'>('patient');

  const [message, setMessage] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [lostReasons, setLostReasons] = useState<Record<string, string>>({});
  const [hideLost, setHideLost] = useState<boolean>(true);

  // Multi-select for therapists (max 3)
  const [selectedTherapists, setSelectedTherapists] = useState<Set<string>>(new Set());
  const toggleTherapistSelection = useCallback((id: string) => {
    setSelectedTherapists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= 3) {
        // Enforce limit
        setMessage('Maximal 3 Therapeuten auswählbar');
        return next;
      }
      next.add(id);
      return next;
    });
  }, []);

  // Patients with an active/ongoing match should be visually de-prioritized and sorted to bottom
  const [deprioritizedPatients, setDeprioritizedPatients] = useState<Set<string>>(new Set());
  // Proposed match counts per patient (for selection email CTA)
  const [proposedCounts, setProposedCounts] = useState<Record<string, number>>({});

  // Match modal state
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [modalTherapists, setModalTherapists] = useState<Person[]>([]);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Prefill therapist filters when a patient is selected
  useEffect(() => {
    if (selectedPatient) {
      const meta: PersonMeta = selectedPatient.metadata || {};
      const prefFromArray = Array.isArray(meta.session_preferences) && meta.session_preferences.length > 0 ? meta.session_preferences[0] : undefined;
      const pref = prefFromArray || (meta.session_preference ? String(meta.session_preference) : undefined);
      if (pref) setTherSessionPref(pref);
      // For online preference, clear city to show all by default; otherwise prefill patient's city if present
      if (pref === 'online') setTherCity('');
      else if (meta.city) setTherCity(String(meta.city));
      setTherSpecializations([]);
    }
  }, [selectedPatient]);

  // Clear therapist selections when patient changes
  useEffect(() => {
    setSelectedTherapists(new Set());
  }, [selectedPatient]);

  // Default flow based on patient state: if proposals exist or a selection email was sent, prefer patient-selection mode
  // Note: Keep the explicit flowMode chosen by the admin. Default is 'patient'.
  // Removed auto-switching to 'therapist' to avoid unintended bulk outreach.

  const loadPatientMatchFlags = useCallback(async (leadList: Person[]) => {
    try {
      const res = await fetch('/api/admin/matches', { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Fehler beim Laden der Matches');
      const active = new Set(['accepted', 'therapist_contacted', 'therapist_responded', 'session_booked', 'completed']);
      const leadIds = new Set(leadList.map((p) => p.id));
      const s = new Set<string>();
      const counts: Record<string, number> = {};
      const arr = Array.isArray(json?.data) ? json.data : [];
      for (const m of arr) {
        const pid = (m?.patient?.id ?? '') as string;
        const st = (m?.status ?? '') as string;
        if (pid && leadIds.has(pid)) {
          if (active.has(st)) s.add(pid);
          if (st === 'proposed') counts[pid] = (counts[pid] || 0) + 1;
        }
      }
      setDeprioritizedPatients(s);
      setProposedCounts(counts);
    } catch {
      setDeprioritizedPatients(new Set());
      setProposedCounts({});
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    setLeadError(null);
    setMessage(null);
    try {
      const url = new URL('/api/admin/leads', window.location.origin);
      if (leadCity) url.searchParams.set('city', leadCity);
      if (leadSessionPref) url.searchParams.set('session_preference', leadSessionPref);
      // Default is 'new' server-side; only override to 'all' when viewing all
      if (viewFilter === 'all') url.searchParams.set('status', 'all');
      url.searchParams.set('limit', '200');
      const res = await fetch(url.toString(), { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Fehler beim Laden der Leads');
      const list: Person[] = json.data || [];
      setLeads(list);
      // Load match flags to de-prioritize leads with active matches
      void loadPatientMatchFlags(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setLeadError(msg);
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }, [leadCity, leadSessionPref, viewFilter, loadPatientMatchFlags]);

  async function fetchTherapistsForPatient(p: Person) {
    try {
      setModalLoading(true);
      setModalError(null);
      const url = new URL('/api/admin/therapists', window.location.origin);
      const meta: PersonMeta = p.metadata || {};
      // Determine session preference first to decide city filter
      const pref = (Array.isArray(meta.session_preferences) && meta.session_preferences.length > 0)
        ? meta.session_preferences[0]
        : (meta.session_preference || '');
      if (pref) url.searchParams.set('session_preference', String(pref));
      // For online preference, do not restrict by city
      if (pref !== 'online' && meta.city) {
        url.searchParams.set('city', String(meta.city));
      }
      // Do not filter by specialization automatically; mismatches will be shown as badges.
      url.searchParams.set('limit', '200');
      const res = await fetch(url.toString(), { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Fehler beim Laden der Therapeuten');
      const list: Person[] = json.data || [];
      setModalTherapists(list);
      setSelectedTherapistId(list[0]?.id || '');
    } catch (e) {
      setModalTherapists([]);
      setSelectedTherapistId('');
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  }

  async function updateLeadStatus(id: string, status: 'new' | 'rejected', lostReason?: string) {
    try {
      setUpdatingLeadId(id);
      setMessage(null);
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          status === 'rejected' && typeof lostReason === 'string' && lostReason.trim()
            ? { status, lost_reason: lostReason.trim() }
            : { status }
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Status-Update fehlgeschlagen');
      setLeads((prev: Person[]) => prev.map((p: Person) => {
        if (p.id !== id) return p;
        const next: Person = { ...p, status };
        if (status === 'rejected' && typeof lostReason === 'string' && lostReason.trim()) {
          next.metadata = { ...(p.metadata || {}), lost_reason: lostReason.trim(), lost_reason_at: new Date().toISOString() } as PersonMeta;
        } else if (status === 'new') {
          const meta = (p.metadata || {}) as PersonMeta;
          const rest: PersonMeta = { ...meta };
          delete (rest as Record<string, unknown>).lost_reason;
          delete (rest as Record<string, unknown>).lost_reason_at;
          next.metadata = rest;
        }
        return next;
      }));
      setMessage('Status aktualisiert');
      if (status === 'new') {
        setLostReasons((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Status-Update fehlgeschlagen';
      setMessage(msg);
    } finally {
      setUpdatingLeadId(null);
    }
  }

  function openMatchModal(p: Person) {
    setSelectedPatient(p);
    setIsMatchModalOpen(true);
    void fetchTherapistsForPatient(p);
  }

  function closeMatchModal() {
    setIsMatchModalOpen(false);
    setModalTherapists([]);
    setSelectedTherapistId('');
    setModalError(null);
  }

  async function createMatchFromModal() {
    if (!selectedPatient || !selectedTherapistId) return;
    try {
      setModalLoading(true);
      if (flowMode === 'patient') {
        const res = await fetch('/api/admin/matches', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ patient_id: selectedPatient.id, therapist_id: selectedTherapistId, suppress_outreach: true }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Vorschlag fehlgeschlagen');
        setMessage('Vorschlag erstellt (ohne E-Mail)');
        try { track('Match Proposed'); } catch {}
        closeMatchModal();
        // Refresh proposed counts so Selection CTA appears without manual reload
        void loadPatientMatchFlags(leads);
      } else {
        // therapist-driven: confirm before emailing
        if (!confirm('Diesen Therapeuten jetzt kontaktieren?')) { setModalLoading(false); return; }
        const res = await fetch('/api/admin/matches', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ patient_id: selectedPatient.id, therapist_id: selectedTherapistId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Match fehlgeschlagen');
        setMessage('Match erstellt');
        try { track('Match Created'); } catch {}
        closeMatchModal();
        // Refresh proposed counts so Selection CTA appears without manual reload
        void loadPatientMatchFlags(leads);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Match fehlgeschlagen';
      setModalError(msg);
    } finally {
      setModalLoading(false);
    }
  }

  const fetchTherapists = useCallback(async () => {
    setLoadingTherapists(true);
    setTherError(null);
    setMessage(null);
    try {
      const url = new URL('/api/admin/therapists', window.location.origin);
      const fallbackMeta: PersonMeta = (selectedPatient?.metadata ?? {}) as PersonMeta;
      const city = therCity || (fallbackMeta.city ? String(fallbackMeta.city) : '');
      const sessionPref = therSessionPref || (
        (Array.isArray(fallbackMeta.session_preferences) && fallbackMeta.session_preferences.length > 0)
          ? String(fallbackMeta.session_preferences[0])
          : (fallbackMeta.session_preference ? String(fallbackMeta.session_preference) : '')
      );
      const specs = Array.isArray(therSpecializations) ? therSpecializations : [];

      if (sessionPref) url.searchParams.set('session_preference', sessionPref);
      // If admin did not override city and patient's preference is online, omit city filter
      if (city && !(sessionPref === 'online' && !therCity)) {
        url.searchParams.set('city', city);
      }
      if (specs.length > 0) {
        for (const s of specs) url.searchParams.append('specialization', s);
      }
      url.searchParams.set('limit', '200');
      const res = await fetch(url.toString(), { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Fehler beim Laden der Therapeuten');
      setTherapists(json.data || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setTherError(msg);
      setTherapists([]);
    } finally {
      setLoadingTherapists(false);
    }
  }, [therCity, therSessionPref, therSpecializations, selectedPatient]);

  async function createMatch(therapistId: string) {
    if (!selectedPatient) return;
    setMessage(null);
    try {
      if (!confirm('Diese:n Therapeut:in jetzt kontaktieren?')) return;
      const res = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patient_id: selectedPatient.id, therapist_id: therapistId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Match fehlgeschlagen');
      setMessage('Match erstellt');
      try { track('Match Created'); } catch {}
      // Refresh proposed counts so Selection CTA appears without manual reload
      void loadPatientMatchFlags(leads);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Match fehlgeschlagen';
      setMessage(message);
    }
  }

  async function proposeTherapist(therapistId: string) {
    if (!selectedPatient) return;
    setMessage(null);
    try {
      const res = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patient_id: selectedPatient.id, therapist_id: therapistId, suppress_outreach: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Vorschlag fehlgeschlagen');
      setMessage('Vorschlag erstellt (ohne E-Mail)');
      try { track('Match Proposed'); } catch {}
      // Refresh proposed counts
      void loadPatientMatchFlags(leads);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Vorschlag fehlgeschlagen';
      setMessage(message);
    }
  }

  // Removed bulk therapist contacting to avoid multi-outreach mistakes.

  async function sendSelectionEmail() {
    if (!selectedPatient) return;
    try {
      setMessage(null);
      const patientId = selectedPatient.id;
      // Confirm to avoid accidental triggering
      if (!confirm('Auswahl-E-Mail an Klient/in senden? Therapeuten werden NICHT kontaktiert.')) {
        return;
      }
      const alreadyProposed = proposedCounts[patientId] || 0;
      const selectedIds = Array.from(selectedTherapists);
      const totalCandidates = alreadyProposed + selectedIds.length;

      // Require at least two options for a meaningful selection
      if (totalCandidates < 2) {
        setMessage('Mindestens 2 Therapeuten benötigt, um eine Auswahl zu senden.');
        return;
      }

      // If admin currently selected 2–3 therapists, ensure proposals exist for them first
      if (selectedIds.length >= 2) {
        const resCreate = await fetch('/api/admin/matches', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ patient_id: patientId, therapist_ids: selectedIds, suppress_outreach: true }),
        });
        const jCreate = await resCreate.json();
        if (!resCreate.ok) {
          throw new Error(jCreate?.error || 'Konnte Vorschläge nicht anlegen');
        }
      }

      // Send selection email; pass therapist_ids when we have a current selection to control the list
      const payload: Record<string, unknown> = { template: 'selection', patient_id: patientId };
      if (selectedIds.length >= 2) payload['therapist_ids'] = selectedIds;
      const res = await fetch('/api/admin/matches/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'E-Mail-Versand fehlgeschlagen');
      setMessage('Auswahl-E-Mail gesendet');
      setSelectedTherapists(new Set());
      try { track('Selection Email Sent'); } catch {}
      // Refresh counts after sending
      void loadPatientMatchFlags(leads);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'E-Mail-Versand fehlgeschlagen';
      setMessage(msg);
    }
  }

  // Initial fetch on mount
  useEffect(() => {
    fetchLeads().catch(() => {});
  }, [fetchLeads]);

  // Initial therapists fetch on mount and when relevant filters change (consistent with leads)
  useEffect(() => {
    fetchTherapists().catch(() => {});
  }, [fetchTherapists]);

  const selectedCity = useMemo(() => (selectedPatient?.metadata?.city ? String(selectedPatient.metadata.city) : ''), [selectedPatient]);
  const selectedPref = useMemo(() => {
    const meta: PersonMeta | undefined = selectedPatient?.metadata || undefined;
    if (!meta) return '';
    const arr = Array.isArray(meta.session_preferences) ? meta.session_preferences : [];
    const singles = meta.session_preference ? [meta.session_preference] : [];
    const set = new Set<"online" | "in_person">([...arr, ...singles]);
    if (set.size === 0) return '';
    return Array.from(set)
      .map((v) => (v === 'in_person' ? 'Vor Ort' : 'Online'))
      .join('/');
  }, [selectedPatient]);

  const cityOmittedForOnline = useMemo(() => {
    const fallbackMeta: PersonMeta = (selectedPatient?.metadata ?? {}) as PersonMeta;
    const sessionPref = therSessionPref || (
      (Array.isArray(fallbackMeta.session_preferences) && fallbackMeta.session_preferences.length > 0)
        ? String(fallbackMeta.session_preferences[0])
        : (fallbackMeta.session_preference ? String(fallbackMeta.session_preference) : '')
    );
    return sessionPref === 'online' && !therCity;
  }, [therCity, therSessionPref, selectedPatient]);

  // Prepare therapist items with mismatch computation and sorting for better usability
  const therapistItems = useMemo(() => {
    const items = therapists.map((t) => {
      const meta: PersonMeta = t.metadata || {};
      const city = String(meta.city || '');
      const specs: string[] = Array.isArray(meta.specializations) ? meta.specializations : [];
      const mm = computeMismatches(selectedPatient?.metadata || {}, {
        id: t.id,
        gender: t.gender || null,
        city: city || null,
        session_preferences: Array.isArray(meta.session_preferences) ? meta.session_preferences : [],
        modalities: specs,
      });
      return { t, city, specs, mm } as const;
    });
    // Sort: perfect first, then by fewer reasons, then accepting_new true first, then newest first
    items.sort((a, b) => {
      if (a.mm.isPerfect !== b.mm.isPerfect) return a.mm.isPerfect ? -1 : 1;
      if (a.mm.reasons.length !== b.mm.reasons.length) return a.mm.reasons.length - b.mm.reasons.length;
      const aAvail = Boolean(a.t.accepting_new);
      const bAvail = Boolean(b.t.accepting_new);
      if (aAvail !== bAvail) return aAvail ? -1 : 1;
      return (new Date(b.t.created_at).getTime()) - (new Date(a.t.created_at).getTime());
    });
    return items;
  }, [therapists, selectedPatient]);

  // Sort: leads needing action first, those with active matches to the bottom
  const leadsSorted = useMemo(() => {
    const base = hideLost ? leads.filter((p) => p.status !== 'rejected') : leads;
    if (!deprioritizedPatients || deprioritizedPatients.size === 0) return base;
    const needs: Person[] = [];
    const noAction: Person[] = [];
    for (const p of base) {
      (deprioritizedPatients.has(p.id) ? noAction : needs).push(p);
    }
    if (viewFilter === 'action') return needs;
    return [...needs, ...noAction];
  }, [leads, deprioritizedPatients, hideLost, viewFilter]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <header>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Leads & Matching</h1>
          <p className="mt-1 text-base text-gray-600">Verwalte Klienten-Leads und finde passende Therapeut:innen</p>
        </header>

        {message && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
            <p className="text-sm text-emerald-700" role="status">{message}</p>
          </div>
        )}

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Leads */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-4">Klienten-Leads</h2>
            <div className="mb-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="lead-city">Stadt</Label>
                  <Input id="lead-city" value={leadCity} onChange={(e) => setLeadCity(e.target.value)} placeholder="z.B. Berlin" />
                </div>
                <div className="space-y-1">
                  <Label>Sitzungsart</Label>
                  <Select value={leadSessionPref || 'any'} onValueChange={(v) => setLeadSessionPref(v === 'any' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Beliebig" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Beliebig</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="in_person">Vor Ort</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    id="only-action"
                    type="checkbox"
                    className="h-4 w-4 accent-black"
                    checked={viewFilter === 'action'}
                    onChange={(e) => setViewFilter(e.target.checked ? 'action' : 'all')}
                  />
                  <span>Nur Handlungsbedarf</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input id="hide-lost" type="checkbox" className="h-4 w-4 accent-black" checked={hideLost} onChange={(e) => setHideLost(e.target.checked)} />
                  <span>Verlorene ausblenden</span>
                </label>
                <Button onClick={fetchLeads} disabled={loadingLeads} className="ml-auto">{loadingLeads ? 'Lädt…' : 'Filtern'}</Button>
              </div>
            </div>
          {leadError && <p className="text-sm text-red-600 mb-2">{leadError}</p>}

          <div className="space-y-3">
            {leadsSorted.map((p) => {
              const meta: PersonMeta = p.metadata || {};
              const city = meta.city || '';
              const pref = formatSession(meta);
              const issue = meta.issue || '—';
              const genderPref = meta.gender_preference === 'female' ? 'Weiblich' : meta.gender_preference === 'male' ? 'Männlich' : meta.gender_preference === 'no_preference' ? 'Keine Präferenz' : '—';
              const specs: string[] = Array.isArray(meta.specializations) ? meta.specializations : [];
              const isSelected = selectedPatient?.id === p.id;
              const isDeprioritized = deprioritizedPatients.has(p.id);
              return (
                <Card key={p.id} className={`transition-all ${isSelected ? 'border-amber-400 bg-amber-50/50 shadow-md' : 'hover:shadow-sm hover:border-gray-300'} ${isDeprioritized ? 'opacity-60' : ''}`} aria-selected={isSelected}>
                  <CardHeader>
                    <div className="min-w-0">
                      <CardTitle className="truncate" title={p.name || undefined}>{p.name || '—'}</CardTitle>
                      <CardDescription className="truncate" title={p.email || undefined}>{p.email || '—'}</CardDescription>
                      {p.phone && (
                        <CardDescription className="truncate" title={p.phone || undefined}>
                          <a className="underline font-mono" href={`tel:${p.phone}`}>{p.phone}</a>
                        </CardDescription>
                      )}
                      {isDeprioritized && (
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                            Kein Handlungsbedarf
                          </span>
                        </div>
                      )}
                      {meta.selection_email_sent_at && (
                        <div className="mt-1">
                          <span
                            className="inline-flex items-center rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800"
                            title={`Auswahl gesendet: ${formatDate(meta.selection_email_sent_at)}`}
                          >
                            Auswahl gesendet{typeof meta.selection_email_count === 'number' ? ` · ${meta.selection_email_count}` : ''}
                          </span>
                        </div>
                      )}
                      {(proposedCounts[p.id] || 0) > 0 && (
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            Vorgeschlagen: {proposedCounts[p.id]} / 3
                          </span>
                        </div>
                      )}
                      {/* EARTH-131: Matched status badge */}
                      {p.status === 'matched' && (
                        <div className="mt-1">
                          <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 text-blue-700"
                            title="Lead vermittelt"
                          >
                            Vermittelt
                          </Badge>
                        </div>
                      )}
                      {p.status === 'rejected' && (
                        <div className="mt-1">
                          <Badge
                            variant="outline"
                            className="border-red-200 bg-red-50 text-red-700"
                            title={meta.lost_reason_at ? `Verloren seit: ${formatDate(meta.lost_reason_at)}` : 'Verloren'}
                          >
                            Verloren
                          </Badge>
                        </div>
                      )}
                    </div>
                    <CardAction className="flex gap-2 items-center">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-gray-600">Status</Label>
                        <Select
                          value={p.status === 'rejected' ? 'rejected' : (p.status === 'matched' ? 'matched' : 'new')}
                          onValueChange={(v) => updateLeadStatus(p.id, v as 'new' | 'rejected')}
                          disabled={updatingLeadId === p.id}
                        >
                          <SelectTrigger className="h-8 min-w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Display-only option for matched */}
                            {p.status === 'matched' && (
                              <SelectItem value="matched" disabled>
                                Vermittelt
                              </SelectItem>
                            )}
                            <SelectItem value="new" disabled={p.status === 'matched'}>Neu</SelectItem>
                            <SelectItem value="rejected">Verloren</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" variant={isSelected ? 'default' : 'secondary'} onClick={() => setSelectedPatient(p)}>
                        {isSelected ? 'Ausgewählt' : 'Wählen'}
                      </Button>
                      <Button size="sm" onClick={() => openMatchModal(p)}>Match</Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Stadt:</span> {city || '—'}</div>
                      <div><span className="text-gray-500">Geschlecht:</span> {genderPref}</div>
                      <div><span className="text-gray-500">Thema:</span> {issue}</div>
                      <div><span className="text-gray-500">Sitzung:</span> {pref}</div>
                      <div><span className="text-gray-500">Methode:</span> {specs.length ? specs.join(', ') : '—'}</div>
                      {p.type === 'patient' && (
                        <>
                          <div><span className="text-gray-500">Einwilligung:</span> {meta.consent_share_with_therapists ? 'Ja' : 'Nein'}</div>
                          <div><span className="text-gray-500">Version:</span> {meta.consent_privacy_version || '—'}</div>
                          <div className="col-span-2 text-xs text-gray-500">Einw.-Zeitpunkt: {formatDate(meta.consent_share_with_therapists_at)}</div>
                        </>
                      )}
                      <div className="col-span-2 text-xs text-gray-500">Eingang: {formatDate(p.created_at)}</div>
                    </div>

                    {p.status === 'rejected' && (
                      <div className="mt-3 space-y-2">
                        <Label htmlFor={`lost-${p.id}`}>Verloren-Grund (optional)</Label>
                        {(() => {
                          const currentReason: string = lostReasons[p.id] ?? (typeof meta.lost_reason === 'string' ? meta.lost_reason : '');
                          return (
                            <>
                              <textarea
                                id={`lost-${p.id}`}
                                rows={2}
                                className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                                placeholder="z.B. Nicht erreichbar, gesetzliche Kasse, kein Interesse, bereits versorgt"
                                value={currentReason}
                                onChange={(e) => setLostReasons((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              />
                              <div className="flex items-center justify-between">
                                <small className="text-xs text-gray-500">{meta.lost_reason_at ? `Letzte Aktualisierung: ${formatDate(meta.lost_reason_at)}` : ''}</small>
                                <Button size="sm" variant="secondary" onClick={() => updateLeadStatus(p.id, 'rejected', currentReason)} disabled={updatingLeadId === p.id}>
                                  Grund speichern
                                </Button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {leads.length === 0 && !loadingLeads && (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                <p className="text-gray-500">Keine Leads gefunden</p>
                <p className="text-sm text-gray-400 mt-1">Versuche die Filter anzupassen</p>
              </div>
            )}
            {loadingLeads && (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                  <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Laden...</span>
                </div>
                <p className="text-gray-500 mt-3">Lade Leads...</p>
              </div>
            )}
          </div>
        </div>

          {/* Therapists */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-bold mb-4">Therapeut:innen</h2>
            {selectedPatient && (
              <div className="mb-3 text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-gray-700">
                Bis zu 3 Therapeut:innen auswählen, um eine Klienten-Auswahl zu erstellen.
              </div>
            )}
            <div className="mb-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ther-city">Stadt</Label>
                  <Input id="ther-city" value={therCity} onChange={(e) => setTherCity(e.target.value)} placeholder={selectedCity || 'z.B. Berlin'} />
                </div>
                <div className="space-y-1">
                  <Label>Sitzungsart</Label>
                  <Select value={therSessionPref || 'any'} onValueChange={(v) => setTherSessionPref(v === 'any' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedPref || 'Beliebig'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Beliebig</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="in_person">Vor Ort</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Spezialisierungen</Label>
                  <div className="flex flex-col gap-1.5 text-sm p-2 border rounded-md bg-white">
                    {[{v:'narm', l:'NARM'}, {v:'somatic-experiencing', l:'SE'}, {v:'hakomi', l:'Hakomi'}, {v:'core-energetics', l:'Core'}].map(({v,l}) => (
                      <label key={v} className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-black"
                          checked={therSpecializations.includes(v)}
                          onChange={(e) => {
                            setTherSpecializations((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(v); else next.delete(v);
                              return Array.from(next);
                            });
                          }}
                        />
                        <span className="text-xs">{l}</span>
                      </label>
                    ))}
                    {therSpecializations.length === 0 && (
                      <span className="text-xs text-gray-500">Beliebig</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <label className="flex items-center gap-2 text-sm">
                  <input id="only-perfect" type="checkbox" className="h-4 w-4 accent-black" checked={onlyPerfect} onChange={(e) => setOnlyPerfect(e.target.checked)} />
                  <span>Nur perfekte Matches</span>
                </label>
                <Button onClick={fetchTherapists} disabled={loadingTherapists} className="ml-auto">{loadingTherapists ? 'Lädt…' : 'Filtern'}</Button>
              </div>
            </div>
          {therError && <p className="text-sm text-red-600 mb-2">{therError}</p>}
          {cityOmittedForOnline && (
            <p className="text-xs text-gray-500 mb-2">Hinweis: Online-Präferenz – Stadtfilter derzeit deaktiviert. Zum Eingrenzen bitte eine Stadt eingeben.</p>
          )}

          {/* Selection email CTA when patient already has 2–3 proposed matches */}
          {flowMode === 'patient' && selectedPatient && (proposedCounts[selectedPatient.id] || 0) >= 2 && (proposedCounts[selectedPatient.id] || 0) <= 3 && (
            <div className="mb-2 flex items-center justify-between sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b px-2 py-1 rounded">
              <div className="text-sm text-gray-700">Bereits vorgeschlagen: {proposedCounts[selectedPatient.id]} / 3</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={sendSelectionEmail} disabled={!selectedPatient}>
                  Auswahl-E-Mail senden
                </Button>
              </div>
            </div>
          )}

          {/* Flow Mode Toggle */}
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs text-gray-600">Flow</span>
            <Button size="sm" variant={flowMode === 'patient' ? 'default' : 'outline'} onClick={() => setFlowMode('patient')}>Klienten-Auswahl</Button>
            <Button size="sm" variant={flowMode === 'therapist' ? 'default' : 'outline'} onClick={() => setFlowMode('therapist')}>Therapeut:innen kontaktieren</Button>
          </div>
          <div className="mb-2 text-xs text-gray-600">
            {flowMode === 'therapist'
              ? 'E-Mails gehen an Therapeut/innen (nur einzeln); Klient/in wird später informiert.'
              : 'E-Mail geht an Klient/in; Therapeut/innen werden erst nach Auswahl kontaktiert.'}
          </div>

          {/* Selection state banner */}
          {selectedPatient?.metadata?.selection_email_sent_at && (
            <div className="mb-2 text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded px-2 py-1">
              Auswahl-E-Mail gesendet am {formatDate(String(selectedPatient.metadata.selection_email_sent_at))} – warte auf Rückmeldung
            </div>
          )}

          {/* Batch actions (patient mode only) */}
          {flowMode === 'patient' && selectedTherapists.size > 0 && (
            <div className="mb-2 flex items-center justify-between sticky top-0 z-10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b px-2 py-1 rounded">
              <div className="text-sm text-gray-700">Ausgewählt: {selectedTherapists.size} / 3</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={sendSelectionEmail} disabled={!selectedPatient || (selectedTherapists.size < 2 && (proposedCounts[selectedPatient!.id] || 0) < 2)} title="Sendet E-Mail an Klient/in – Therapeuten werden NICHT kontaktiert">
                  Auswahl-E-Mail senden
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setSelectedTherapists(new Set())}>Auswahl leeren</Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {(therapistItems.filter((it) => (onlyPerfect ? it.mm.isPerfect : true))).map(({ t, city, specs, mm }) => {
              const checked = selectedTherapists.has(t.id);
              // Map Admin API shape to TherapistPreview props
              const [first, ...rest] = (t.name || '').trim().split(/\s+/);
              const previewTherapist = {
                id: t.id,
                first_name: first || (t.name || ''),
                last_name: rest.join(' '),
                photo_url: t.photo_url || undefined,
                modalities: specs,
                approach_text: '',
                accepting_new: Boolean(t.accepting_new),
                city,
                email: t.email || null,
                phone: t.phone || null,
                status: t.status || null,
                created_at: t.created_at || null,
              } as const;
              return (
                <div key={t.id} className="flex items-start gap-2 cursor-pointer select-none" onClick={() => toggleTherapistSelection(t.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTherapistSelection(t.id); } }}>
                  <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      onChange={() => toggleTherapistSelection(t.id)}
                      aria-label="Therapeut auswählen"
                    />
                  </div>
                  <div className="flex-1">
                    <TherapistPreview
                      therapist={previewTherapist}
                      variant="admin"
                      actionButton={(
                        <div className="flex items-center gap-2">
                          {/* Match quality badges */}
                          {mm.isPerfect ? (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 px-1.5 py-0">Perfekt</Badge>
                          ) : (
                            <>
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 px-1.5 py-0">Teilweise</Badge>
                              {mm.reasons.map((r) => {
                                const map: Record<string, string> = { gender: 'Geschlecht', location: 'Ort/Sitzung', modality: 'Methode' };
                                const label = map[r] || r;
                                return (
                                  <Badge key={r} variant="secondary" className="px-1.5 py-0 text-[10px]" title="Nicht passend zur Klientenpräferenz">{label}</Badge>
                                );
                              })}
                            </>
                          )}
                          <Button
                            size="sm"
                            disabled={!selectedPatient}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (flowMode === 'patient') void proposeTherapist(t.id); else void createMatch(t.id);
                            }}
                            title={flowMode === 'patient' ? 'Als Vorschlag vormerken (ohne E-Mail an Therapeut*in)' : 'Therapeut*in jetzt kontaktieren'}
                          >
                            {flowMode === 'patient' ? 'Als Vorschlag vormerken' : 'Therapeut*in kontaktieren'}
                          </Button>
                        </div>
                      )}
                    />
                  </div>
                </div>
              );
            })}
            {therapists.length === 0 && !loadingTherapists && (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
                <p className="text-gray-500">Keine Therapeut:innen gefunden</p>
                <p className="text-sm text-gray-400 mt-1">Versuche die Filter anzupassen</p>
              </div>
            )}
            {loadingTherapists && (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                  <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Laden...</span>
                </div>
                <p className="text-gray-500 mt-3">Lade Therapeut:innen...</p>
              </div>
            )}
          </div>
        </div>
        </section>
      </div>

      {isMatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold">Match erstellen</h3>
              <button onClick={closeMatchModal} aria-label="Schließen" className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                <div><span className="font-medium">Lead:</span> {selectedPatient?.name || selectedPatient?.email || '—'}</div>
                <div className="text-xs text-gray-500">{selectedPatient?.metadata?.city || '—'} · {formatSession(selectedPatient?.metadata)}</div>
              </div>
              {modalError && <p className="text-sm text-red-600">{modalError}</p>}
              {modalLoading ? (
                <p className="text-sm text-gray-600">Laden…</p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="therapist-select">Therapeut:in</Label>
                  <select
                    id="therapist-select"
                    className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
                    value={selectedTherapistId}
                    onChange={(e) => setSelectedTherapistId(e.target.value)}
                  >
                    {modalTherapists.length === 0 && <option value="">Keine Therapeut:innen gefunden</option>}
                    {modalTherapists.map((t) => {
                      const city = t?.metadata?.city || '—';
                      const specs: string[] = Array.isArray(t?.metadata?.specializations) ? t.metadata.specializations : [];
                      return (
                        <option key={t.id} value={t.id}>
                          {(t.name || t.email || 'Therapeut:in')} · {city}{specs.length ? ` · ${specs.join(', ')}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={closeMatchModal}>Abbrechen</Button>
                <Button onClick={createMatchFromModal} disabled={!selectedTherapistId || modalLoading}>
                  {modalLoading ? 'Erstellt…' : 'Match erstellen'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Lightweight modal overlay within this page (no external dependency)
