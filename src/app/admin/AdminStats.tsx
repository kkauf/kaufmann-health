"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type StatsData = {
  totals: {
    therapists: number;
    clients: number;
    matches: number;
  };
  matchesLastNDays: {
    days: number;
    series: Array<{ date: string; count: number }>;
  };
};

export default function AdminStats() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/admin/api/stats?days=7', { credentials: 'include' });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const json = await res.json();
      setData((json?.data || null) as StatsData | null);
    } catch (e) {
      console.error('Load stats failed:', e);
      setError('Konnte Statistik nicht laden');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const maxCount = useMemo(() => {
    return Math.max(0, ...((data?.matchesLastNDays.series || []).map((d) => d.count)));
  }, [data]);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Übersicht</h2>
          <p className="text-sm text-muted-foreground">Kernzahlen und Match-Entwicklung (7 Tage).</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? 'Lädt…' : 'Neu laden'}
        </Button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Therapeut:innen</CardTitle>
            <CardDescription>Gesamtzahl registrierter Profile</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data?.totals.therapists ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Patient:innen</CardTitle>
            <CardDescription>Gesamtzahl registrierter Personen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data?.totals.clients ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Matches</CardTitle>
            <CardDescription>Gesamtzahl aller Matches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data?.totals.matches ?? '—'}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matches letzte 7 Tage</CardTitle>
          <CardDescription>Tägliche Anzahl, UTC-basiert</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-36 grid grid-flow-col auto-cols-fr items-end gap-2 justify-items-center">
            {((data?.matchesLastNDays.series?.length || 0) === 0) ? (
              <div className="col-span-full text-sm text-muted-foreground self-center">
                Keine Daten für den Zeitraum
              </div>
            ) : (
              (data?.matchesLastNDays.series || []).map((d) => {
                const pct = maxCount > 0 ? Math.round((d.count / maxCount) * 100) : 0;
                return (
                  <div key={d.date} className="flex flex-col items-center justify-end gap-1">
                    <div
                      className="w-6 rounded bg-accent"
                      title={`${d.date}: ${d.count}`}
                      style={{ height: `${Math.max(6, pct)}%` }}
                    />
                    <div className="text-[10px] leading-none text-muted-foreground">
                      {d.date.slice(5)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
