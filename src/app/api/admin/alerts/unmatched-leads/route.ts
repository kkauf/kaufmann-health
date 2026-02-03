/**
 * GET /api/admin/alerts/unmatched-leads
 *
 * Safety-net alert: catches leads that slipped through the new-leads digest
 * (e.g., timing gaps, cron failures, deployment issues).
 *
 * Logic:
 * - Finds all status=new patients created >24h ago with 0 matches
 * - Excludes test leads
 * - Excludes directory/phone contacts (they contacted a therapist directly)
 * - Excludes leads with cal_bookings (directory bookings don't need manual matching)
 * - Sends a daily digest if any are found
 *
 * De-duplication: uses a daily digest key so the same leads are re-surfaced
 * each day until they're matched or status changes. This is intentional —
 * an unmatched lead sitting for days should keep alerting.
 */

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { logError, track } from '@/lib/logger';
import { sendEmail } from '@/lib/email/client';
import { isCronAuthorized } from '@/lib/cron-auth';
import { getLeadsNotifyEmail } from '@/lib/email/notification-recipients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function todayDigestKey(): string {
  const d = new Date();
  return `unmatched_leads_${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'cron';
  const ua = req.headers.get('user-agent') || '';

  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find all status=new patients created >24h ago
    const { data: leads, error: leadsError } = await supabaseServer
      .from('people')
      .select('id, name, status, campaign_variant, campaign_source, created_at, metadata')
      .eq('type', 'patient')
      .eq('status', 'new')
      .lt('created_at', oneDayAgo)
      .order('created_at', { ascending: true })
      .limit(200);

    if (leadsError) {
      await logError('admin.api.alerts.unmatched-leads', leadsError, { stage: 'fetch_leads' }, ip, ua);
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    const rows = (leads || []) as Array<{
      id: string;
      name: string | null;
      status: string;
      campaign_variant: string | null;
      campaign_source: string | null;
      created_at: string;
      metadata: Record<string, unknown> | null;
    }>;

    // Filter out test leads and directory contacts (phone/direct contacts don't need matching)
    const nonTestRows = rows.filter(r => {
      const meta = r.metadata || {};
      if (meta.is_test === true) return false;
      if (meta.contact_method === 'phone') return false;
      if (meta.source === 'directory_contact') return false;
      return true;
    });

    if (nonTestRows.length === 0) {
      return NextResponse.json({ ok: true, unmatched: 0, alert_sent: false });
    }

    // Check which leads have matches
    const leadIds = nonTestRows.map(r => r.id);
    const { data: matchData } = await supabaseServer
      .from('matches')
      .select('patient_id')
      .in('patient_id', leadIds);

    const hasMatches = new Set((matchData || []).map(m => m.patient_id));

    // Check which leads have direct bookings (directory flow — don't need manual matching)
    const { data: bookingData } = await supabaseServer
      .from('cal_bookings')
      .select('patient_id')
      .in('patient_id', leadIds);

    const hasBookings = new Set((bookingData || []).map(b => b.patient_id));

    // Unmatched = no matches AND no bookings
    const unmatchedLeads = nonTestRows.filter(r =>
      !hasMatches.has(r.id) && !hasBookings.has(r.id)
    );

    if (unmatchedLeads.length === 0) {
      void track({
        type: 'unmatched_leads_check',
        level: 'info',
        source: 'admin.api.alerts.unmatched-leads',
        ip,
        props: { total_checked: nonTestRows.length, unmatched: 0, status: 'ok' },
      });
      return NextResponse.json({ ok: true, unmatched: 0, alert_sent: false });
    }

    // De-dupe: one alert per day
    const digestKey = todayDigestKey();
    const { data: prior } = await supabaseServer
      .from('events')
      .select('id')
      .eq('type', 'internal_alert_sent')
      .contains('properties', { kind: 'unmatched_leads', digest_key: digestKey })
      .limit(1);

    if (Array.isArray(prior) && prior.length > 0) {
      return NextResponse.json({
        ok: true,
        unmatched: unmatchedLeads.length,
        alert_sent: false,
        reason: 'already_alerted_today',
      });
    }

    // Send alert
    const to = getLeadsNotifyEmail();
    if (!to) {
      await logError('admin.api.alerts.unmatched-leads', new Error('Missing LEADS_NOTIFY_EMAIL'), { stage: 'send' }, ip, ua);
      return NextResponse.json({ error: 'Missing recipient' }, { status: 500 });
    }

    const lines: string[] = [];
    lines.push(`${unmatchedLeads.length} lead(s) waiting >24h without matches or bookings.`);
    lines.push('');

    for (const r of unmatchedLeads) {
      const meta = (r.metadata || {}) as Record<string, unknown>;
      const city = (meta.city as string) || 'unknown';
      const variant = r.campaign_variant || '';
      const daysAgo = Math.floor((Date.now() - new Date(r.created_at).getTime()) / (24 * 60 * 60 * 1000));
      lines.push(`- ${r.id} | ${city} | ${daysAgo}d ago${variant ? ` | ${variant}` : ''} | src: ${r.campaign_source || 'unknown'}`);
    }

    lines.push('');
    lines.push('Next steps:');
    lines.push('- Review and match: /admin/leads');

    const subject = `[KH] ${unmatchedLeads.length} lead(s) waiting >24h without matches`;

    const result = await sendEmail({
      to,
      subject,
      text: lines.join('\n'),
      context: {
        kind: 'unmatched_leads',
        digest_key: digestKey,
        total: unmatchedLeads.length,
      },
    });

    if (result.sent) {
      void track({
        type: 'internal_alert_sent',
        level: 'warn',
        source: 'admin.api.alerts.unmatched-leads',
        ip,
        props: {
          kind: 'unmatched_leads',
          digest_key: digestKey,
          total: unmatchedLeads.length,
          lead_ids: unmatchedLeads.map(r => r.id),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      unmatched: unmatchedLeads.length,
      alert_sent: result.sent,
    });
  } catch (e) {
    await logError('admin.api.alerts.unmatched-leads', e, { stage: 'exception' }, ip, ua);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = GET;
