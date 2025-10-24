"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FunnelCard } from './FunnelCard';
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
    started_count?: number;
  };
  wizardDropoffs: Array<{
    step: number;
    from: number;
    to: number;
    drop: number;
    drop_rate: number;
  }>;
  abandonFieldsTop: Array<{ field: string; count: number }>;
  directory: {
    views: number;
    helpClicks: number;
    navClicks: number;
    contactOpened: number;
    contactSent: number;
    profileViewsSessions?: number;
    profileViewsTotal?: number;
    profilesPerSessionAvg?: number;
    ctaBookingSessions?: number;
    ctaConsultSessions?: number;
    verifyStartedPhoneSessions?: number;
    verifyStartedEmailSessions?: number;
    verifyCompletedPhoneSessions?: number;
    verifyCompletedEmailSessions?: number;
    openToVerifyRate?: number;
    verifyToSendRate?: number;
    openToSendRate?: number;
    closeByStep?: Array<{ step: string; count: number }>;
  };
  journeyAnalysis: {
    fragebogen_only: number;
    therapeuten_only: number;
    both_fragebogen_first: number;
    both_therapeuten_first: number;
    neither: number;
    total_sessions: number;
    questionnaire_preference_rate: number;
    directory_to_questionnaire_rate: number;
  };
  conversionFunnel?: {
    total_leads: number;
    email_only: number;
    phone_only: number;
    email_confirmed: number;
    phone_verified: number;
    converted_to_new: number;
    email_confirmation_rate: number;
    phone_verification_rate: number;
    overall_activation_rate: number;
  };
  matchFunnel?: {
    total_matches: number;
    therapist_contacted: number;
    therapist_responded: number;
    patient_selected: number;
    accepted: number;
    declined: number;
    response_rate: number;
    acceptance_rate: number;
    overall_conversion: number;
  };
  questionnaireInsights: {
    contactMethod: Array<{ option: string; count: number }>;
    sessionPreference: Array<{ option: string; count: number }>;
    onlineOk: Array<{ option: string; count: number }>;
    modalityMatters: Array<{ option: string; count: number }>;
    startTiming: Array<{ option: string; count: number }>;
    budgetBuckets: Array<{ option: string; count: number }>;
    therapyExperience: Array<{ option: string; count: number }>;
    gender: Array<{ option: string; count: number }>;
    methodsTop: Array<{ option: string; count: number }>;
    totalSessions: number;
  };
  wizardSegments: {
    bySessionPreference: Array<{ option: string; started: number; completed: number; completion_rate: number }>;
    byOnlineOk: Array<{ option: string; started: number; completed: number; completion_rate: number }>;
    byStartTiming: Array<{ option: string; started: number; completed: number; completion_rate: number }>;
    byBudgetBucket: Array<{ option: string; started: number; completed: number; completion_rate: number }>;
  };
};

