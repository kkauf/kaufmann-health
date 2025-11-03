#!/usr/bin/env tsx
/**
 * Export keyword and RSA asset performance to CSV.
 *
 * Produces (all filenames prefixed with export date YYYYMMDD_):
 *  - YYYYMMDD_keyword_raw.csv           Raw keyword clicks/impressions/cost per campaign/ad group/keyword/match_type
 *  - YYYYMMDD_keyword_perf.csv          Keyword performance with CTR/CPC/Conversions/CPL
 *  - YYYYMMDD_asset_headline_perf.csv   Account-level HEADLINE asset performance with text (for context)
 *  - YYYYMMDD_asset_description_perf.csv Account-level DESCRIPTION asset performance with text
 *  - YYYYMMDD_asset_sitelink_perf.csv   Account-level SITELINK asset performance with link text
 *
 * Defaults:
 *  - since: 2025-09-01 (account time zone)
 *  - until: yesterday (excludeToday=true)
 *  - channel: SEARCH campaigns only (includes both Google Search and Search Partners; no network filter)
 *  - include ALL statuses (no filtering on enabled/paused/removed)
 *
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleAdsApi } from 'google-ads-api';

// Load env from .env.local (project root) first, then fallback to .env
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

function toYyyymmdd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function toYyyymmddCompact(d: Date): string {
  return toYyyymmdd(d).replace(/-/g, '');
}

function eurosFromMicros(micros?: number): number {
  if (!micros || Number.isNaN(micros)) return 0;
  return Math.round((micros / 1_000_000) * 100) / 100; // 2 decimals
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), 'true'];
      args[k] = v === 'true' ? true : v === 'false' ? false : v;
    }
  }
  return args as {
    since?: string | boolean;
    until?: string | boolean;
    excludeToday?: string | boolean;
    nameLike?: string | boolean;
    outDir?: string | boolean;
  };
}

function csvEscape(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function normalizeDateWindow(args: ReturnType<typeof parseArgs>) {
  const DEFAULT_SINCE = '2025-09-01';
  const excludeToday = (args.excludeToday ?? true) === true || String(args.excludeToday) === 'true';

  let since = typeof args.since === 'string' ? args.since : DEFAULT_SINCE;
  let until: string;
  if (typeof args.until === 'string') {
    until = args.until;
  } else {
    const now = new Date();
    if (excludeToday) now.setUTCDate(now.getUTCDate() - 1);
    until = toYyyymmdd(now);
  }
  return { since, until, excludeToday };
}

function escapeLike(str: string): string {
  return str.replace(/'/g, "''");
}

// Price-specific types removed

function getField<T = any>(obj: any, paths: string[]): T | undefined {
  for (const p of paths) {
    const parts = p.split('.');
    let cur: any = obj;
    for (const part of parts) {
      if (!cur) break;
      cur = cur[part];
    }
    if (cur !== undefined) return cur as T;
  }
  return undefined;
}

function extractAssetResourceNamesFromCombination(row: any): string[] {
  // Supports both legacy combo fields and the current served_assets list
  const candidates: string[] = [];

  // Preferred: served_assets
  const served = getField<any>(row, [
    'ad_group_ad_asset_combination_view.served_assets',
    'adGroupAdAssetCombinationView.servedAssets',
    'served_assets',
    'servedAssets',
  ]);
  if (Array.isArray(served)) {
    for (const s of served) {
      const rn = s?.asset || s?.asset_resource_name || s?.resource_name;
      if (typeof rn === 'string') candidates.push(rn);
    }
  }

  // Fallback: asset_combination shapes
  const combo = getField<any>(row, [
    'ad_group_ad_asset_combination_view.asset_combination',
    'adGroupAdAssetCombinationView.assetCombination',
    'asset_combination',
  ]);
  if (Array.isArray(combo?.assets)) {
    for (const a of combo.assets) {
      const rn = a?.asset || a?.asset_resource_name || a?.resource_name;
      if (typeof rn === 'string') candidates.push(rn);
    }
  } else if (Array.isArray(combo)) {
    for (const a of combo) {
      const rn = a?.asset || a?.asset_resource_name || a?.resource_name;
      if (typeof rn === 'string') candidates.push(rn);
    }
  }

  if (candidates.length === 0) {
    // Last resort: scan the entire row JSON for asset resource names
    const asString = JSON.stringify(row);
    const re = /customers\/(?:\d+)\/assets\/(?:\d+)/g;
    const matches = asString.match(re) || [];
    for (const m of matches) candidates.push(m);
  }
  return Array.from(new Set(candidates));
}

async function queryAllAssets(customer: any): Promise<{ assets: any[]; textByResource: Map<string, string> }> {
  const rows: any[] = await customer.query(`
    SELECT
      asset.resource_name,
      asset.type,
      asset.name,
      asset.text_asset.text,
      asset.sitelink_asset.link_text
    FROM asset
  `);
  const assets: any[] = [];
  const textByResource = new Map<string, string>();
  for (const r of rows) {
    const rn = getField<string>(r, ['asset.resource_name', 'asset.resourceName']);
    const type = getField<string>(r, ['asset.type', 'asset.type_']);
    const text = getField<string>(r, ['asset.text_asset.text', 'asset.textAsset.text']);
    const sitelink = getField<string>(r, ['asset.sitelink_asset.link_text', 'asset.sitelinkAsset.linkText']);
    if (rn) {
      // Prefer text asset content; fallback to sitelink text for SITELINK assets
      const chosen = typeof text === 'string' && text.length > 0 ? text : (typeof sitelink === 'string' ? sitelink : '');
      if (chosen) textByResource.set(rn, chosen);
      // GA v21 returns asset.type = 'TEXT' for RSA text assets. Older code used 'TEXT_ASSET'. Accept both.
      if ((type === 'TEXT' || type === 'TEXT_ASSET' || type === undefined || type === null) && typeof text === 'string' && text.length > 0) {
        assets.push({ resourceName: rn, text });
      }
    }
  }
  return { assets, textByResource };
}

function writeCsv(outPath: string, headers: string[], rows: Array<Array<any>>) {
  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(','));
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('  ✓ Wrote', outPath, `(${rows.length} rows)`);
}

async function exportData() {
  const args = parseArgs(process.argv.slice(2));
  const { since, until } = normalizeDateWindow(args);
  const nameLike = typeof args.nameLike === 'string' ? args.nameLike : undefined;
  const outDir = typeof args.outDir === 'string' ? args.outDir : path.join('google_ads_api_scripts', 'private', 'exports');
  const exportDatePrefix = (typeof args.until === 'string' ? args.until : toYyyymmdd(new Date())).replace(/-/g, '');

  console.log('=== Export Keyword & Asset Performance ===');
  console.log('Params:', { since, until, nameLike: nameLike || '(all campaigns)', outDir });

  ensureDir(outDir);

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

  // 1) Keyword performance (raw) and summary
  console.log('\n[1/3] Querying keyword performance…');
  const nameClause = nameLike ? ` AND campaign.name LIKE '%${escapeLike(nameLike)}%'` : '';
  const keywordRows: any[] = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions
    FROM keyword_view
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
  `);

  // Write CSVs
  console.log('\nWriting CSVs…');
  // CSV 1: keyword_raw.csv
  const keywordRawPath = path.join(outDir, `${exportDatePrefix}_keyword_raw.csv`);
  const kwRawHeaders = [
    'campaign_id', 'campaign_name', 'ad_group_id', 'ad_group_name',
    'keyword_id', 'keyword_text', 'match_type', 'status',
    'clicks', 'impressions', 'cost_eur', 'date_range'
  ];
  const kwRawRows: any[] = [];

  // price-share logic removed

  for (const r of keywordRows) {
    const campaignId = String(getField<any>(r, ['campaign.id']));
    const campaignName = String(getField<any>(r, ['campaign.name']) || '');
    const adGroupId = String(getField<any>(r, ['ad_group.id', 'adGroup.id']));
    const adGroupName = String(getField<any>(r, ['ad_group.name', 'adGroup.name']) || '');
    const keywordId = String(getField<any>(r, ['ad_group_criterion.criterion_id']));
    const keywordText = String(getField<any>(r, ['ad_group_criterion.keyword.text']) || '');
    const matchType = String(getField<any>(r, ['ad_group_criterion.keyword.match_type']) || '');
    const status = String(getField<any>(r, ['ad_group_criterion.status']) || '');
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    const impressions = Number(getField<any>(r, ['metrics.impressions']) || 0);
    const costMicros = Number(getField<any>(r, ['metrics.cost_micros']) || 0);

    kwRawRows.push([
      campaignId, campaignName, adGroupId, adGroupName,
      keywordId, keywordText, matchType, status,
      clicks, impressions, eurosFromMicros(costMicros), `${since}..${until}`
    ]);
  }
  writeCsv(keywordRawPath, kwRawHeaders, kwRawRows);

  // CSV 1b: keyword_perf.csv (CTR/CPC/Conversions/CPL)
  const keywordPerfPath = path.join(outDir, `${exportDatePrefix}_keyword_perf.csv`);
  const kwPerfHeaders = [
    'campaign_id', 'campaign_name', 'ad_group_id', 'ad_group_name',
    'keyword_id', 'keyword_text', 'match_type', 'status',
    'clicks', 'impressions', 'ctr', 'cost_eur', 'avg_cpc_eur', 'conversions', 'cpl_eur', 'date_range'
  ];
  const kwPerfRows: any[] = [];
  for (const r of keywordRows) {
    const campaignId = String(getField<any>(r, ['campaign.id']));
    const campaignName = String(getField<any>(r, ['campaign.name']) || '');
    const adGroupId = String(getField<any>(r, ['ad_group.id', 'adGroup.id']));
    const adGroupName = String(getField<any>(r, ['ad_group.name', 'adGroup.name']) || '');
    const keywordId = String(getField<any>(r, ['ad_group_criterion.criterion_id']));
    const keywordText = String(getField<any>(r, ['ad_group_criterion.keyword.text']) || '');
    const matchType = String(getField<any>(r, ['ad_group_criterion.keyword.match_type']) || '');
    const status = String(getField<any>(r, ['ad_group_criterion.status']) || '');
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    const impressions = Number(getField<any>(r, ['metrics.impressions']) || 0);
    const costMicros = Number(getField<any>(r, ['metrics.cost_micros']) || 0);
    const conversions = Number(getField<any>(r, ['metrics.conversions']) || 0);
    const cost = eurosFromMicros(costMicros);
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0; // percent
    const cpc = clicks > 0 ? Math.round((cost / clicks) * 100) / 100 : 0;
    const cpl = conversions > 0 ? Math.round((cost / conversions) * 100) / 100 : '';
    kwPerfRows.push([
      campaignId, campaignName, adGroupId, adGroupName,
      keywordId, keywordText, matchType, status,
      clicks, impressions, ctr, cost, cpc, conversions, cpl, `${since}..${until}`
    ]);
  }
  writeCsv(keywordPerfPath, kwPerfHeaders, kwPerfRows);

  // Price-share and adjusted keyword metrics removed

  // CSV 5: asset_headline_perf.csv (context)
  const assetPerfRows: any[] = await customer.query(`
    SELECT
      ad_group_ad_asset_view.field_type,
      ad_group_ad_asset_view.asset,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM ad_group_ad_asset_view
    WHERE ad_group_ad_asset_view.field_type = 'HEADLINE'
      AND campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
  `);

  // Need text lookup for assets
  const allAssets = await queryAllAssets(customer);

  const assetPerfPath = path.join(outDir, `${exportDatePrefix}_asset_headline_perf.csv`);
  const assetHeaders = ['asset_resource_name', 'field_type', 'text', 'clicks', 'impressions', 'cost_eur', 'date_range'];
  const assetRows: any[] = [];
  for (const r of assetPerfRows) {
    const fieldType = String(getField<any>(r, ['ad_group_ad_asset_view.field_type', 'adGroupAdAssetView.fieldType']) || '');
    const rn = String(getField<any>(r, ['ad_group_ad_asset_view.asset', 'adGroupAdAssetView.asset']) || '');
    if (!rn) continue;
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    const impressions = Number(getField<any>(r, ['metrics.impressions']) || 0);
    const costMicros = Number(getField<any>(r, ['metrics.cost_micros']) || 0);
    const text = allAssets.textByResource.get(rn) || '';
    assetRows.push([rn, fieldType, text, clicks, impressions, eurosFromMicros(costMicros), `${since}..${until}`]);
  }
  writeCsv(assetPerfPath, assetHeaders, assetRows);

  console.log('\n[3/3] Asset performance (DESCRIPTION & SITELINK)…');
  // CSV 3: asset_description_perf.csv
  const descRows: any[] = await customer.query(`
    SELECT
      ad_group_ad_asset_view.field_type,
      ad_group_ad_asset_view.asset,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM ad_group_ad_asset_view
    WHERE ad_group_ad_asset_view.field_type = 'DESCRIPTION'
      AND campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
  `);
  const assetDescPath = path.join(outDir, `${exportDatePrefix}_asset_description_perf.csv`);
  const assetDescRows: any[] = [];
  for (const r of descRows) {
    const rn = String(getField<any>(r, ['ad_group_ad_asset_view.asset', 'adGroupAdAssetView.asset']) || '');
    if (!rn) continue;
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    const impressions = Number(getField<any>(r, ['metrics.impressions']) || 0);
    const costMicros = Number(getField<any>(r, ['metrics.cost_micros']) || 0);
    const text = allAssets.textByResource.get(rn) || '';
    assetDescRows.push([rn, 'DESCRIPTION', text, clicks, impressions, eurosFromMicros(costMicros), `${since}..${until}`]);
  }
  writeCsv(assetDescPath, assetHeaders, assetDescRows);

  // CSV 4: asset_sitelink_perf.csv
  const sitelinkRows: any[] = await customer.query(`
    SELECT
      ad_group_ad_asset_view.field_type,
      ad_group_ad_asset_view.asset,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM ad_group_ad_asset_view
    WHERE ad_group_ad_asset_view.field_type = 'SITELINK'
      AND campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
  `);
  const assetSitelinkPath = path.join(outDir, `${exportDatePrefix}_asset_sitelink_perf.csv`);
  const assetSitelinkRows: any[] = [];
  for (const r of sitelinkRows) {
    const rn = String(getField<any>(r, ['ad_group_ad_asset_view.asset', 'adGroupAdAssetView.asset']) || '');
    if (!rn) continue;
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    const impressions = Number(getField<any>(r, ['metrics.impressions']) || 0);
    const costMicros = Number(getField<any>(r, ['metrics.cost_micros']) || 0);
    const text = allAssets.textByResource.get(rn) || '';
    assetSitelinkRows.push([rn, 'SITELINK', text, clicks, impressions, eurosFromMicros(costMicros), `${since}..${until}`]);
  }
  writeCsv(assetSitelinkPath, assetHeaders, assetSitelinkRows);

  console.log('\n✅ Export complete. Files:', {
    keyword_raw: keywordRawPath,
    keyword_perf: keywordPerfPath,
    asset_headline_perf: assetPerfPath,
    asset_description_perf: assetDescPath,
    asset_sitelink_perf: assetSitelinkPath,
  });
}

exportData().catch((e) => {
  console.error('Fatal error in export-keyword-asset-performance:', e);
  process.exit(1);
});
