/**
 * Daily Match Quality Report
 *
 * Sends a daily email digest of match scoring metrics to LEADS_NOTIFY_EMAIL.
 * Reports on match score (patient relevance) and platform score (therapist quality)
 * distributions, fallback rates, and mismatch reasons.
 *
 * Query params:
 *   - days: Number of days to look back (default: 1)
 *   - dryRun: If "true", logs but doesn't send email
 *
 * Scheduled: Daily at 7:00 PM UTC (2 PM Eastern / 8 PM Germany) via vercel.json cron
 */
import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { isCronAuthorized } from '@/lib/cron-auth';
import { getAdminNotifyEmail } from '@/lib/email/notification-recipients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MatchRow = {
  id: string;
  patient_id: string | null;
  therapist_id: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

type PatientRow = {
  id: string;
  name: string | null;
  email: string | null;
  metadata: Record<string, unknown> | null;
};

type ScoreStats = {
  avg: number;
  min: number;
  max: number;
  count: number;
};

type ReportData = {
  matchScoreStats: ScoreStats;
  platformScoreStats: ScoreStats;
  totalScoreStats: ScoreStats;
  fallbackCount: number;
  fallbackRate: number;
  zeroMatchCount: number;
  totalMatches: number;
  scoredMatches: number;
  mismatchReasons: Record<string, number>;
  // Legacy matches without stored scores
  unscoredMatches: number;
};

