"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type EventRow = {
  id: string;
  level: 'error' | 'warn' | 'info';
  type: string;
  properties?: Record<string, unknown> | null;
  created_at?: string | null;
};

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getProp(obj: unknown, path: string): unknown {
  try {
    if (!obj || typeof obj !== 'object') return undefined;
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') {
        const rec = acc as Record<string, unknown>;
        return Object.prototype.hasOwnProperty.call(rec, key) ? rec[key] : undefined;
      }
      return undefined;
    }, obj as unknown);
  } catch {
    return undefined;
  }
}

function levelBadgeClass(level: 'error' | 'warn' | 'info') {
  switch (level) {
    case 'error':
      return 'text-red-700 border-red-200 bg-red-50';
    case 'warn':
      return 'text-amber-700 border-amber-200 bg-amber-50';
    default:
      return 'text-slate-700 border-slate-200 bg-slate-50';
  }
}

export default function AdminErrorsPage() {
  const [rows, setRows] = useState<EventRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sinceHours, setSinceHours] = useState<number>(24);
  const [source, setSource] = useState<string>('');
  const [etype, setEtype] = useState<string>('');
  const [q, setQ] = useState<string>('');
  const [levels, setLevels] = useState<Array<'error' | 'warn' | 'info'>>(['error']);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/admin/errors', window.location.origin);
      url.searchParams.set('since_hours', String(sinceHours));
      if (source) url.searchParams.set('source', source);
      if (etype) url.searchParams.set('type', etype);
      if (levels.length > 0) url.searchParams.set('levels', levels.join(','));
      url.searchParams.set('limit', '200');
      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const json = await res.json();
      setRows((json?.data || []) as EventRow[]);
    } catch (e) {
      console.error('Load errors failed:', e);
      setError('Konnte Fehler nicht laden');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [sinceHours, source, etype, levels]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const list = rows || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    const includes = (s?: string | null) => (s ? s.toLowerCase().includes(needle) : false);
    return list.filter((r) => {
      const src = (getProp(r.properties, 'source') as string) || '';
      const msg = (getProp(r.properties, 'error.message') as string) || (getProp(r.properties, 'message') as string) || '';
      return includes(r.type) || includes(src) || includes(msg);
    });
  }, [rows, q]);

  const countsByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filteredRows || []) {
      const t = r.type || 'unknown';
      map.set(t, (map.get(t) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [filteredRows]);

  const [expanded, setExpanded] = useState<string | null>(null);

  function toggleLevel(lvl: 'error' | 'warn' | 'info') {
    setLevels((prev) => {
      if (prev.includes(lvl)) {
        const next = prev.filter((l) => l !== lvl);
        // Ensure at least one selected; default back to 'error'
        return next.length > 0 ? next : ['error'];
      }
      return [...prev, lvl];
    });
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <header>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Fehler-Logs</h1>
            <p className="mt-1 text-base text-gray-600">Überblick der letzten Fehler aus dem Ereignis-Stream.</p>
          </header>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? 'Lädt…' : 'Neu laden'}
            </Button>
          </div>
        </div>

      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Filter</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Zeitraum</label>
            <Select value={String(sinceHours)} onValueChange={(v) => setSinceHours(Number.parseInt(v, 10))}>
              <SelectTrigger className="min-w-40">
                <SelectValue placeholder="Letzte 24h" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Letzte 1h</SelectItem>
                <SelectItem value="6">Letzte 6h</SelectItem>
                <SelectItem value="24">Letzte 24h</SelectItem>
                <SelectItem value="72">Letzte 72h</SelectItem>
                <SelectItem value="168">Letzte 7 Tage</SelectItem>
                <SelectItem value="720">Letzte 30 Tage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Quelle (source)</label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="z.B. api.leads, email.client" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Typ</label>
            <Input value={etype} onChange={(e) => setEtype(e.target.value)} placeholder="z.B. error, email_send_failed" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Level</label>
            <div className="flex gap-2">
              <Button size="sm" variant={levels.includes('error') ? 'default' : 'outline'} onClick={() => toggleLevel('error')}>
                Error
              </Button>
              <Button size="sm" variant={levels.includes('warn') ? 'default' : 'outline'} onClick={() => toggleLevel('warn')}>
                Warn
              </Button>
              <Button size="sm" variant={levels.includes('info') ? 'default' : 'outline'} onClick={() => toggleLevel('info')}>
                Info
              </Button>
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Suche</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche in Typ, Quelle oder Nachricht" className="w-full" />
          </div>
          <div className="flex items-end">
            <Button onClick={() => void load()} disabled={loading} className="w-full">{loading ? 'Lädt…' : 'Filtern'}</Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Summary */}
      {filteredRows && filteredRows.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Top Fehler-Typen</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {countsByType.map(([t, c]) => (
              <span key={t} className="rounded-lg border border-gray-300 px-3 py-1.5 bg-gray-50 font-medium text-gray-700">{t}: {c}</span>
            ))}
          </div>
        </section>
      )}

      {/* List */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6">
        {loading && !rows && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="text-sm text-gray-600">Lade Fehler…</p>
            </div>
          </div>
        )}
        {filteredRows && filteredRows.length === 0 && !loading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-gray-600">Keine Fehler im gewählten Zeitraum.</p>
          </div>
        )}
        {filteredRows && filteredRows.length > 0 && (
          <div className="overflow-x-auto -mx-4 sm:-mx-6">
            <div className="inline-block min-w-full align-middle px-4 sm:px-6">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Zeit</th>
                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Level</th>
                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Typ</th>
                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Quelle</th>
                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Nachricht</th>
                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Details</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRows.map((r) => {
                  const src = (getProp(r.properties, 'source') as string) || '—';
                  const msg = (getProp(r.properties, 'error.message') as string) || (getProp(r.properties, 'message') as string) || '—';
                  const isOpen = expanded === r.id;
                  return (
                    <tr key={r.id} className="align-top hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3 whitespace-nowrap text-gray-700">{formatDate(r.created_at)}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${levelBadgeClass(r.level)}`}>{r.level.toUpperCase()}</span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-gray-700">{r.type || 'error'}</td>
                      <td className="py-3 px-3 whitespace-nowrap text-gray-700">{src}</td>
                      <td className="py-3 px-3 max-w-96 truncate text-gray-700" title={typeof msg === 'string' ? msg : ''}>{typeof msg === 'string' ? msg : '—'}</td>
                      <td className="py-3 px-3">
                        <Button variant="outline" size="sm" onClick={() => setExpanded(isOpen ? null : r.id)}>
                          {isOpen ? 'Weniger' : 'Mehr'}
                        </Button>
                        {isOpen && (
                          <pre className="mt-3 max-w-[80vw] overflow-x-auto whitespace-pre-wrap rounded-lg bg-gray-100 p-3 text-xs border border-gray-200">
                            {JSON.stringify(r.properties ?? {}, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>
      </div>
    </main>
  );
}

