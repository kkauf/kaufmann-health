"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type Person = {
  id: string;
  name: string;
  email: string;
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
  { value: 'therapist_contacted', label: 'Therapeut kontaktiert' },
  { value: 'therapist_responded', label: 'Therapeut antwortete' },
  { value: 'session_booked', label: 'Sitzung gebucht' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'failed', label: 'Fehlgeschlagen' },
];

function StatusBadge({ status }: { status: string }) {
  const cls = useMemo(() => {
    switch (status) {
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/admin/api/matches', { method: 'GET', cache: 'no-store' });
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

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    try {
      const res = await fetch('/admin/api/matches', {
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
      const res = await fetch('/admin/api/matches', {
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
    <main className="min-h-screen p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Match-Status</h1>
          <p className="text-muted-foreground text-sm">Verfolgen und aktualisieren Sie den Fortschritt aller Matches.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>Neu laden</Button>
          <Link href="/admin/leads" className="underline text-sm">Zu Leads</Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600">{error}</div>
      )}

      {loading && !rows && (
        <div className="text-sm text-muted-foreground">Lade Matches…</div>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded border p-6 text-center text-sm text-muted-foreground">
          Noch keine Matches vorhanden.
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-accent/30">
                <th className="text-left py-2 px-2">Patient</th>
                <th className="text-left py-2 px-2">Kontakt</th>
                <th className="text-left py-2 px-2">Stadt</th>
                <th className="text-left py-2 px-2">Anliegen</th>
                <th className="text-left py-2 px-2">Therapeut</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">Erstellt</th>
                <th className="text-left py-2 px-2">Notizen</th>
                <th className="text-left py-2 px-2">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b hover:bg-accent/10">
                  <td className="py-2 px-2 min-w-48">{r.patient.name || '—'}</td>
                  <td className="py-2 px-2 min-w-44">
                    {r.patient.email ? (
                      <a className="underline" href={`mailto:${r.patient.email}`}>{r.patient.email}</a>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-2">{r.patient.city || '—'}</td>
                  <td className="py-2 px-2 max-w-56 truncate" title={r.patient.issue || ''}>{r.patient.issue || '—'}</td>
                  <td className="py-2 px-2 min-w-44">{r.therapist.name || '—'}</td>
                  <td className="py-2 px-2 min-w-56">
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
                  <td className="py-2 px-2 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                  <td className="py-2 px-2 min-w-64">
                    <input
                      className="w-full rounded border bg-transparent px-2 py-1"
                      defaultValue={r.notes || ''}
                      placeholder="Notizen…"
                      onBlur={(e) => void updateNotes(r.id, e.currentTarget.value)}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Button variant="outline" size="sm" disabled title="Kommt im nächsten Schritt (EARTH-44)">Patient informieren</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
