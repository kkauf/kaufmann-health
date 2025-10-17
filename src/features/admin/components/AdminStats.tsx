"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type StatsData = {
  totals: {
    therapists: number;
    clients: number;
    matches: number;
  };
  pageTraffic: {
    top: Array<{ page_path: string; sessions: number }>;
    daily: Array<{ day: string; page_path: string; sessions: number }>;
  };
  wizardFunnel: {
    page_views: number;
    steps: Record<number, number>;
    form_completed: number;
    start_rate: number;
  };
  wizardDropoffs: Array<{
    step: number;
    from: number;
    to: number;
    drop: number;
    drop_rate: number;
  }>;
  wizardAvgTime: Array<{ step: number; avg_ms: number }>;
  abandonFieldsTop: Array<{ field: string; count: number }>;
  directory: {
    views: number;
    helpClicks: number;
    navClicks: number;
    contactOpened: number;
    contactSent: number;
  };
};

export default function AdminStats() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stats?days=${days}`, { credentials: 'include' });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Admin Statistics</h2>
          <p className="text-sm text-muted-foreground">
            Tracking insights for last {days} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? 'Lädt…' : 'Neu laden'}
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Therapeut:innen</CardTitle>
            <CardDescription>Gesamt registriert (ohne Tests)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{data?.totals.therapists ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Klient:innen</CardTitle>
            <CardDescription>Gesamt registriert (ohne Tests)</CardDescription>
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

      {/* Page Traffic */}
      <Card>
        <CardHeader>
          <CardTitle>Seiten-Traffic</CardTitle>
          <CardDescription>Top 10 Seiten nach einzigartigen Sessions</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.pageTraffic?.top?.length ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3">Seite</th>
                    <th className="py-1 pr-3">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pageTraffic.top.map((r) => (
                    <tr key={r.page_path} className="border-t">
                      <td className="py-1 pr-3 font-mono text-xs">{r.page_path}</td>
                      <td className="py-1 pr-3 tabular-nums">{r.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wizard Funnel Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Fragebogen-Funnel</CardTitle>
          <CardDescription>
            Progression durch den 9-Schritte Questionnaire
            <br />
            <span className="text-xs">
              Completed = Kontaktdaten eingegeben (Schritt 8/9 abgeschlossen)
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.wizardFunnel ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Page Views</div>
                  <div className="text-2xl font-semibold">{data.wizardFunnel.page_views}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Started (Step 1)</div>
                  <div className="text-2xl font-semibold">{data.wizardFunnel.steps[1] || 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Completed</div>
                  <div className="text-2xl font-semibold">{data.wizardFunnel.form_completed}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Completion Rate:{' '}
                    {data.wizardFunnel.steps[1] > 0
                      ? pct(data.wizardFunnel.form_completed, data.wizardFunnel.steps[1])
                      : 0}%
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Start Rate</div>
                  <div className="text-2xl font-semibold">{data.wizardFunnel.start_rate}%</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 pr-3">Step</th>
                      <th className="py-1 pr-3">Sessions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 9 }, (_, i) => i + 1).map((step) => (
                      <tr key={step} className="border-t">
                        <td className="py-1 pr-3">Step {step}</td>
                        <td className="py-1 pr-3 tabular-nums">{data.wizardFunnel.steps[step] || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wizard Dropoffs */}
      <Card>
        <CardHeader>
          <CardTitle>Fragebogen-Abbrüche</CardTitle>
          <CardDescription>Schritt-zu-Schritt Drop-off Analyse</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.wizardDropoffs?.length ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3">Schritt</th>
                    <th className="py-1 pr-3">Inhalt</th>
                    <th className="py-1 pr-3">Von</th>
                    <th className="py-1 pr-3">Zu</th>
                    <th className="py-1 pr-3">Drop</th>
                    <th className="py-1 pr-3">Drop Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.wizardDropoffs.map((d) => {
                    const stepLabels: Record<number, string> = {
                      1: 'Therapieerfahrung',
                      2: 'Zeitplan',
                      3: 'Anliegen',
                      4: 'Budget',
                      5: 'Modalität',
                      6: 'Ort & Format',
                      7: 'Präferenzen',
                      8: 'Kontaktdaten',
                    };
                    return (
                      <tr key={d.step} className="border-t">
                        <td className="py-1 pr-3 font-medium">
                          {d.step} → {d.step + 1}
                        </td>
                        <td className="py-1 pr-3 text-muted-foreground text-xs">
                          {stepLabels[d.step] || '—'}
                        </td>
                        <td className="py-1 pr-3 tabular-nums">{d.from}</td>
                        <td className="py-1 pr-3 tabular-nums">{d.to}</td>
                        <td className="py-1 pr-3 tabular-nums">{d.drop}</td>
                        <td className="py-1 pr-3 tabular-nums">
                          <span className={d.drop_rate > 50 ? 'text-red-600 font-semibold' : d.drop_rate < 0 ? 'text-emerald-600' : ''}>
                            {d.drop_rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wizard Average Time */}
      <Card>
        <CardHeader>
          <CardTitle>Durchschnittliche Zeit pro Schritt</CardTitle>
          <CardDescription>Zeit in Millisekunden</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.wizardAvgTime?.length ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3">Step</th>
                    <th className="py-1 pr-3">Ø Zeit (ms)</th>
                    <th className="py-1 pr-3">Ø Zeit (sec)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.wizardAvgTime.map((t) => (
                    <tr key={t.step} className="border-t">
                      <td className="py-1 pr-3">Step {t.step}</td>
                      <td className="py-1 pr-3 tabular-nums">{t.avg_ms}</td>
                      <td className="py-1 pr-3 tabular-nums text-muted-foreground">
                        {Math.round(t.avg_ms / 100) / 10}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Abandoned Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Abgebrochene Felder</CardTitle>
          <CardDescription>Top Felder, bei denen Nutzer abbrechen</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.abandonFieldsTop?.length ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-3">Feld</th>
                    <th className="py-1 pr-3">Anzahl</th>
                  </tr>
                </thead>
                <tbody>
                  {data.abandonFieldsTop.map((f) => (
                    <tr key={f.field} className="border-t">
                      <td className="py-1 pr-3 font-mono text-xs">{f.field}</td>
                      <td className="py-1 pr-3 tabular-nums">{f.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Directory Engagement */}
      <Card>
        <CardHeader>
          <CardTitle>Verzeichnis-Engagement (/therapeuten)</CardTitle>
          <CardDescription>Nutzung des Therapeuten-Verzeichnisses</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.directory ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Views</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.views}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Help Clicks</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {data.directory.helpClicks}{' '}
                    <span className="text-sm text-muted-foreground">
                      ({pct(data.directory.helpClicks, data.directory.views)}%)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Nav Clicks</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {data.directory.navClicks}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    &ldquo;Alle Therapeuten ansehen&rdquo; clicks across site
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Contact Opened</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {data.directory.contactOpened}{' '}
                    <span className="text-sm text-muted-foreground">
                      ({pct(data.directory.contactOpened, data.directory.views)}%)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Messages Sent</div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {data.directory.contactSent}{' '}
                    <span className="text-sm text-muted-foreground">
                      ({pct(data.directory.contactSent, data.directory.views)}%)
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Help Click Rate:</span>
                  <span className="font-medium">{pct(data.directory.helpClicks, data.directory.views)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact Open Rate:</span>
                  <span className="font-medium">{pct(data.directory.contactOpened, data.directory.views)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Message Send Rate:</span>
                  <span className="font-medium">{pct(data.directory.contactSent, data.directory.views)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Questionnaire vs Directory:</span>
                  <span className="font-medium">
                    {data.directory.helpClicks > 0 
                      ? `${Math.round((data.directory.helpClicks / (data.directory.views || 1)) * 100)}% chose questionnaire`
                      : 'No data'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
