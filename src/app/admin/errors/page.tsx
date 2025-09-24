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
    <main className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Fehler-Logs</h1>
          <p className="text-muted-foreground text-sm">Überblick der letzten Fehler aus dem Ereignis-Stream.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            Neu laden
          </Button>
        </div>
      </div>

      <section className="border rounded-md p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="block text-sm">Zeitraum</label>
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
            <label className="block text-sm">Quelle (source)</label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="z.B. api.leads, email.client" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm">Typ</label>
            <Input value={etype} onChange={(e) => setEtype(e.target.value)} placeholder="z.B. error, email_send_failed" />
          </div>
          <div className="space-y-1">
            <label className="block text-sm">Level</label>
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
          <div className="space-y-1">
            <label className="block text-sm">Suche</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche in Typ, Quelle oder Nachricht" />
          </div>
          <Button onClick={() => void load()} disabled={loading}>{loading ? 'Lädt…' : 'Filtern'}</Button>
        </div>
      </section>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* Summary */}
      {filteredRows && filteredRows.length > 0 && (
        <section className="border rounded-md p-4">
          <h2 className="text-sm font-semibold mb-2">Top Fehler-Typen</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {countsByType.map(([t, c]) => (
              <span key={t} className="rounded border px-2 py-0.5 bg-accent/40">{t}: {c}</span>
            ))}
          </div>
        </section>
      )}

      {/* List */}
      <section className="border rounded-md p-4">
        {loading && !rows && <div className="text-sm text-muted-foreground">Lade Fehler…</div>}
        {filteredRows && filteredRows.length === 0 && !loading && (
          <div className="text-sm text-muted-foreground">Keine Fehler im gewählten Zeitraum.</div>
        )}
        {filteredRows && filteredRows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-accent/30">
                  <th className="text-left py-2 px-2">Zeit</th>
                  <th className="text-left py-2 px-2">Level</th>
                  <th className="text-left py-2 px-2">Typ</th>
                  <th className="text-left py-2 px-2">Quelle</th>
                  <th className="text-left py-2 px-2">Nachricht</th>
                  <th className="text-left py-2 px-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const src = (getProp(r.properties, 'source') as string) || '—';
                  const msg = (getProp(r.properties, 'error.message') as string) || (getProp(r.properties, 'message') as string) || '—';
                  const isOpen = expanded === r.id;
                  return (
                    <tr key={r.id} className="border-b align-top">
                      <td className="py-2 px-2 whitespace-nowrap">{formatDate(r.created_at)}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <span className={`rounded border px-2 py-0.5 ${levelBadgeClass(r.level)}`}>{r.level.toUpperCase()}</span>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">{r.type || 'error'}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{src}</td>
                      <td className="py-2 px-2 max-w-96 truncate" title={typeof msg === 'string' ? msg : ''}>{typeof msg === 'string' ? msg : '—'}</td>
                      <td className="py-2 px-2">
                        <Button variant="outline" size="sm" onClick={() => setExpanded(isOpen ? null : r.id)}>
                          {isOpen ? 'Weniger' : 'Mehr'}
                        </Button>
                        {isOpen && (
                          <pre className="mt-2 max-w-[80vw] overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
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
        )}
      </section>
    </main>
  );
}

