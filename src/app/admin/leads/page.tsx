"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const dynamic = 'force-dynamic';

type Person = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  type: 'patient' | 'therapist';
  status: string | null;
  metadata: any;
  created_at: string;
};

function formatDate(iso?: string) {
  try {
    return iso ? new Date(iso).toLocaleString() : '';
  } catch {
    return iso || '';
  }
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
      const meta = selectedPatient.metadata || {};
      if (meta.city) setTherCity(String(meta.city));
      if (meta.session_preference) setTherSessionPref(String(meta.session_preference));
      // If patient provided modality preferences, prefill first one.
      // NOTE: Future improvement could support multi-select matching.
      if (Array.isArray(meta.specializations) && meta.specializations.length > 0) {
        setTherSpecialization(String(meta.specializations[0]));
      }
    }
  }, [selectedPatient]);

  async function fetchLeads() {
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
    } catch (e: any) {
      setLeadError(e?.message || 'Unbekannter Fehler');
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }

  async function fetchTherapistsForPatient(p: Person) {
    try {
      setModalLoading(true);
      setModalError(null);
      const url = new URL('/admin/api/therapists', window.location.origin);
      const meta = p.metadata || {};
      if (meta.city) url.searchParams.set('city', String(meta.city));
      if (meta.session_preference) url.searchParams.set('session_preference', String(meta.session_preference));
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
    } catch (e: any) {
      setModalTherapists([]);
      setSelectedTherapistId('');
      setModalError(e?.message || 'Unbekannter Fehler');
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
    } catch (e: any) {
      setModalError(e?.message || 'Match fehlgeschlagen');
    } finally {
      setModalLoading(false);
    }
  }

  async function fetchTherapists() {
    setLoadingTherapists(true);
    setTherError(null);
    setMessage(null);
    try {
      const url = new URL('/admin/api/therapists', window.location.origin);
      const fallbackMeta = (selectedPatient?.metadata ?? {}) as any;
      const city = therCity || (fallbackMeta.city ? String(fallbackMeta.city) : '');
      const sessionPref = therSessionPref || (fallbackMeta.session_preference ? String(fallbackMeta.session_preference) : '');
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
    } catch (e: any) {
      setTherError(e?.message || 'Unbekannter Fehler');
      setTherapists([]);
    } finally {
      setLoadingTherapists(false);
    }
  }

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
    } catch (e: any) {
      setMessage(e?.message || 'Match fehlgeschlagen');
    }
  }

  // Initial fetch on mount
  useEffect(() => {
    fetchLeads().catch(() => {});
  }, []);

  const selectedCity = useMemo(() => (selectedPatient?.metadata?.city ? String(selectedPatient.metadata.city) : ''), [selectedPatient]);
  const selectedPref = useMemo(() => (selectedPatient?.metadata?.session_preference ? String(selectedPatient.metadata.session_preference) : ''), [selectedPatient]);

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

          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">E-Mail</th>
                  <th className="text-left px-3 py-2">Stadt</th>
                  <th className="text-left px-3 py-2">Thema</th>
                  <th className="text-left px-3 py-2">Sitzung</th>
                  <th className="text-left px-3 py-2">Methode</th>
                  <th className="text-left px-3 py-2">Eingang</th>
                  <th className="text-left px-3 py-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((p) => {
                  const meta = p.metadata || {};
                  const city = meta.city || '';
                  const pref = meta.session_preference === 'in_person' ? 'Vor Ort' : (meta.session_preference === 'online' ? 'Online' : '—');
                  const issue = meta.issue || '—';
                  const specs: string[] = Array.isArray(meta.specializations) ? meta.specializations : [];
                  return (
                    <tr key={p.id} className={selectedPatient?.id === p.id ? 'bg-amber-50' : ''}>
                      <td className="px-3 py-2">{p.name || '—'}</td>
                      <td className="px-3 py-2">{p.email || '—'}</td>
                      <td className="px-3 py-2">{city || '—'}</td>
                      <td className="px-3 py-2">{issue}</td>
                      <td className="px-3 py-2">{pref}</td>
                      <td className="px-3 py-2">{specs.length ? specs.join(', ') : '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(p.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant={selectedPatient?.id === p.id ? 'default' : 'secondary'} onClick={() => setSelectedPatient(p)}>
                            {selectedPatient?.id === p.id ? 'Ausgewählt' : 'Wählen'}
                          </Button>
                          <Button size="sm" onClick={() => openMatchModal(p)}>Match</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {leads.length === 0 && !loadingLeads && (
                  <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={8}>Keine Leads gefunden</td></tr>
                )}
                {loadingLeads && (
                  <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={8}>Laden…</td></tr>
                )}
              </tbody>
            </table>
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

          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Stadt</th>
                  <th className="text-left px-3 py-2">Sitzung</th>
                  <th className="text-left px-3 py-2">Spezialisierungen</th>
                  <th className="text-left px-3 py-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {therapists.map((t) => {
                  const meta = t.metadata || {};
                  const city = meta.city || '';
                  const pref = meta.session_preference === 'in_person' ? 'Vor Ort' : (meta.session_preference === 'online' ? 'Online' : '—');
                  const specs: string[] = Array.isArray(meta.specializations) ? meta.specializations : [];
                  return (
                    <tr key={t.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{t.name || '—'}</div>
                        <div className="text-gray-500 text-xs">{t.email}</div>
                      </td>
                      <td className="px-3 py-2">{city || '—'}</td>
                      <td className="px-3 py-2">{pref}</td>
                      <td className="px-3 py-2">{specs.length ? specs.join(', ') : '—'}</td>
                      <td className="px-3 py-2">
                        <Button size="sm" disabled={!selectedPatient} onClick={() => createMatch(t.id)}>
                          Match mit {selectedPatient ? (selectedPatient.name || selectedPatient.email || 'Lead') : 'Lead'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {therapists.length === 0 && !loadingTherapists && (
                  <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={5}>Keine Therapeuten gefunden</td></tr>
                )}
                {loadingTherapists && (
                  <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={5}>Laden…</td></tr>
                )}
              </tbody>
            </table>
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
                <div className="text-xs text-gray-500">{selectedPatient?.metadata?.city || '—'} · {selectedPatient?.metadata?.session_preference || '—'}</div>
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
