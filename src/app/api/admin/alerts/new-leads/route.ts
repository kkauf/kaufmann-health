import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/email/client';
import { logError, track } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseCookie(header?: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!header) return map;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k && typeof v === 'string') map.set(k, decodeURIComponent(v));
  }
  return map;
}

async function _isCronOrAdmin(req: Request): Promise<boolean> {
  try {
    const cronSecretHeader = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization') || '';
    const isAuthBearer = Boolean(cronSecret && authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret);
    let isCron = Boolean(cronSecret && cronSecretHeader && cronSecretHeader === cronSecret) || isAuthBearer;
    if (!isCron && cronSecret) {
      try {
        const u = new URL(req.url);
        const token = u.searchParams.get('token');
        if (token && token === cronSecret) isCron = true;
      } catch {}
    }
    if (isCron) return true;

    // Fallback: allow admin cookie access as manual trigger (no import to avoid coupling)
    const { verifySessionToken, ADMIN_SESSION_COOKIE } = await import('@/lib/auth/adminSession');
    const token = parseCookie(req.headers.get('cookie')).get(ADMIN_SESSION_COOKIE);
    if (!token) return false;
    return await verifySessionToken(token);
  } catch {
    return false;
  }
}

function isCronAuthorized(req: Request): boolean {
  const cronSecretHeader = req.headers.get('x-cron-secret') || req.headers.get('x-vercel-signature');
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const isAuthBearer = Boolean(cronSecret && authHeader.startsWith('Bearer ') && authHeader.slice(7) === cronSecret);
  let isCron = Boolean(cronSecret && cronSecretHeader && cronSecretHeader === cronSecret) || isAuthBearer;
  if (!isCron && cronSecret) {
    try {
      const u = new URL(req.url);
      const token = u.searchParams.get('token');
      if (token && token === cronSecret) isCron = true;
    } catch {}
  }
  return Boolean(isCron);
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get('host') || '';
  if (!host) return false;
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const http = `http://${host}`;
  const https = `https://${host}`;
  if (origin === http || origin === https) return true;
  if (referer.startsWith(http + '/')) return true;
  if (referer.startsWith(https + '/')) return true;
  return false;
}

