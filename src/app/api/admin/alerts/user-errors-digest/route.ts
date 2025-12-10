/**
 * User-Facing Errors Digest (Twice Daily)
 * 
 * Sends an email digest of all user-facing errors from the last 12 hours.
 * At small scale, every error matters.
 * 
 * GET /api/admin/alerts/user-errors-digest
 * 
 * Cron: Runs at 08:00 and 20:00 daily
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email/client';
import { renderLayout } from '@/lib/email/layout';
import { track, logError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIGEST_HOURS = 12;
const NOTIFY_EMAIL = process.env.LEADS_NOTIFY_EMAIL || 'kontakt@kaufmann-health.de';

function isCronAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  
  const cronHeader = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
  if (cronHeader === cronSecret) return true;
  
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret) return true;
  
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (token === cronSecret) return true;
  } catch {}
  
  return false;
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type ErrorEvent = {
  id: string;
  created_at: string;
  properties: {
    error_type?: string;
    status?: number | string;
    url?: string;
    message?: string;
    page_path?: string;
    session_id?: string;
    is_test?: boolean | string;
  } | null;
};

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const ua = req.headers.get('user-agent') || '';

  if (!isCronAuthorized(req)) {
    return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sinceIso = new Date(Date.now() - DIGEST_HOURS * 60 * 60 * 1000).toISOString();

    // Fetch user-facing errors
    const { data, error } = await supabaseServer
      .from('events')
      .select('id, created_at, properties')
      .eq('type', 'user_facing_error')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      await logError('admin.alerts.user-errors-digest', error, { stage: 'fetch' }, ip, ua);
      return NextResponse.json({ data: null, error: 'Database error' }, { status: 500 });
    }

    const rawEvents = (data || []) as ErrorEvent[];

    // Filter out errors that are expected client-side issues, not actionable server bugs
    const events = rawEvents.filter(e => {
      const props = e.properties || {};
      const status = props.status;
      const statusNum = typeof status === 'string' ? parseInt(status, 10) : status;
      const errorType = props.error_type || '';
      const message = props.message || '';
      
      // 410 = expired sessions - expected behavior
      if (statusNum === 410) return false;
      
      // network_error = client lost connection (mobile, flaky wifi, etc.)
      if (errorType === 'network_error') return false;
      
      // ChunkLoadError = browser failed to load Next.js static chunks (network/CDN issues)
      if (errorType === 'unhandled' && message.includes('ChunkLoadError')) return false;
      
      return true;
    });

    // If no errors, log but don't send email
    if (events.length === 0) {
      void track({
        type: 'user_errors_digest_empty',
        source: 'admin.alerts.user-errors-digest',
        props: { hours: DIGEST_HOURS },
      });
      return NextResponse.json({
        data: { sent: false, reason: 'no_errors', count: 0 },
        error: null,
      });
    }

    // Aggregate stats
    const byType: Record<string, number> = {};
    const byUrl: Record<string, number> = {};
    const authErrors: ErrorEvent[] = [];
    let testCount = 0;
    let realCount = 0;

    for (const e of events) {
      const props = e.properties || {};
      const errorType = props.error_type || 'unknown';
      const apiUrl = props.url || 'unknown';
      const isTest = props.is_test === true || props.is_test === 'true';

      byType[errorType] = (byType[errorType] || 0) + 1;
      byUrl[apiUrl] = (byUrl[apiUrl] || 0) + 1;

      if (isTest) {
        testCount++;
      } else {
        realCount++;
      }

      if (errorType === 'auth_error') {
        authErrors.push(e);
      }
    }

    // Build email content
    const summaryRows = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => {
        const color = type === 'auth_error' ? '#dc2626' : type === 'api_error' ? '#d97706' : '#64748b';
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;"><span style="color:${color};font-weight:600;">${escapeHtml(type)}</span></td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${count}</td>
        </tr>`;
      })
      .join('');

    const urlRows = Object.entries(byUrl)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, count]) => `<tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:13px;">${escapeHtml(url)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${count}</td>
      </tr>`)
      .join('');

    const recentErrorRows = events.slice(0, 15).map(e => {
      const props = e.properties || {};
      const time = new Date(e.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
      const type = props.error_type || 'unknown';
      const isTest = props.is_test === true || props.is_test === 'true';
      const typeColor = type === 'auth_error' ? '#dc2626' : type === 'api_error' ? '#d97706' : '#64748b';
      const testBadge = isTest ? '<span style="background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600;margin-left:4px;">TEST</span>' : '';
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">${time}${testBadge}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;"><span style="color:${typeColor};font-weight:600;font-size:13px;">${escapeHtml(type)}</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:12px;">${escapeHtml(props.url || '-')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-size:12px;">${escapeHtml(props.page_path || '-')}</td>
      </tr>`;
    }).join('');

    const hasAuthErrors = authErrors.length > 0;
    const hasRealErrors = realCount > 0;
    const alertLevel = hasRealErrors ? (hasAuthErrors ? '🔴 CRITICAL' : '⚠️ WARNING') : '🧪 TEST ONLY';

    const headerBg = !hasRealErrors ? '#e0f2fe' : (hasAuthErrors ? '#fef2f2' : '#fffbeb');
    const headerBorder = !hasRealErrors ? '#7dd3fc' : (hasAuthErrors ? '#fecaca' : '#fde68a');

    const contentHtml = `
      <div style="background:${headerBg};padding:16px 20px;border-radius:12px;border:1px solid ${headerBorder};margin-bottom:24px;">
        <h1 style="margin:0 0 8px;font-size:24px;color:#0f172a;">${alertLevel} User-Facing Errors</h1>
        <p style="margin:0;color:#475569;">
          <strong>${events.length} error${events.length === 1 ? '' : 's'}</strong> in the last ${DIGEST_HOURS} hours
          ${hasAuthErrors ? `<br><span style="color:#dc2626;font-weight:600;">${authErrors.length} auth error${authErrors.length === 1 ? '' : 's'} (session/verification failures)</span>` : ''}
        </p>
        <p style="margin:8px 0 0;font-size:14px;">
          <span style="background:#16a34a;color:#fff;padding:2px 8px;border-radius:4px;font-weight:600;">${realCount} real</span>
          <span style="background:#0ea5e9;color:#fff;padding:2px 8px;border-radius:4px;font-weight:600;margin-left:8px;">${testCount} test</span>
        </p>
      </div>

      <h2 style="margin:24px 0 12px;font-size:18px;color:#0f172a;">Summary by Type</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">Error Type</th>
          <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Count</th>
        </tr></thead>
        <tbody>${summaryRows}</tbody>
      </table>

      <h2 style="margin:24px 0 12px;font-size:18px;color:#0f172a;">Top Affected Endpoints</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;">URL</th>
          <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;">Count</th>
        </tr></thead>
        <tbody>${urlRows}</tbody>
      </table>

      <h2 style="margin:24px 0 12px;font-size:18px;color:#0f172a;">Recent Errors</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);font-size:13px;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:8px;text-align:left;font-weight:600;color:#475569;">Time</th>
          <th style="padding:8px;text-align:left;font-weight:600;color:#475569;">Type</th>
          <th style="padding:8px;text-align:left;font-weight:600;color:#475569;">Endpoint</th>
          <th style="padding:8px;text-align:left;font-weight:600;color:#475569;">Page</th>
        </tr></thead>
        <tbody>${recentErrorRows}</tbody>
      </table>

      <div style="margin-top:24px;padding:16px;background:#f8fafc;border-radius:8px;">
        <p style="margin:0;font-size:14px;color:#64748b;">
          <strong>Next steps:</strong> Check <a href="https://www.kaufmann-health.de/admin" style="color:#0f766e;">Admin Dashboard</a> 
          or call <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">/api/admin/alerts/user-errors?hours=24</code> for more details.
        </p>
      </div>
    `;

    const html = renderLayout({
      contentHtml,
      preheader: `${events.length} user-facing errors in the last ${DIGEST_HOURS}h`,
    });

    const subjectPrefix = !hasRealErrors ? '🧪' : (hasAuthErrors ? '🔴' : '⚠️');
    const subjectSuffix = realCount > 0 ? ` (${realCount} real, ${testCount} test)` : ' (all test)';
    const subject = `${subjectPrefix} ${events.length} User Error${events.length === 1 ? '' : 's'}${subjectSuffix}`;

    const sent = await sendEmail({
      to: NOTIFY_EMAIL,
      subject,
      html,
      context: { kind: 'user_errors_digest', count: events.length, auth_errors: authErrors.length, real: realCount, test: testCount },
    });

    void track({
      type: 'user_errors_digest_sent',
      source: 'admin.alerts.user-errors-digest',
      props: { count: events.length, auth_errors: authErrors.length, real: realCount, test: testCount, sent },
    });

    return NextResponse.json({
      data: {
        sent,
        count: events.length,
        byType,
        authErrors: authErrors.length,
        realCount,
        testCount,
      },
      error: null,
    });
  } catch (e) {
    await logError('admin.alerts.user-errors-digest', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