export default function AdminStats() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Opt-in: support funnel-only since=YYYY-MM-DD and global cutoff=YYYY-MM-DD
      let sinceParam = '';
      let cutoffParam = '';
      try {
        if (typeof window !== 'undefined') {
          const sp = new URLSearchParams(window.location.search);
          const s = sp.get('since');
          if (s) sinceParam = `&since=${encodeURIComponent(s)}`;
          const c = sp.get('cutoff');
          if (c) cutoffParam = `&cutoff=${encodeURIComponent(c)}`;
        }
      } catch {}
      const res = await fetch(`/api/admin/stats?days=${days}${sinceParam}${cutoffParam}` , { credentials: 'include' });
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

      {/* Lead Conversion Funnel */}
      {data?.conversionFunnel && (
        <FunnelCard
          title="Lead Conversion Funnel"
          description="Email & SMS verification → Activation"
          totalLabel="Total Leads"
          totalCount={data.conversionFunnel.total_leads}
          items={[
            { label: 'Email Only', count: data.conversionFunnel.email_only, percentage: data.conversionFunnel.email_confirmation_rate, color: 'emerald', emoji: '✉️' },
            { label: 'Email Confirmed', count: data.conversionFunnel.email_confirmed, color: 'emerald' },
            { label: 'Phone Only', count: data.conversionFunnel.phone_only, percentage: data.conversionFunnel.phone_verification_rate, color: 'blue', emoji: '📱' },
            { label: 'Phone Verified', count: data.conversionFunnel.phone_verified, color: 'blue' },
            { label: 'Activated (status=new)', count: data.conversionFunnel.converted_to_new, percentage: data.conversionFunnel.overall_activation_rate, color: 'green', emoji: '✅' },
          ]}
        />
      )}

      {/* Match Conversion Funnel */}
      {data?.matchFunnel && (
        <FunnelCard
          title="Match Conversion Funnel"
          description="Therapist responses & patient selections"
          totalLabel="Total Matches"
          totalCount={data.matchFunnel.total_matches}
          items={[
            { label: 'Therapist Contacted', count: data.matchFunnel.therapist_contacted, color: 'cyan' },
            { label: 'Therapist Responded', count: data.matchFunnel.therapist_responded, percentage: data.matchFunnel.response_rate, color: 'emerald' },
            { label: 'Patient Selected', count: data.matchFunnel.patient_selected, color: 'blue' },
            { label: 'Accepted', count: data.matchFunnel.accepted, percentage: data.matchFunnel.acceptance_rate, color: 'green', emoji: '🎉' },
            { label: 'Declined', count: data.matchFunnel.declined, color: 'amber' },
          ]}
        />
      )}

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

      {/* Wizard Funnel + Dropoffs (Combined) */}
      <Card>
        <CardHeader>
          <CardTitle>Fragebogen-Funnel & Abbrüche</CardTitle>
          <CardDescription>
            Progression durch den 9-Schritte Questionnaire + Drop-off Analyse
            <br />
            <span className="text-xs text-emerald-700 font-medium">
              ✓ Cohort-based funnel: Tracks same sessions through all steps sequentially
            </span>
            <br />
            <span className="text-xs text-muted-foreground">
              Completed = Form submitted (form_completed event from sessions that reached step 9)
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.wizardFunnel ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <div className="space-y-6">
              {/* Data quality indicators */}
              {data.wizardFunnel.page_views === 0 && data.wizardFunnel.steps[1] > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                  <strong>⚠ Data inconsistency:</strong> Step 1 shows {data.wizardFunnel.steps[1]} sessions but page views = 0.
                  This indicates missing page_view events or mismatched session IDs.
                </div>
              )}

              {/* Summary metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Page Views</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.wizardFunnel.page_views}</div>
                  <div className="text-xs text-muted-foreground">Unique sessions on /fragebogen</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Started (Step 1)</div>
                  <div className="text-2xl font-semibold tabular-nums">{(data.wizardFunnel.started_count ?? data.wizardFunnel.steps[1]) || 0}</div>
                  <div className="text-xs text-muted-foreground">Page View ∩ Step 1</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Completed</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.wizardFunnel.form_completed}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Completion Rate:{' '}
                    {(data.wizardFunnel.started_count ?? data.wizardFunnel.steps[1]) > 0
                      ? pct(
                          data.wizardFunnel.form_completed,
                          (data.wizardFunnel.started_count ?? data.wizardFunnel.steps[1])
                        )
                      : 0}%
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Start Rate</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.wizardFunnel.start_rate}%</div>
                  <div className="text-xs text-muted-foreground">Step 1 / Page Views</div>
                </div>
              </div>

              {/* Funnel visualization */}
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Funnel Progression</h4>
                {(() => {
                  const step1Count = data.wizardFunnel.steps[1] || 1;

                  return (
                    <>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((step) => {
                        const count = data.wizardFunnel.steps[step] || 0;
                        const widthPct = (count / step1Count) * 100;
                        const retentionRate = step > 1 ? pct(count, data.wizardFunnel.steps[step - 1] || 1) : 100;

                        const stepLabels: Record<number, string> = {
                          1: 'Therapieerfahrung',
                          2: 'Zeitplan',
                          3: 'Anliegen',
                          4: 'Budget',
                          5: 'Modalität',
                          6: 'Ort & Format',
                          7: 'Präferenzen',
                          8: 'Kontaktdaten',
                          9: 'Bestätigung',
                        };

                        return (
                          <div key={step} className="flex items-center gap-2 text-xs">
                            <div className="w-16 text-right text-muted-foreground">Step {step}</div>
                            <div className="flex-1 bg-gray-100 rounded-sm h-6 relative overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full transition-all duration-300 flex items-center px-2"
                                style={{ width: `${widthPct}%` }}
                              >
                                {widthPct > 15 && (
                                  <span className="text-white font-medium text-xs tabular-nums">{count}</span>
                                )}
                              </div>
                            </div>
                            <div className="w-32 text-left">
                              <div className="font-medium tabular-nums">{count} ({pct(count, step1Count)}%)</div>
                            </div>
                            <div className="w-40 text-left text-muted-foreground">{stepLabels[step]}</div>
                            {step > 1 && (
                              <div className="w-20 text-right tabular-nums text-muted-foreground">
                                {retentionRate}% kept
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Final completion bar */}
                      <div className="flex items-center gap-2 text-xs pt-2 border-t">
                        <div className="w-16 text-right text-muted-foreground font-medium">Complete</div>
                        <div className="flex-1 bg-gray-100 rounded-sm h-6 relative overflow-hidden">
                          <div
                            className="bg-blue-600 h-full transition-all duration-300 flex items-center px-2"
                            style={{ width: `${(data.wizardFunnel.form_completed / step1Count) * 100}%` }}
                          >
                            {((data.wizardFunnel.form_completed / step1Count) * 100) > 15 && (
                              <span className="text-white font-medium text-xs tabular-nums">{data.wizardFunnel.form_completed}</span>
                            )}
                          </div>
                        </div>
                        <div className="w-32 text-left">
                          <div className="font-semibold tabular-nums text-blue-700">
                            {data.wizardFunnel.form_completed} ({pct(data.wizardFunnel.form_completed, step1Count)}%)
                          </div>
                        </div>
                        <div className="w-40 text-left text-blue-700 font-medium">Form Submitted</div>
                        <div className="w-20 text-right tabular-nums text-blue-700 font-medium">
                          {pct(data.wizardFunnel.form_completed, data.wizardFunnel.steps[9] || 1)}% from Step 9
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Dropoffs + Abandoned Fields (collapsible) */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground">Details: Dropoffs & Abgebrochene Felder</summary>
                <div className="mt-2 space-y-4">
                  {data.wizardDropoffs && data.wizardDropoffs.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Step-by-Step Dropoff Analysis</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="py-1 pr-3">Schritt</th>
                              <th className="py-1 pr-3">Inhalt</th>
                              <th className="py-1 pr-3 text-right">Von</th>
                              <th className="py-1 pr-3 text-right">Zu</th>
                              <th className="py-1 pr-3 text-right">Drop</th>
                              <th className="py-1 pr-3 text-right">Drop Rate</th>
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
                              const isHighDrop = d.drop_rate > 50;
                              const isMediumDrop = d.drop_rate > 30 && d.drop_rate <= 50;

                              return (
                                <tr key={d.step} className="border-t hover:bg-gray-50">
                                  <td className="py-2 pr-3 font-medium">
                                    {d.step} → {d.step + 1}
                                  </td>
                                  <td className="py-2 pr-3 text-muted-foreground text-xs">
                                    {stepLabels[d.step] || '—'}
                                  </td>
                                  <td className="py-2 pr-3 text-right tabular-nums">{d.from}</td>
                                  <td className="py-2 pr-3 text-right tabular-nums">{d.to}</td>
                                  <td className="py-2 pr-3 text-right tabular-nums">{d.drop}</td>
                                  <td className="py-2 pr-3 text-right tabular-nums">
                                    <span className={
                                      isHighDrop
                                        ? 'text-red-600 font-semibold'
                                        : isMediumDrop
                                        ? 'text-amber-600 font-medium'
                                        : 'text-gray-700'
                                    }>
                                      {d.drop_rate}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {data.abandonFieldsTop && data.abandonFieldsTop.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Abgebrochene Felder</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="py-1 pr-3">Feld</th>
                              <th className="py-1 pr-3 text-right">Anzahl</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.abandonFieldsTop.map((f) => (
                              <tr key={f.field} className="border-t">
                                <td className="py-1 pr-3 font-mono text-xs">{f.field}</td>
                                <td className="py-1 pr-3 text-right tabular-nums">{f.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Abandoned Fields merged above */}

      {/* Journey Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Fragebogen vs. Therapeuten Journey</CardTitle>
          <CardDescription>
            Wie entscheiden sich Besucher: Fragebogen oder Verzeichnis?
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.journeyAnalysis ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <div className="space-y-4">
              {/* Detailed breakdown */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Journey-Verteilung ({data.journeyAnalysis.total_sessions} Sessions)</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-emerald-50 rounded">
                    <span className="text-sm">🎯 Nur Fragebogen</span>
                    <div className="text-right">
                      <span className="font-semibold tabular-nums">{data.journeyAnalysis.fragebogen_only}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({pct(data.journeyAnalysis.fragebogen_only, data.journeyAnalysis.total_sessions)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                    <span className="text-sm">📋 Nur Verzeichnis</span>
                    <div className="text-right">
                      <span className="font-semibold tabular-nums">{data.journeyAnalysis.therapeuten_only}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({pct(data.journeyAnalysis.therapeuten_only, data.journeyAnalysis.total_sessions)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                    <span className="text-sm">🎯→📋 Fragebogen, dann Verzeichnis</span>
                    <div className="text-right">
                      <span className="font-semibold tabular-nums">{data.journeyAnalysis.both_fragebogen_first}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({pct(data.journeyAnalysis.both_fragebogen_first, data.journeyAnalysis.total_sessions)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-cyan-50 rounded">
                    <span className="text-sm">📋→🎯 Verzeichnis, dann Fragebogen</span>
                    <div className="text-right">
                      <span className="font-semibold tabular-nums">{data.journeyAnalysis.both_therapeuten_first}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({pct(data.journeyAnalysis.both_therapeuten_first, data.journeyAnalysis.total_sessions)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-100 rounded">
                    <span className="text-sm text-muted-foreground">🏠 Andere Seiten nur</span>
                    <div className="text-right">
                      <span className="font-semibold tabular-nums text-muted-foreground">{data.journeyAnalysis.neither}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({pct(data.journeyAnalysis.neither, data.journeyAnalysis.total_sessions)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Profile Sessions</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.profileViewsSessions ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Profile Views</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.profileViewsTotal ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Profiles/Session</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.profilesPerSessionAvg ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Booking CTAs</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.ctaBookingSessions ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Erstgespräch CTAs</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.ctaConsultSessions ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Verify Started (Phone)</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.verifyStartedPhoneSessions ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Verify Started (Email)</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.verifyStartedEmailSessions ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Verify Completed (Phone)</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.verifyCompletedPhoneSessions ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Verify Completed (Email)</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.verifyCompletedEmailSessions ?? 0}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Open → Verify</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.openToVerifyRate ?? 0}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Verify → Send</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.verifyToSendRate ?? 0}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Open → Send</div>
                  <div className="text-2xl font-semibold tabular-nums">{data.directory.openToSendRate ?? 0}%</div>
                </div>
              </div>

              {data.directory.closeByStep && data.directory.closeByStep.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Abbruch nach Schritt</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-1 pr-3">Schritt</th>
                          <th className="py-1 pr-3 text-right">Anzahl</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.directory.closeByStep.map((r: { step: string; count: number }) => (
                          <tr key={r.step} className="border-t">
                            <td className="py-1 pr-3 font-mono text-xs">{r.step}</td>
                            <td className="py-1 pr-3 text-right tabular-nums">{r.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Questionnaire Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Questionnaire Insights</CardTitle>
          <CardDescription>Aggregated preferences from Fragebogen (last {days} days)</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.questionnaireInsights ? (
            <div className="text-sm text-muted-foreground">Keine Daten</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Total sessions</div>
                <div className="text-2xl font-semibold tabular-nums">{data.questionnaireInsights.totalSessions}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(() => {
                  const block = (title: string, items: Array<{ option: string; count: number }>) => (
                    <div key={title}>
                      <div className="text-sm font-medium mb-2">{title}</div>
                      {!items?.length ? (
                        <div className="text-sm text-muted-foreground">—</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="py-1 pr-3">Option</th>
                                <th className="py-1 pr-3 text-right">Count</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.slice(0, 10).map((r) => (
                                <tr key={`${title}-${r.option}`} className="border-t">
                                  <td className="py-1 pr-3 font-mono text-xs">{r.option}</td>
                                  <td className="py-1 pr-3 text-right tabular-nums">{r.count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                  return (
                    <>
                      {block('Kontaktmethode', data.questionnaireInsights.contactMethod)}
                      {block('Sitzungspräferenz', data.questionnaireInsights.sessionPreference)}
                      {block('Therapieerfahrung', data.questionnaireInsights.therapyExperience)}
                      {block('Modalität wichtig', data.questionnaireInsights.modalityMatters)}
                      {block('Startzeit', data.questionnaireInsights.startTiming)}
                      {block('Budget', data.questionnaireInsights.budgetBuckets)}
                      {block('Geschlecht', data.questionnaireInsights.gender)}
                      {block('Methoden (Top)', data.questionnaireInsights.methodsTop)}
                    </>
                  );
                })()}
              </div>
              <div className="pt-2">
                <a
                  href={`/api/admin/stats/questionnaire.csv?days=${days}`}
                  className="inline-flex items-center rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                >
                  CSV exportieren
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
