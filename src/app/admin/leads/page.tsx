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
      if (meta.city) setTherCity(String(meta.city));
      const prefFromArray = Array.isArray(meta.session_preferences) && meta.session_preferences.length > 0 ? meta.session_preferences[0] : undefined;
      if (prefFromArray) setTherSessionPref(prefFromArray);
      else if (meta.session_preference) setTherSessionPref(String(meta.session_preference));
      // If patient provided modality preferences, prefill first one.
      // NOTE: Future improvement could support multi-select matching.
      if (Array.isArray(meta.specializations) && meta.specializations.length > 0) {
        setTherSpecialization(String(meta.specializations[0]));
      }
    }
  }, [selectedPatient]);

  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    setLeadError(null);
    setMessage(null);
    try {
      const url = new URL('/admin/api/leads', window.location.origin);
      if (leadCity) url.searchParams.set('city', leadCity);
      if (leadSessionPref) url.searchParams.set('session_preference', leadSessionPref);
      url.searchParams.set('status', 'new');
      url.searchParams.set('limit', '100');
      const res = await fetch(url.toString(), { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Fehler beim Laden der Leads');
      setLeads(json.data || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setLeadError(msg);
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }, [leadCity, leadSessionPref]);

  async function fetchTherapistsForPatient(p: Person) {
    try {
      setModalLoading(true);
      setModalError(null);
      const url = new URL('/admin/api/therapists', window.location.origin);
      const meta: PersonMeta = p.metadata || {};
      if (meta.city) url.searchParams.set('city', String(meta.city));
      {
        const pref = (Array.isArray(meta.session_preferences) && meta.session_preferences.length > 0)
          ? meta.session_preferences[0]
          : (meta.session_preference || '');
        if (pref) url.searchParams.set('session_preference', String(pref));
      }
      const specs: string[] = Array.isArray(meta.specializations) ? meta.specializations : [];
      if (specs.length > 0) {
        // Currently API supports a single specialization param. Pick the first.
        url.searchParams.set('specialization', String(specs[0]));
      }
      url.searchParams.set('limit', '100');
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
      const specialization = therSpecialization || (specs.length > 0 ? String(specs[0]) : '');

      if (city) url.searchParams.set('city', city);
      if (sessionPref) url.searchParams.set('session_preference', sessionPref);
      if (specialization) url.searchParams.set('specialization', specialization);
      url.searchParams.set('limit', '100');
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
            {leads.map((p) => {
              const meta: PersonMeta = p.metadata || {};
              const city = meta.city || '';
              const pref = formatSession(meta);
              const issue = meta.issue || '—';
              const specs: string[] = Array.isArray(meta.specializations) ? meta.specializations : [];
              const isSelected = selectedPatient?.id === p.id;
              return (
                <Card key={p.id} className={isSelected ? 'border-amber-400 bg-amber-50' : ''} aria-selected={isSelected}>
                  <CardHeader>
                    <div className="min-w-0">
                      <CardTitle className="truncate" title={p.name || undefined}>{p.name || '—'}</CardTitle>
                      <CardDescription className="truncate" title={p.email || undefined}>{p.email || '—'}</CardDescription>
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
