import { NextRequest, NextResponse } from 'next/server';
import { GoogleAdsApi } from 'google-ads-api';
import { createClient } from '@supabase/supabase-js';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function toYyyymmdd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function eurosFromMicros(micros?: number): number {
  if (!micros || Number.isNaN(micros)) return 0;
  return Math.round((micros / 1_000_000) * 100) / 100;
}

interface SpendRow {
  date: string;
  source: string;
  campaign_name: string | null;
  spend_eur: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

async function fetchGoogleAdsSpend(since: string, until: string): Promise<SpendRow[]> {
  const api = new GoogleAdsApi({
    client_id: requireEnv('GOOGLE_ADS_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_ADS_CLIENT_SECRET'),
    developer_token: requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
  });

  const customer = api.Customer({
    customer_id: requireEnv('GOOGLE_ADS_CUSTOMER_ID'),
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    refresh_token: requireEnv('GOOGLE_ADS_REFRESH_TOKEN'),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await customer.query(`
    SELECT
      segments.date,
      campaign.name,
      metrics.cost_micros,
      metrics.clicks,
      metrics.impressions,
      metrics.conversions
    FROM campaign
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
  `);

  const results: SpendRow[] = [];
  for (const r of rows) {
    const date = (r.segments?.date || r['segments.date']) as string | undefined;
    const campaignName = (r.campaign?.name || r['campaign.name'] || null) as string | null;
    const costMicros = Number(r.metrics?.cost_micros || r['metrics.cost_micros'] || 0);
    const clicks = Number(r.metrics?.clicks || r['metrics.clicks'] || 0);
    const impressions = Number(r.metrics?.impressions || r['metrics.impressions'] || 0);
    const conversions = Number(r.metrics?.conversions || r['metrics.conversions'] || 0);

    if (date && costMicros > 0) {
      results.push({
        date,
        source: 'google_ads',
        campaign_name: campaignName,
        spend_eur: eurosFromMicros(costMicros),
        clicks,
        impressions,
        conversions,
      });
    }
  }

  return results;
}

/**
 * GET /api/admin/ads/sync-spend
 * Syncs Google Ads spend to ad_spend_log table
 * 
 * Query params:
 *   days: number of days to sync (default: 1 = yesterday only)
 */
async function handler(req: NextRequest) {
  // Verify cron auth
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '1', 10);

    // Calculate date range
    const until = new Date();
    until.setUTCDate(until.getUTCDate() - 1); // Yesterday

    const since = new Date(until);
    since.setUTCDate(since.getUTCDate() - days + 1);

    const sinceStr = toYyyymmdd(since);
    const untilStr = toYyyymmdd(until);

    console.log(`[sync-spend] Fetching ${sinceStr} → ${untilStr}`);

    const rows = await fetchGoogleAdsSpend(sinceStr, untilStr);
    const totalSpend = rows.reduce((sum, r) => sum + r.spend_eur, 0);

    console.log(`[sync-spend] Found ${rows.length} rows, total €${totalSpend.toFixed(2)}`);

    if (rows.length === 0) {
      return NextResponse.json({ synced: 0, totalSpend: 0, message: 'No spend data found' });
    }

    // Upsert to Supabase
    const supabase = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    );

    const { error } = await supabase
      .from('ad_spend_log')
      .upsert(rows, { onConflict: 'date,source,campaign_name' });

    if (error) {
      console.error('[sync-spend] Upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[sync-spend] ✅ Synced ${rows.length} rows`);

    return NextResponse.json({
      synced: rows.length,
      totalSpend: Math.round(totalSpend * 100) / 100,
      dateRange: `${sinceStr} to ${untilStr}`,
    });
  } catch (e) {
    console.error('[sync-spend] Error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;