function computeStats(values: number[]): ScoreStats {
  if (values.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round(sum / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
  };
}

function analyzeMatches(matches: MatchRow[]): ReportData {
  const matchScores: number[] = [];
  const platformScores: number[] = [];
  const totalScores: number[] = [];
  let fallbackCount = 0;
  let zeroMatchCount = 0;
  let unscoredMatches = 0;
  const mismatchReasons: Record<string, number> = {};

  for (const match of matches) {
    const meta = match.metadata;

    if (!match.therapist_id) {
      zeroMatchCount++;
      continue;
    }

    const matchScore = meta?.match_score as number | undefined;
    const platformScore = meta?.platform_score as number | undefined;
    const totalScore = meta?.total_score as number | undefined;

    if (matchScore == null || platformScore == null || totalScore == null) {
      unscoredMatches++;
      continue;
    }

    matchScores.push(matchScore);
    platformScores.push(platformScore);
    totalScores.push(totalScore);

    if (meta?.used_fallback === true) fallbackCount++;

    const reasons = meta?.mismatch_reasons as string[] | undefined;
    if (reasons) {
      for (const r of reasons) {
        mismatchReasons[r] = (mismatchReasons[r] || 0) + 1;
      }
    }
  }

  const scoredMatches = matchScores.length;
  const matchesWithTherapist = scoredMatches + unscoredMatches;

  return {
    matchScoreStats: computeStats(matchScores),
    platformScoreStats: computeStats(platformScores),
    totalScoreStats: computeStats(totalScores),
    fallbackCount,
    fallbackRate: matchesWithTherapist > 0 ? Math.round((fallbackCount / matchesWithTherapist) * 100) : 0,
    zeroMatchCount,
    totalMatches: matches.length,
    scoredMatches,
    mismatchReasons,
    unscoredMatches,
  };
}

function formatDateRange(days: number): { start: string; end: string; label: string } {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const label = days === 1
    ? `Gestern (${start.toLocaleDateString('de-DE')})`
    : `Letzte ${days} Tage (${start.toLocaleDateString('de-DE')} - ${end.toLocaleDateString('de-DE')})`;

  return { start: start.toISOString(), end: end.toISOString(), label };
}

function getMatchScoreEmoji(avg: number): string {
  if (avg >= 70) return '🟢';
  if (avg >= 40) return '🟡';
  if (avg >= 20) return '🟠';
  return '🔴';
}

function getPlatformScoreEmoji(avg: number): string {
  if (avg >= 45) return '🟢';
  if (avg >= 30) return '🟡';
  if (avg >= 15) return '🟠';
  return '🔴';
}

function getOverallEmoji(matchAvg: number, zeroCount: number): string {
  if (zeroCount > 0) return '🔴';
  if (matchAvg >= 70) return '🟢';
  if (matchAvg >= 40) return '🟡';
  return '🟠';
}

const REASON_LABELS: Record<string, string> = {
  gender: 'Geschlecht',
  location: 'Standort',
  modality: 'Modalität',
  language: 'Sprache',
  schwerpunkte: 'Schwerpunkte',
};

function buildEmailHtml(
  data: ReportData,
  dateLabel: string,
  affectedPatients: Array<{ name: string | null; email: string | null; matchId: string }>,
): string {
  const matchEmoji = getMatchScoreEmoji(data.matchScoreStats.avg);
  const platformEmoji = getPlatformScoreEmoji(data.platformScoreStats.avg);
  const overallEmoji = getOverallEmoji(data.matchScoreStats.avg, data.zeroMatchCount);

  const reasonRows = Object.entries(data.mismatchReasons)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => {
      const label = REASON_LABELS[reason] || reason;
      const pct = data.scoredMatches > 0 ? Math.round((count / data.scoredMatches) * 100) : 0;
      return `<div class="breakdown-row"><span>${label}</span><span><strong>${count}</strong> (${pct}%)</span></div>`;
    })
    .join('');

  const affectedList = affectedPatients.length > 0
    ? `<h3>⚠️ Patienten ohne Therapeut (${affectedPatients.length}):</h3>
       <ul>
         ${affectedPatients.map(p => `
           <li><strong>${p.name || 'Unbekannt'}</strong> (${p.email || 'Keine E-Mail'})</li>
         `).join('')}
       </ul>`
    : '';

  const unscoredNote = data.unscoredMatches > 0
    ? `<p style="color: #999; font-size: 12px; margin-top: 8px;">
        ${data.unscoredMatches} ältere Matches ohne Score-Daten (vor Tracking-Update).
      </p>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #1a1a2e; font-size: 20px; }
        h2 { color: #16213e; margin-top: 24px; font-size: 16px; }
        h3 { color: #0f3460; margin-top: 20px; font-size: 14px; }
        .scores { display: flex; gap: 12px; margin: 16px 0; }
        .score-box { flex: 1; background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center; }
        .score-value { font-size: 36px; font-weight: bold; }
        .score-label { color: #666; font-size: 12px; margin-top: 4px; }
        .score-range { color: #999; font-size: 11px; }
        .breakdown { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .breakdown-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .breakdown-row:last-child { border-bottom: none; }
        .alert { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .alert-danger { background: #f8d7da; border-color: #f5c6cb; }
        .stat-row { display: flex; justify-content: space-between; padding: 6px 0; }
        ul { padding-left: 20px; }
        li { margin: 8px 0; }
      </style>
    </head>
    <body>
      <h1>${overallEmoji} Täglicher Match-Bericht</h1>
      <p><strong>Zeitraum:</strong> ${dateLabel}</p>

      <div class="scores">
        <div class="score-box">
          <div class="score-value">${matchEmoji} ${data.matchScoreStats.avg}</div>
          <div class="score-label">Match-Score (Relevanz)</div>
          <div class="score-range">${data.matchScoreStats.min}–${data.matchScoreStats.max} · max 100</div>
        </div>
        <div class="score-box">
          <div class="score-value">${platformEmoji} ${data.platformScoreStats.avg}</div>
          <div class="score-label">Platform-Score (Therapeut)</div>
          <div class="score-range">${data.platformScoreStats.min}–${data.platformScoreStats.max} · max 65</div>
        </div>
      </div>

      <h2>📊 Übersicht</h2>
      <div class="breakdown">
        <div class="breakdown-row">
          <span>Matches gesamt</span>
          <span><strong>${data.totalMatches}</strong></span>
        </div>
        <div class="breakdown-row">
          <span>Davon mit Scores</span>
          <span><strong>${data.scoredMatches}</strong></span>
        </div>
        <div class="breakdown-row">
          <span>Fallback-Rate</span>
          <span><strong>${data.fallbackRate}%</strong> (${data.fallbackCount} Matches)</span>
        </div>
        <div class="breakdown-row">
          <span>Ohne Therapeut</span>
          <span><strong>${data.zeroMatchCount}</strong></span>
        </div>
      </div>

      ${Object.keys(data.mismatchReasons).length > 0 ? `
        <h2>🔍 Häufigste Mismatch-Gründe</h2>
        <div class="breakdown">
          ${reasonRows}
        </div>
      ` : ''}

      ${data.zeroMatchCount > 0 ? `
        <div class="alert alert-danger">
          <strong>⚠️ Achtung:</strong> ${data.zeroMatchCount} Match(es) ohne Therapeut erstellt.
          Dies deutet auf ein mögliches Problem im Matching-Algorithmus oder fehlende Therapeuten hin.
        </div>
        ${affectedList}
      ` : ''}

      ${unscoredNote}

      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e0e0;">
      <p style="color: #666; font-size: 12px;">
        Match-Score = Relevanz für Patient (Schwerpunkte, Geschlecht, Standort, Modalität).
        Platform-Score = Therapeuten-Qualität (Verfügbarkeit, Profil, Erfahrung).
      </p>
    </body>
    </html>
  `;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const daysParam = url.searchParams.get('days');
  const dryRun = url.searchParams.get('dryRun') === 'true';
  const days = daysParam ? parseInt(daysParam, 10) : 1;

  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { start, end, label } = formatDateRange(days);

    // Fetch matches from the period (exclude test matches)
    const { data: matches, error: matchError } = await supabaseServer
      .from('matches')
      .select('id, patient_id, therapist_id, status, metadata, created_at')
      .gte('created_at', start)
      .lt('created_at', end)
      .or('metadata->>is_test.is.null,metadata->>is_test.eq.false')
      .order('created_at', { ascending: false });

    if (matchError) {
      throw matchError;
    }

    const matchRows = (matches || []) as MatchRow[];
    const data = analyzeMatches(matchRows);

    // Fetch patient details for zero-matches
    const affectedPatients: Array<{ name: string | null; email: string | null; matchId: string }> = [];

    if (data.zeroMatchCount > 0) {
      const zeroMatches = matchRows.filter(m => !m.therapist_id);
      const patientIds = zeroMatches
        .map(m => m.patient_id)
        .filter((id): id is string => id !== null);

      if (patientIds.length > 0) {
        const { data: patients } = await supabaseServer
          .from('people')
          .select('id, name, email, metadata')
          .in('id', patientIds);

        const patientMap = new Map((patients || []).map((p: PatientRow) => [p.id, p]));

        for (const match of zeroMatches) {
          const patient = match.patient_id ? patientMap.get(match.patient_id) : null;
          affectedPatients.push({
            name: patient?.name || null,
            email: patient?.email || null,
            matchId: match.id,
          });
        }
      }
    }

    // Track the report
    void track({
      type: 'match_quality_report_generated',
      level: 'info',
      source: 'admin.alerts.match-quality-report',
      props: {
        days,
        match_score_avg: data.matchScoreStats.avg,
        platform_score_avg: data.platformScoreStats.avg,
        total_matches: data.totalMatches,
        scored_matches: data.scoredMatches,
        fallback_rate: data.fallbackRate,
        zero_match_count: data.zeroMatchCount,
        mismatch_reasons: data.mismatchReasons,
      },
    });

    // Build email
    const html = buildEmailHtml(data, label, affectedPatients);
    const overallEmoji = getOverallEmoji(data.matchScoreStats.avg, data.zeroMatchCount);
    const subject = `${overallEmoji} Match-Score: ${data.matchScoreStats.avg}/100 · Platform: ${data.platformScoreStats.avg}/65 - ${label}`;

    const notifyEmail = getAdminNotifyEmail();

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        data: {
          days,
          dateRange: label,
          matchScoreStats: data.matchScoreStats,
          platformScoreStats: data.platformScoreStats,
          totalScoreStats: data.totalScoreStats,
          fallbackRate: data.fallbackRate,
          fallbackCount: data.fallbackCount,
          zeroMatchCount: data.zeroMatchCount,
          totalMatches: data.totalMatches,
          scoredMatches: data.scoredMatches,
          unscoredMatches: data.unscoredMatches,
          mismatchReasons: data.mismatchReasons,
          affectedPatients: affectedPatients.length,
          subject,
          wouldSendTo: notifyEmail,
        },
      });
    }

    if (!notifyEmail) {
      return NextResponse.json({
        success: false,
        error: 'ADMIN_NOTIFY_EMAIL not configured',
        data: {
          matchScoreStats: data.matchScoreStats,
          platformScoreStats: data.platformScoreStats,
          totalMatches: data.totalMatches,
        },
      });
    }

    // Send email
    await sendEmail({
      to: notifyEmail,
      subject,
      html,
      context: { kind: 'match_quality_report', days, match_score_avg: data.matchScoreStats.avg },
    });

    return NextResponse.json({
      success: true,
      data: {
        days,
        dateRange: label,
        matchScoreStats: data.matchScoreStats,
        platformScoreStats: data.platformScoreStats,
        totalScoreStats: data.totalScoreStats,
        fallbackRate: data.fallbackRate,
        fallbackCount: data.fallbackCount,
        zeroMatchCount: data.zeroMatchCount,
        totalMatches: data.totalMatches,
        scoredMatches: data.scoredMatches,
        unscoredMatches: data.unscoredMatches,
        mismatchReasons: data.mismatchReasons,
        affectedPatients: affectedPatients.length,
        sentTo: notifyEmail,
      },
    });
  } catch (err) {
    await logError('admin.alerts.match-quality-report', err, { days });
    return NextResponse.json(
      { error: 'Internal error', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    );
  }
}
