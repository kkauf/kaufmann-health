/**
 * Daily Match Quality Report
 * 
 * Sends a daily email digest of match quality metrics to LEADS_NOTIFY_EMAIL.
 * Includes a 0-100 index score and breakdown of match types.
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

/**
 * Calculate match quality index (0-100)
 * 
 * Scoring:
 * - match_quality "exact": 100 points
 * - match_quality "partial": 70 points  
 * - match_quality "none" (but has therapist): 40 points
 * - match_quality "none" (no therapist): 0 points
 * 
 * The index is the average across all matches for the period.
 */
function calculateMatchQualityIndex(matches: MatchRow[]): number {
  if (matches.length === 0) return 100; // No matches = no problems
  
  let totalScore = 0;
  for (const match of matches) {
    const quality = (match.metadata?.match_quality as string) || 'none';
    const hasTherapist = match.therapist_id !== null;
    
    if (quality === 'exact') {
      totalScore += 100;
    } else if (quality === 'partial') {
      totalScore += 70;
    } else if (hasTherapist) {
      totalScore += 40;
    } else {
      totalScore += 0;
    }
  }
  
  return Math.round(totalScore / matches.length);
}

function formatDateRange(days: number): { start: string; end: string; label: string } {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  
  const label = days === 1 
    ? `Gestern (${start.toLocaleDateString('de-DE')})` 
    : `Letzte ${days} Tage (${start.toLocaleDateString('de-DE')} - ${end.toLocaleDateString('de-DE')})`;
  
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label,
  };
}

function getQualityEmoji(index: number): string {
  if (index >= 90) return '🟢';
  if (index >= 70) return '🟡';
  if (index >= 50) return '🟠';
  return '🔴';
}

function buildEmailHtml(
  index: number,
  dateLabel: string,
  breakdown: { exact: number; partial: number; none_with_therapist: number; none_empty: number },
  totalMatches: number,
  affectedPatients: Array<{ name: string | null; email: string | null; matchId: string; quality: string }>
): string {
  const emoji = getQualityEmoji(index);
  
  const affectedList = affectedPatients.length > 0
    ? `<h3>Betroffene Patienten (${affectedPatients.length}):</h3>
       <ul>
         ${affectedPatients.map(p => `
           <li><strong>${p.name || 'Unbekannt'}</strong> (${p.email || 'Keine E-Mail'}) - Match-Qualität: ${p.quality}</li>
         `).join('')}
       </ul>`
    : '<p>Keine betroffenen Patienten mit schlechter Match-Qualität.</p>';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #1a1a2e; }
        h2 { color: #16213e; margin-top: 24px; }
        h3 { color: #0f3460; margin-top: 20px; }
        .index-box { background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .index-score { font-size: 48px; font-weight: bold; }
        .index-label { color: #666; font-size: 14px; }
        .breakdown { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .breakdown-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .breakdown-row:last-child { border-bottom: none; }
        .alert { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .alert-danger { background: #f8d7da; border-color: #f5c6cb; }
        ul { padding-left: 20px; }
        li { margin: 8px 0; }
      </style>
    </head>
    <body>
      <h1>${emoji} Täglicher Match-Qualitätsbericht</h1>
      <p><strong>Zeitraum:</strong> ${dateLabel}</p>
      
      <div class="index-box">
        <div class="index-score">${index}</div>
        <div class="index-label">Match-Qualitäts-Index (0-100)</div>
      </div>
      
      <h2>📊 Aufschlüsselung</h2>
      <div class="breakdown">
        <div class="breakdown-row">
          <span>🎯 Exakte Matches</span>
          <span><strong>${breakdown.exact}</strong></span>
        </div>
        <div class="breakdown-row">
          <span>✓ Partielle Matches</span>
          <span><strong>${breakdown.partial}</strong></span>
        </div>
        <div class="breakdown-row">
          <span>⚠️ Keine Übereinstimmung (mit Therapeut)</span>
          <span><strong>${breakdown.none_with_therapist}</strong></span>
        </div>
        <div class="breakdown-row">
          <span>❌ Keine Übereinstimmung (leer)</span>
          <span><strong>${breakdown.none_empty}</strong></span>
        </div>
        <div class="breakdown-row" style="font-weight: bold; background: #f8f9fa;">
          <span>Gesamt</span>
          <span>${totalMatches}</span>
        </div>
      </div>
      
      ${breakdown.none_empty > 0 ? `
        <div class="alert alert-danger">
          <strong>⚠️ Achtung:</strong> ${breakdown.none_empty} Match(es) ohne Therapeut erstellt. 
          Dies deutet auf ein mögliches Problem im Matching-Algorithmus hin.
        </div>
      ` : ''}
      
      ${affectedList}
      
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e0e0;">
      <p style="color: #666; font-size: 12px;">
        Dieser Bericht wird täglich automatisch generiert. 
        Ein Index unter 70 erfordert Aufmerksamkeit.
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
    
    // Fetch matches from the period
    // Use proper JSONB filter syntax - exclude test matches
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
    
    // Calculate metrics
    const index = calculateMatchQualityIndex(matchRows);
    const breakdown = {
      exact: 0,
      partial: 0,
      none_with_therapist: 0,
      none_empty: 0,
    };
    
    const emptyMatches: MatchRow[] = [];
    
    for (const match of matchRows) {
      const quality = (match.metadata?.match_quality as string) || 'none';
      const hasTherapist = match.therapist_id !== null;
      
      if (quality === 'exact') {
        breakdown.exact++;
      } else if (quality === 'partial') {
        breakdown.partial++;
      } else if (hasTherapist) {
        breakdown.none_with_therapist++;
      } else {
        breakdown.none_empty++;
        emptyMatches.push(match);
      }
    }
    
    // Fetch patient details for empty matches
    const affectedPatients: Array<{ name: string | null; email: string | null; matchId: string; quality: string }> = [];
    
    if (emptyMatches.length > 0) {
      const patientIds = emptyMatches
        .map(m => m.patient_id)
        .filter((id): id is string => id !== null);
      
      if (patientIds.length > 0) {
        const { data: patients } = await supabaseServer
          .from('people')
          .select('id, name, email, metadata')
          .in('id', patientIds);
        
        const patientMap = new Map((patients || []).map((p: PatientRow) => [p.id, p]));
        
        for (const match of emptyMatches) {
          const patient = match.patient_id ? patientMap.get(match.patient_id) : null;
          affectedPatients.push({
            name: patient?.name || null,
            email: patient?.email || null,
            matchId: match.id,
            quality: (match.metadata?.match_quality as string) || 'none',
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
        index,
        total_matches: matchRows.length,
        breakdown,
        affected_count: affectedPatients.length,
      },
    });
    
    // Build email
    const html = buildEmailHtml(index, label, breakdown, matchRows.length, affectedPatients);
    const emoji = getQualityEmoji(index);
    const subject = `${emoji} Match-Qualität: ${index}/100 - ${label}`;
    
    const notifyEmail = getAdminNotifyEmail();

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        data: {
          days,
          dateRange: label,
          index,
          breakdown,
          totalMatches: matchRows.length,
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
        data: { index, breakdown, totalMatches: matchRows.length },
      });
    }
    
    // Send email
    await sendEmail({
      to: notifyEmail,
      subject,
      html,
      context: { kind: 'match_quality_report', days, index },
    });
    
    return NextResponse.json({
      success: true,
      data: {
        days,
        dateRange: label,
        index,
        breakdown,
        totalMatches: matchRows.length,
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