function hoursAgoISO(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function roundToWindowStartMinutes(durationMin: number) {
  const ms = durationMin * 60 * 1000;
  return Math.floor(Date.now() / ms) * ms;
}

type PersonRow = {
  id: string;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  campaign_source?: string | null;
  campaign_variant?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

// Check if a lead needs manual matching based on match count
// A lead needs action if they're verified (status=new) but have zero matches
async function getLeadsWithoutMatches(leadIds: string[]): Promise<Set<string>> {
  if (leadIds.length === 0) return new Set();
  
  // Get all patient IDs that have at least one match
  const { data } = await supabaseServer
    .from('matches')
    .select('patient_id')
    .in('patient_id', leadIds);
  
  const hasMatches = new Set((data || []).map(m => m.patient_id));
  
  // Return IDs that have NO matches
  return new Set(leadIds.filter(id => !hasMatches.has(id)));
}

function get(obj: unknown, path: string): unknown {
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

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ua = req.headers.get('user-agent') || undefined;

  try {
    const okCron = isCronAuthorized(req);
    let isAdmin = false;
    try {
      const { verifySessionToken, ADMIN_SESSION_COOKIE } = await import('@/lib/auth/adminSession');
      const token = parseCookie(req.headers.get('cookie')).get(ADMIN_SESSION_COOKIE);
      isAdmin = token ? await verifySessionToken(token) : false;
    } catch {}
    if (!okCron && !isAdmin) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (isAdmin && !okCron && !sameOrigin(req)) return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const hoursRaw = url.searchParams.get('hours') || '3';
    let hours = Number.parseInt(hoursRaw, 10);
    if (!Number.isFinite(hours) || hours <= 0) hours = 3;
    if (hours > 24) hours = 24; // cap

    const sinceIso = hoursAgoISO(hours);

    // Fetch patient leads that are actionable (status=new) in the window
    const selectCols = 'id,status,metadata,campaign_source,campaign_variant,created_at';

    let rows: PersonRow[] = [];
    {
      const res = await supabaseServer
        .from('people')
        .select(selectCols)
        .eq('type', 'patient')
        .eq('status', 'new')
        // Consider created_at or key metadata timestamps within the window
        .or(
          [
            `created_at.gt.${sinceIso}`,
            `metadata->>email_confirmed_at.gt.${sinceIso}`,
            `metadata->>confirmed_at.gt.${sinceIso}`,
            `metadata->>form_completed_at.gt.${sinceIso}`,
          ].join(',')
        )
        .order('created_at', { ascending: true })
        .limit(500);

      if (res.error) {
        const msg = (res.error as { message?: string }).message || '';
        // Fallback for schema mismatches (e.g., production doesn't have people.updated_at or campaign columns)
        if (msg.includes('schema cache') || msg.includes('column') || msg.includes('missing')) {
          const res2 = await supabaseServer
            .from('people')
            .select('id,status,metadata,created_at')
            .eq('type', 'patient')
            .eq('status', 'new')
            .or(
              [
                `created_at.gt.${sinceIso}`,
                `metadata->>email_confirmed_at.gt.${sinceIso}`,
                `metadata->>confirmed_at.gt.${sinceIso}`,
                `metadata->>form_completed_at.gt.${sinceIso}`,
              ].join(',')
            )
            .order('created_at', { ascending: true })
            .limit(500);
          if (res2.error) {
            await logError('admin.api.alerts.new_leads', res2.error, { stage: 'fetch_people_fallback_created_at', hours }, ip, ua);
            return NextResponse.json({ data: null, error: 'Failed to fetch leads' }, { status: 500 });
          }
          rows = (res2.data as PersonRow[] | null) || [];
        } else {
          await logError('admin.api.alerts.new_leads', res.error, { stage: 'fetch_people', hours }, ip, ua);
          return NextResponse.json({ data: null, error: 'Failed to fetch leads' }, { status: 500 });
        }
      } else {
        rows = (res.data as PersonRow[] | null) || [];
      }
    }

    // Exclude test leads
    rows = rows.filter((r) => {
      const meta = (r.metadata || {}) as Record<string, unknown>;
      return !(meta && typeof meta === 'object' && (meta as { is_test?: unknown }).is_test === true);
    });

    // Filter to only include leads that need manual matching (verified but no matches yet)
    const leadIds = rows.map(r => r.id);
    const leadsNeedingMatches = await getLeadsWithoutMatches(leadIds);
    const actionableRows = rows.filter(r => leadsNeedingMatches.has(r.id));
    const autoMatchedCount = rows.length - actionableRows.length;

    if (actionableRows.length === 0) {
      // If there are auto-matched leads, still return info but don't send email
      if (autoMatchedCount > 0) {
        return NextResponse.json({ 
          data: { sent: false, reason: 'no_actionable_leads', auto_matched_count: autoMatchedCount }, 
          error: null 
        }, { status: 200 });
      }
      return NextResponse.json({ data: { sent: false, reason: 'no_leads' }, error: null }, { status: 200 });
    }
    
    // Use actionableRows for the rest of the notification
    rows = actionableRows;

    // De-dupe per window using an internal event marker
    const windowStart = roundToWindowStartMinutes(hours * 60);
    const digestKey = `new_leads_${hours}h_${windowStart}`;
    try {
      const { data: prior } = await supabaseServer
        .from('events')
        .select('id')
        .eq('type', 'internal_alert_sent')
        .contains('properties', { kind: 'new_leads_digest', digest_key: digestKey })
        .limit(1);
      if (Array.isArray(prior) && prior.length > 0) {
        return NextResponse.json({ data: { sent: false, reason: 'already_sent' }, error: null }, { status: 200 });
      }
    } catch {}

    const to = (process.env.LEADS_NOTIFY_EMAIL || '').trim();
    if (!to) {
      await logError('admin.api.alerts.new_leads', new Error('Missing LEADS_NOTIFY_EMAIL'), { stage: 'send', hours }, ip, ua);
      return NextResponse.json({ data: { sent: false, reason: 'missing_recipient' }, error: null }, { status: 200 });
    }

    const total = rows.length;

    // Build a PII-free summary
    const lines: string[] = [];
    lines.push(`Window: last ${hours} hours`);
    lines.push(`Leads requiring manual matching: ${total}`);
    if (autoMatchedCount > 0) {
      lines.push(`Auto-matched leads (no action needed): ${autoMatchedCount}`);
    }
    lines.push('');
    lines.push('Leads requiring action:');

    for (const r of rows) {
      const meta = (r.metadata || {}) as Record<string, unknown>;
      const city = (get(meta, 'city') as string) || 'unknown';
      const sp = (get(meta, 'session_preference') as string) || '';
      const spArr = (get(meta, 'session_preferences') as unknown[]) || [];
      const pref = sp ? sp : (Array.isArray(spArr) && spArr.length > 1 ? 'both' : (Array.isArray(spArr) && spArr[0] ? String(spArr[0]) : ''));
      const src = r.campaign_source || 'unknown';
      const v = r.campaign_variant || '';
      const ts = r.updated_at || r.created_at || '';
      const when = ts ? new Date(ts).toISOString() : '';
      lines.push(`- ${when} | ${r.id} | ${city}${pref ? ` | pref: ${pref}` : ''} | src: ${src}${v ? ` (${v})` : ''}`);
    }

    lines.push('');
    lines.push('Next steps:');
    lines.push('- Review and match: /admin/leads');

    // Subject clarifies these are verified leads with no matches yet
    const subject = `[KH] ${total} lead${total !== 1 ? 's' : ''} requiring manual matching (${hours}h)`;

    try {
      await sendEmail({ to, subject, text: lines.join('\n'), context: { kind: 'new_leads_digest', digest_key: digestKey, hours, total } });
      void track({ type: 'internal_alert_sent', level: 'info', source: 'admin.api.alerts.new_leads', props: { kind: 'new_leads_digest', digest_key: digestKey, hours, total }, ip, ua });
      return NextResponse.json({ data: { sent: true, total }, error: null }, { status: 200 });
    } catch (e) {
      await logError('admin.api.alerts.new_leads', e, { stage: 'send_email', hours, total }, ip, ua);
      return NextResponse.json({ data: null, error: 'Failed to send email' }, { status: 500 });
    }
  } catch (e) {
    await logError('admin.api.alerts.new_leads', e, { stage: 'exception' });
    return NextResponse.json({ data: null, error: 'Unexpected error' }, { status: 500 });
  }
}
