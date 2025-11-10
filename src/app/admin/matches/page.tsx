"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Person = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  issue?: string;
};

type MatchRow = {
  id: string;
  status: string;
  notes: string;
  created_at?: string | null;
  patient: Person;
  therapist: Person;
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'proposed', label: 'Vorgeschlagen' },
  { value: 'patient_selected', label: 'Klient gewählt' },
  { value: 'accepted', label: 'Akzeptiert' },
  { value: 'declined', label: 'Abgelehnt' },
  { value: 'therapist_contacted', label: 'Therapeut:in kontaktiert' },
  { value: 'therapist_responded', label: 'Therapeut:in antwortete' },
  { value: 'session_booked', label: 'Sitzung gebucht' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'failed', label: 'Fehlgeschlagen' },
];

function StatusBadge({ status }: { status: string }) {
  const cls = useMemo(() => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'patient_selected':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'therapist_contacted':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'therapist_responded':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'session_booked':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }, [status]);
  const label = STATUS_OPTIONS.find(o => o.value === status)?.label ?? 'Vorgeschlagen';
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${cls}`}>{label}</span>;
}

export default function AdminMatchesPage() {
  const [rows, setRows] = useState<MatchRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<{ id: string; patientName?: string; therapistName?: string } | null>(null);
  const [emailTemplate, setEmailTemplate] = useState<'match_found' | 'custom'>('match_found');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/matches', { method: 'GET', cache: 'no-store' });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const json = await res.json();
      setRows(json.data as MatchRow[]);
    } catch (e) {
      console.error('Load matches failed:', e);
      setError('Konnte Matches nicht laden');
    } finally {
      setLoading(false);
    }
  }, []);

  const openEmail = useCallback((r: MatchRow) => {
    setEmailTarget({ id: r.id, patientName: r.patient.name, therapistName: r.therapist.name });
    setEmailTemplate('match_found');
    setEmailMessage('');
  }, []);

  const closeEmail = useCallback(() => {
    setEmailTarget(null);
    setEmailMessage('');
    setEmailTemplate('match_found');
  }, []);

  const sendPatientEmail = useCallback(async () => {
    if (!emailTarget) return;
    setEmailSending(true);
    try {
      const res = await fetch('/api/admin/matches/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: emailTarget.id, template: emailTemplate, message: emailMessage }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Senden fehlgeschlagen (${res.status})`);
      }
      alert('E-Mail gesendet.');
      closeEmail();
    } catch (e: unknown) {
      console.error('Send email failed:', e);
      const msg = e instanceof Error ? e.message : 'E-Mail konnte nicht gesendet werden';
      alert(msg);
    } finally {
      setEmailSending(false);
    }
  }, [emailTarget, emailTemplate, emailMessage, closeEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedRows = useMemo(() => {
    let list = rows ? [...rows] : [];
    if (list.length === 0) return list;

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      list = list.filter(r =>
        r.patient.name.toLowerCase().includes(query) ||
        r.patient.email.toLowerCase().includes(query) ||
        r.therapist.name.toLowerCase().includes(query) ||
        r.therapist.email.toLowerCase().includes(query) ||
        (r.patient.city && r.patient.city.toLowerCase().includes(query))
      );
    }

    const weight: Record<string, number> = {
      proposed: 0,
      patient_selected: 1,
      declined: 1,
      failed: 1,
      accepted: 2,
      therapist_contacted: 3,
      therapist_responded: 4,
      session_booked: 5,
      completed: 6,
    };
    list.sort((a, b) => {
      const wa = weight[a.status] ?? 99;
      const wb = weight[b.status] ?? 99;
      if (wa !== wb) return wa - wb;
      // Secondary: newest first
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return tb - ta;
    });
    return list;
  }, [rows, statusFilter, searchQuery]);

  const isDeprioritized = useCallback((status: string) => {
    return (
      status === 'accepted' ||
      status === 'therapist_contacted' ||
      status === 'therapist_responded' ||
      status === 'session_booked' ||
      status === 'completed'
    );
  }, []);

  const updateStatus = useCallback(async (id: string, status: string) => {
    try {
      const res = await fetch('/api/admin/matches', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status})`);
      setRows(prev =>
        (prev || []).map(r => (r.id === id ? { ...r, status } : r))
      );
    } catch (e) {
      console.error('Status update failed:', e);
      alert('Status konnte nicht gespeichert werden');
    }
  }, []);

  const updateNotes = useCallback(async (id: string, notes: string) => {
    try {
      const res = await fetch('/api/admin/matches', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, notes }),
      });
      if (!res.ok) throw new Error(`Notes failed (${res.status})`);
      setRows(prev =>
        (prev || []).map(r => (r.id === id ? { ...r, notes } : r))
      );
    } catch (e) {
      console.error('Notes update failed:', e);
      alert('Notizen konnten nicht gespeichert werden');
    }
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Match-Status</h1>
            <p className="mt-1 text-base text-gray-600">Verfolge und aktualisiere den Fortschritt aller Matches</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>Neu laden</Button>
            <Link href="/admin/leads">
              <Button variant="outline">Zu Leads</Button>
            </Link>
          </div>
        </header>

        <section className="bg-white rounded-lg shadow-sm border p-6">
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-4">Filter & Suche</h2>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="min-w-48">
                    <SelectValue placeholder="Alle Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1 min-w-64">
                <Label>Suche</Label>
                <Input
                  placeholder="Name, E-Mail, Stadt..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          </div>

          {loading && !rows && (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Laden...</span>
              </div>
              <p className="text-gray-500 mt-3">Lade Matches...</p>
            </div>
          )}

          {rows && sortedRows.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
              <p className="text-gray-500">Keine Matches gefunden</p>
              <p className="text-sm text-gray-400 mt-1">Versuche die Filter anzupassen</p>
            </div>
          )}

          {rows && sortedRows.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-gray-600 mb-3">
                {sortedRows.length} {sortedRows.length === 1 ? 'Match' : 'Matches'} gefunden
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Klient</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Kontakt</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Stadt</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Anliegen</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Therapeut:in</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Erstellt</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Notizen</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(r => (
                <tr key={r.id} className={`border-b transition-colors hover:bg-blue-50/50 ${isDeprioritized(r.status) ? 'opacity-60' : ''}`}>
                  <td className="py-3 px-3 min-w-48 font-medium">{r.patient.name || '—'}</td>
                  <td className="py-3 px-3 min-w-44">
                    <div className="flex flex-col gap-0.5">
                      {r.patient.email ? (
                        <a className="underline" href={`mailto:${r.patient.email}`}>{r.patient.email}</a>
                      ) : <span>—</span>}
                      {r.patient.phone ? (
                        <a className="underline font-mono text-xs" href={`tel:${r.patient.phone}`}>{r.patient.phone}</a>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 px-3">{r.patient.city || '—'}</td>
                  <td className="py-3 px-3 max-w-56 truncate" title={r.patient.issue || ''}>{r.patient.issue || '—'}</td>
                  <td className="py-3 px-3 min-w-44">
                    <div className="flex flex-col gap-0.5">
                      <span>{r.therapist.name || '—'}</span>
                      {r.therapist.phone ? (
                        <a className="underline font-mono text-xs" href={`tel:${r.therapist.phone}`}>{r.therapist.phone}</a>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 px-3 min-w-56">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      <Select value={r.status} onValueChange={(v) => void updateStatus(r.id, v)}>
                        <SelectTrigger size="sm">
                          <SelectValue placeholder="Status ändern" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-gray-600 text-xs">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                  <td className="py-3 px-3 min-w-64">
                    <input
                      className="w-full rounded border bg-transparent px-2 py-1"
                      defaultValue={r.notes || ''}
                      placeholder="Notizen…"
                      onBlur={(e) => void updateNotes(r.id, e.currentTarget.value)}
                    />
                  </td>
                  <td className="py-3 px-3">
                    <Button variant="outline" size="sm" onClick={() => openEmail(r)}>Klient informieren</Button>
                  </td>
                </tr>
              ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {emailTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-md bg-white p-4 shadow-2xl">
            <div className="mb-2">
              <h2 className="text-lg font-semibold">E-Mail an Klient senden</h2>
              <p className="text-xs text-muted-foreground">
                Klient: <strong>{emailTarget.patientName || '—'}</strong>{' '}· Therapeut:in: <strong>{emailTarget.therapistName || '—'}</strong>
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Vorlage</label>
                <select
                  className="w-full rounded border bg-transparent px-2 py-1"
                  value={emailTemplate}
                  onChange={(e) => setEmailTemplate(e.currentTarget.value as 'match_found' | 'custom')}
                >
                  <option value="match_found">Match gefunden (Therapeut:in meldet sich)</option>
                  <option value="custom">Individuelles Update</option>
                </select>
              </div>
              {emailTemplate === 'custom' && (
                <div>
                  <label className="block text-sm mb-1">Nachricht (optional)</label>
                  <textarea
                    className="w-full min-h-28 rounded border bg-transparent px-2 py-1"
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.currentTarget.value)}
                    placeholder="Kurze persönliche Nachricht an den Klienten…"
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeEmail} disabled={emailSending}>Abbrechen</Button>
                <Button onClick={() => void sendPatientEmail()} disabled={emailSending}>
                  {emailSending ? 'Senden…' : 'Senden'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
