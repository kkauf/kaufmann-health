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
  funnelByDay?: Array<{ day: string; leads: number; viewed_profiles: number; selections: number }>;
  leadQuality?: Array<{ key: 'self_pay_confirmed' | 'self_pay_declined' | string; count: number }>;
  responseTimes?: { buckets: Array<{ bucket: string; count: number }>; avgHours: number };
  topCities?: Array<{ city: string; count: number }>;
  therapistAcceptance?: { lastNDays: { accepted: number; declined: number; rate: number } };
  blockers?: { last30Days: { total: number; breakdown: Array<{ reason: string; count: number; percentage: number }> } };
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

  // Helpers
  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
  const maxOf = (arr: number[]) => (arr.length ? Math.max(...arr) : 0);

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

      {/* Totals (keep for quick context) */}
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
            <CardTitle>Klient:innen</CardTitle>
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
                const pctH = maxCount > 0 ? Math.round((d.count / maxCount) * 100) : 0;
                return (
                  <div key={d.date} className="flex flex-col items-center justify-end gap-1">
                    <div
                      className="w-6 rounded bg-accent"
                      title={`${d.date}: ${d.count}`}
                      style={{ height: `${Math.max(6, pctH)}%` }}
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

      {/* 1) Funnel Conversion by Day */}
      <Card>
        <CardHeader>
          <CardTitle>Funnel (letzte 7 Tage)</CardTitle>
          <CardDescription>Leads → Profilansicht → Auswahl pro Tag</CardDescription>
        </CardHeader>
        <CardContent>
          {!(data?.funnelByDay && data.funnelByDay.length) ? (
            <div className="text-sm text-muted-foreground">Keine Funnel-Daten</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3">Tag</th>
                    <th className="py-1 pr-3">Leads</th>
                    <th className="py-1 pr-3">Profilansichten</th>
                    <th className="py-1 pr-3">Auswahlen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.funnelByDay.map((r) => (
                    <tr key={r.day} className="border-t">
                      <td className="py-1 pr-3 whitespace-nowrap">{r.day}</td>
                      <td className="py-1 pr-3">{r.leads}</td>
                      <td className="py-1 pr-3">{r.viewed_profiles}</td>
                      <td className="py-1 pr-3">{r.selections}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2) Lead Quality Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Lead-Qualität</CardTitle>
          <CardDescription>Selbstzahler-Bestätigung (Events der letzten 7 Tage)</CardDescription>
        </CardHeader>
        <CardContent>
          {!(data?.leadQuality && data.leadQuality.length) ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            (() => {
              const confirmed = data.leadQuality.find((x) => x.key === 'self_pay_confirmed')?.count || 0;
              const declined = data.leadQuality.find((x) => x.key === 'self_pay_declined')?.count || 0;
              const total = confirmed + declined;
              const maxVal = Math.max(confirmed, declined, 1);
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Selbstzahler bestätigt</span>
                    <span className="tabular-nums">{confirmed} ({pct(confirmed, total)}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded">
                    <div className="h-2 bg-emerald-500 rounded" style={{ width: `${(confirmed / maxVal) * 100}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Selbstzahler abgelehnt</span>
                    <span className="tabular-nums">{declined} ({pct(declined, total)}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded">
                    <div className="h-2 bg-rose-500 rounded" style={{ width: `${(declined / maxVal) * 100}%` }} />
                  </div>
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      {/* 3) Response Times */}
      <Card>
        <CardHeader>
          <CardTitle>Reaktionszeiten</CardTitle>
          <CardDescription>Vom Lead bis zum ersten Match</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.responseTimes ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm">Durchschnitt: <span className="font-medium">{data.responseTimes.avgHours} Std.</span></div>
              {(() => {
                const maxBucket = maxOf(data.responseTimes.buckets.map((b) => b.count));
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.responseTimes.buckets.map((b) => (
                      <div key={b.bucket} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{b.bucket}</span>
                          <span className="tabular-nums">{b.count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded">
                          <div className="h-2 bg-blue-500 rounded" style={{ width: `${maxBucket > 0 ? (b.count / maxBucket) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4) City / Demographic Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Städte-Muster</CardTitle>
          <CardDescription>Top 8 Städte (Klient:innen-Leads)</CardDescription>
        </CardHeader>
        <CardContent>
          {!(data?.topCities && data.topCities.length) ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(() => {
                const maxVal = maxOf(data.topCities.map((c) => c.count));
                return data.topCities.map((c) => (
                  <div key={c.city} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{c.city}</span>
                      <span className="tabular-nums">{c.count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded">
                      <div className="h-2 bg-indigo-500 rounded" style={{ width: `${maxVal > 0 ? (c.count / maxVal) * 100 : 0}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5) Therapist Acceptance Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Akzeptanzrate Therapeut:innen</CardTitle>
          <CardDescription>Innerhalb der letzten 7 Tage</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.therapistAcceptance ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            (() => {
              const a = data.therapistAcceptance.lastNDays.accepted || 0;
              const d = data.therapistAcceptance.lastNDays.declined || 0;
              const rate = data.therapistAcceptance.lastNDays.rate || 0;
              const total = a + d;
              const maxVal = Math.max(a, d, 1);
              return (
                <div className="space-y-3">
                  <div className="text-sm">Rate: <span className="font-medium">{rate}%</span> ({a} akzeptiert / {d} abgelehnt)</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm"><span>Akzeptiert</span><span className="tabular-nums">{a} ({pct(a, total)}%)</span></div>
                    <div className="h-2 bg-muted rounded"><div className="h-2 bg-emerald-500 rounded" style={{ width: `${(a / maxVal) * 100}%` }} /></div>
                    <div className="flex items-center justify-between text-sm"><span>Abgelehnt</span><span className="tabular-nums">{d} ({pct(d, total)}%)</span></div>
                    <div className="h-2 bg-muted rounded"><div className="h-2 bg-rose-500 rounded" style={{ width: `${(d / maxVal) * 100}%` }} /></div>
                  </div>
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      {/* 6) Warum kommen Sitzungen nicht zustande? (letzte 30 Tage) */}
      <Card>
        <CardHeader>
          <CardTitle>Warum kommen Sitzungen nicht zustande?</CardTitle>
          <CardDescription>Blocker‑Gründe der letzten 30 Tage (1‑Klick‑Feedback)</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.blockers?.last30Days || (data.blockers.last30Days.breakdown.length === 0) ? (
            <div className="text-sm text-muted-foreground">Noch keine Rückmeldungen</div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm">Gesamt: <span className="font-medium">{data.blockers.last30Days.total}</span></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 pr-3">Grund</th>
                      <th className="py-1 pr-3">Anteil</th>
                      <th className="py-1 pr-3">Anzahl</th>
                      <th className="py-1 pr-3">Hinweis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.blockers.last30Days.breakdown.map((b) => {
                      const tips: Record<string, string> = {
                        scheduling: 'Terminvorschläge erleichtern (Abende/Wochenende testen)'.trim(),
                        cost: 'Preistransparenz/Sliding‑Scale prüfen',
                        changed_mind: 'Follow‑up Copy testen',
                        no_contact: 'Sofortige Erinnerung an Therapeut:in auslösen',
                        other: 'Antworten manuell sichten',
                      };
                      const reasonLabel: Record<string, string> = {
                        scheduling: 'Terminfindung schwierig',
                        cost: 'Kosten doch zu hoch',
                        changed_mind: 'Anders entschieden',
                        no_contact: 'Therapeut:in hat sich nicht gemeldet',
                        other: 'Anderer Grund',
                      };
                      return (
                        <tr key={b.reason} className="border-t">
                          <td className="py-1 pr-3">{reasonLabel[b.reason] || b.reason}</td>
                          <td className="py-1 pr-3">{b.percentage}%</td>
                          <td className="py-1 pr-3">{b.count}</td>
                          <td className="py-1 pr-3 text-muted-foreground">{tips[b.reason] || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
