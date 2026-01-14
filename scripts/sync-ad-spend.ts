#!/usr/bin/env npx tsx
/**
 * Syncs Google Ads spend to Supabase ad_spend_log table
 * 
 * Usage:
 *   npx tsx scripts/sync-ad-spend.ts              # Sync yesterday
 *   npx tsx scripts/sync-ad-spend.ts --days=7     # Sync last 7 days
 *   npx tsx scripts/sync-ad-spend.ts --dry-run    # Preview without inserting
 * 
 * Called nightly via Vercel cron: GET /api/cron/sync-ad-spend
 */

import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { GoogleAdsApi } from 'google-ads-api';
import { createClient } from '@supabase/supabase-js';

// Load env
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config();
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), 'true'];
    args[k] = v === 'true' ? true : v === 'false' ? false : v;
  }
  return args as { days?: string; 'dry-run'?: boolean };
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

  // Query daily spend by campaign
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
    const date = r.segments?.date || r['segments.date'];
    const campaignName = r.campaign?.name || r['campaign.name'] || null;
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

async function upsertToSupabase(rows: SpendRow[], dryRun: boolean): Promise<number> {
  if (dryRun) {
    console.log('\n[DRY RUN] Would upsert:', rows.length, 'rows');
    for (const r of rows.slice(0, 10)) {
      console.log(`  ${r.date} | ${r.campaign_name?.slice(0, 40)} | €${r.spend_eur}`);
    }
    if (rows.length > 10) console.log(`  ... and ${rows.length - 10} more`);
    return rows.length;
  }

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  );

  // Upsert in batches
  const batchSize = 100;
  let upserted = 0;
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('ad_spend_log')
      .upsert(batch, { onConflict: 'date,source,campaign_name' });

    if (error) {
      console.error('Upsert error:', error);
      throw error;
    }
    upserted += batch.length;
  }

  return upserted;
}

export async function syncAdSpend(days: number = 1, dryRun: boolean = false): Promise<{ synced: number; totalSpend: number }> {
  // Calculate date range (yesterday back N days)
  const until = new Date();
  until.setUTCDate(until.getUTCDate() - 1); // Yesterday
  
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - days + 1);

  const sinceStr = toYyyymmdd(since);
  const untilStr = toYyyymmdd(until);

  console.log(`\n📊 Syncing Google Ads spend: ${sinceStr} → ${untilStr}`);

  const rows = await fetchGoogleAdsSpend(sinceStr, untilStr);
  const totalSpend = rows.reduce((sum, r) => sum + r.spend_eur, 0);
  
  console.log(`Found ${rows.length} campaign-day records, total: €${totalSpend.toFixed(2)}`);

  const synced = await upsertToSupabase(rows, dryRun);
  
  console.log(`✅ ${dryRun ? 'Would sync' : 'Synced'} ${synced} rows to ad_spend_log`);
  
  return { synced, totalSpend };
}

// CLI
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const days = args.days ? parseInt(args.days, 10) : 1;
  const dryRun = args['dry-run'] === true;

  syncAdSpend(days, dryRun)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('Fatal:', e);
      process.exit(1);
    });
}
