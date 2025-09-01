"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

type PersonMeta = {
  city?: string;
  session_preference?: 'online' | 'in_person';
  session_preferences?: ('online' | 'in_person')[];
  issue?: string;
  specializations?: string[];
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

  const [selectedPatient, setSelectedPatient] = useState<Person | null>(null);

  const [therCity, setTherCity] = useState('');
  const [therSessionPref, setTherSessionPref] = useState<string>('');
  const [therSpecialization, setTherSpecialization] = useState<string>('');
  const [loadingTherapists, setLoadingTherapists] = useState(false);
  const [therapists, setTherapists] = useState<Person[]>([]);
  const [therError, setTherError] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);

  // Patients with an active/ongoing match should be visually de-prioritized and sorted to bottom
  const [deprioritizedPatients, setDeprioritizedPatients] = useState<Set<string>>(new Set());

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
      // Do not prefill a single specialization; allow ANY of patient's specializations by default
      // Also clear any previously selected specialization override
      setTherSpecialization('');
    }
  }, [selectedPatient]);

  const loadPatientMatchFlags = useCallback(async (leadList: Person[]) => {
    try {
      const res = await fetch('/admin/api/matches', { credentials: 'include', cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Fehler beim Laden der Matches');
      const active = new Set(['accepted', 'therapist_contacted', 'therapist_responded', 'session_booked', 'completed']);
      const leadIds = new Set(leadList.map((p) => p.id));
      const s = new Set<string>();
      const arr = Array.isArray(json?.data) ? json.data : [];
      for (const m of arr) {
        const pid = (m?.patient?.id ?? '') as string;
        const st = (m?.status ?? '') as string;
        if (pid && leadIds.has(pid) && active.has(st)) {
          s.add(pid);
        }
      }
      setDeprioritizedPatients(s);
    } catch {
      setDeprioritizedPatients(new Set());
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    setLeadError(null);
    setMessage(null);
    try {
      const url = new URL('/admin/api/leads', window.location.origin);
      if (leadCity) url.searchParams.set('city', leadCity);
      if (leadSessionPref) url.searchParams.set('session_preference', leadSessionPref);
      url.searchParams.set('status', 'new');
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
  }, [leadCity, leadSessionPref, loadPatientMatchFlags]);

  async function fetchTherapistsForPatient(p: Person) {
    try {
      setModalLoading(true);
      setModalError(null);
      const url = new URL('/admin/api/therapists', window.location.origin);
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
      const specs: string[] = Array.isArray(meta.specializations) ? meta.specializations : [];
      if (specs.length > 0) {
        // Send all specializations as repeated params to match ANY in API
        for (const s of specs) url.searchParams.append('specialization', String(s));
      }
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
      const res = await fetch('/admin/api/matches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patient_id: selectedPatient.id, therapist_id: selectedTherapistId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Match fehlgeschlagen');
      setMessage('Match erstellt');
      closeMatchModal();
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
      const url = new URL('/admin/api/therapists', window.location.origin);
      const fallbackMeta: PersonMeta = (selectedPatient?.metadata ?? {}) as PersonMeta;
      const city = therCity || (fallbackMeta.city ? String(fallbackMeta.city) : '');
      const sessionPref = therSessionPref || (
        (Array.isArray(fallbackMeta.session_preferences) && fallbackMeta.session_preferences.length > 0)
          ? String(fallbackMeta.session_preferences[0])
          : (fallbackMeta.session_preference ? String(fallbackMeta.session_preference) : '')
      );
      const specs: string[] = Array.isArray(fallbackMeta.specializations) ? fallbackMeta.specializations : [];
      const specialization = therSpecialization || '';

      if (sessionPref) url.searchParams.set('session_preference', sessionPref);
      // If admin did not override city and patient's preference is online, omit city filter
      if (city && !(sessionPref === 'online' && !therCity)) {
        url.searchParams.set('city', city);
      }
      if (specialization) {
        url.searchParams.set('specialization', specialization);
      } else if (specs.length > 0) {
        for (const s of specs) url.searchParams.append('specialization', String(s));
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
  }, [therCity, therSessionPref, therSpecialization, selectedPatient]);

  async function createMatch(therapistId: string) {
    if (!selectedPatient) return;
    setMessage(null);
    try {
      const res = await fetch('/admin/api/matches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patient_id: selectedPatient.id, therapist_id: therapistId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Match fehlgeschlagen');
      setMessage('Match erstellt');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Match fehlgeschlagen';
      setMessage(message);
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

  // Sort: leads needing action first, those with active matches to the bottom
  const leadsSorted = useMemo(() => {
    if (!deprioritizedPatients || deprioritizedPatients.size === 0) return leads;
    const needs: Person[] = [];
    const noAction: Person[] = [];
    for (const p of leads) {
      (deprioritizedPatients.has(p.id) ? noAction : needs).push(p);
    }
    return [...needs, ...noAction];
  }, [leads, deprioritizedPatients]);

  return (
    <main className="min-h-screen p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Leads & Matching</h1>

      {message && <p className="text-sm text-emerald-700" role="status">{message}</p>}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads */}
        <div className="border rounded-md p-4">
          <h2 className="text-lg font-semibold mb-3">Patienten-Leads</h2>
          <div className="flex flex-wrap gap-3 mb-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="lead-city">Stadt</Label>
              <Input id="lead-city" value={leadCity} onChange={(e) => setLeadCity(e.target.value)} placeholder="z.B. Berlin" />
            </div>
            <div className="space-y-1">
              <Label>Sitzungsart</Label>
              <Select value={leadSessionPref || 'any'} onValueChange={(v) => setLeadSessionPref(v === 'any' ? '' : v)}>
                <SelectTrigger className="min-w-40">
                  <SelectValue placeholder="Beliebig" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Beliebig</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="in_person">Vor Ort</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchLeads} disabled={loadingLeads}>{loadingLeads ? 'Lädt…' : 'Filtern'}</Button>
          </div>
          {leadError && <p className="text-sm text-red-600 mb-2">{leadError}</p>}

          <div className="space-y-3">
            {leadsSorted.map((p) => {
              const meta: PersonMeta = p.metadata || {};
              const city = meta.city || '';
              const pref = formatSession(meta);
              const issue = meta.issue || '—';
              const specs: string[] = Array.isArray(meta.specializations) ? meta.specializations : [];
              const isSelected = selectedPatient?.id === p.id;
              const isDeprioritized = deprioritizedPatients.has(p.id);
              return (
                <Card key={p.id} className={`${isSelected ? 'border-amber-400 bg-amber-50' : ''} ${isDeprioritized ? 'opacity-70' : ''}`} aria-selected={isSelected}>
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
                    </div>
                    <CardAction className="flex gap-2">
                      <Button size="sm" variant={isSelected ? 'default' : 'secondary'} onClick={() => setSelectedPatient(p)}>
                        {isSelected ? 'Ausgewählt' : 'Wählen'}
                      </Button>
                      <Button size="sm" onClick={() => openMatchModal(p)}>Match</Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Stadt:</span> {city || '—'}</div>
                      <div><span className="text-gray-500">Thema:</span> {issue}</div>
                      <div><span className="text-gray-500">Sitzung:</span> {pref}</div>
                      <div><span className="text-gray-500">Methode:</span> {specs.length ? specs.join(', ') : '—'}</div>
                      <div className="col-span-2 text-xs text-gray-500">Eingang: {formatDate(p.created_at)}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {leads.length === 0 && !loadingLeads && (
              <p className="col-span-full px-3 py-6 text-center text-gray-500">Keine Leads gefunden</p>
            )}
            {loadingLeads && (
              <p className="col-span-full px-3 py-6 text-center text-gray-500">Laden…</p>
            )}
          </div>
        </div>

        {/* Therapists */}
        <div className="border rounded-md p-4">
          <h2 className="text-lg font-semibold mb-3">Therapeuten</h2>
          <div className="flex flex-wrap gap-3 mb-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="ther-city">Stadt</Label>
              <Input id="ther-city" value={therCity} onChange={(e) => setTherCity(e.target.value)} placeholder={selectedCity || 'z.B. Berlin'} />
            </div>
            <div className="space-y-1">
              <Label>Sitzungsart</Label>
              <Select value={therSessionPref || 'any'} onValueChange={(v) => setTherSessionPref(v === 'any' ? '' : v)}>
                <SelectTrigger className="min-w-40">
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
              <Label>Spezialisierung</Label>
              <Select value={therSpecialization || 'any'} onValueChange={(v) => setTherSpecialization(v === 'any' ? '' : v)}>
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
            <Button onClick={fetchTherapists} disabled={loadingTherapists}>{loadingTherapists ? 'Lädt…' : 'Filtern'}</Button>
          </div>
          {therError && <p className="text-sm text-red-600 mb-2">{therError}</p>}

          <div className="space-y-3">
            {therapists.map((t) => {
              const meta: PersonMeta = t.metadata || {};
              const city = meta.city || '';
              const pref = formatSession(meta);
              const specs: string[] = Array.isArray(meta.specializations) ? meta.specializations : [];
              return (
                <Card key={t.id}>
                  <CardHeader>
                    <div className="min-w-0">
                      <CardTitle className="truncate">{t.name || '—'}</CardTitle>
                      <CardDescription className="truncate">{t.email || '—'}</CardDescription>
                      {t.phone && (
                        <CardDescription className="truncate">
                          <a className="underline font-mono" href={`tel:${t.phone}`}>{t.phone}</a>
                        </CardDescription>
                      )}
                    </div>
                    <CardAction>
                      <Button size="sm" disabled={!selectedPatient} onClick={() => createMatch(t.id)}>
                        Match {selectedPatient ? `mit ${selectedPatient.name || selectedPatient.email || 'Lead'}` : ''}
                      </Button>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-gray-500">Stadt:</span> {city || '—'}</div>
                      <div><span className="text-gray-500">Sitzung:</span> {pref}</div>
                      <div className="col-span-2"><span className="text-gray-500">Spezialisierungen:</span> {specs.length ? specs.join(', ') : '—'}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {therapists.length === 0 && !loadingTherapists && (
              <p className="px-3 py-6 text-center text-gray-500">Keine Therapeuten gefunden</p>
            )}
            {loadingTherapists && (
              <p className="px-3 py-6 text-center text-gray-500">Laden…</p>
            )}
          </div>
        </div>
      </section>
      {isMatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl w-full max-w-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold">Match erstellen</h3>
              <button onClick={closeMatchModal} aria-label="Schließen" className="text-gray-500 hover:text-gray-700">×</button>
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
                  <Label htmlFor="therapist-select">Therapeut</Label>
                  <select
                    id="therapist-select"
                    className="border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg/input/30 flex h-9 w-full min-w-0 rounded-md border bg-white px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
                    value={selectedTherapistId}
                    onChange={(e) => setSelectedTherapistId(e.target.value)}
                  >
                    {modalTherapists.length === 0 && <option value="">Keine Therapeuten gefunden</option>}
                    {modalTherapists.map((t) => {
                      const city = t?.metadata?.city || '—';
                      const specs: string[] = Array.isArray(t?.metadata?.specializations) ? t.metadata.specializations : [];
                      return (
                        <option key={t.id} value={t.id}>
                          {(t.name || t.email || 'Therapeut')} · {city}{specs.length ? ` · ${specs.join(', ')}` : ''}
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
