#!/usr/bin/env tsx
/**
 * Unified Google Ads exporter
 *
 * Modules (comma-separated via --modules):
 *  - keywords: keyword_raw.csv + keyword_perf.csv
 *  - assets: asset_headline_perf.csv + asset_description_perf.csv + asset_sitelink_perf.csv
 *  - search_terms: search_terms.csv
 *  - adgroups: adgroup_perf.csv
 *  - asset_labels: asset_labels.csv
 *  - quality_scores: quality_scores.csv (keyword-level)
 *
 * Defaults:
 *  - modules: keywords,assets,asset_labels
 *  - since: 2025-09-01
 *  - until: yesterday (excludeToday=true)
 *  - outDir: google_ads_api_scripts/private/exports
 *  - filter: SEARCH channel; include all statuses
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleAdsApi } from 'google-ads-api';

// Load env from .env.local first, then fallback to .env
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
    const val = v === 'true' ? true : v === 'false' ? false : v;
    args[k] = val;
  }
  return args as {
    modules?: string | boolean;
    since?: string | boolean;
    until?: string | boolean;
    excludeToday?: string | boolean;
    nameLike?: string | boolean;
    outDir?: string | boolean;
  };
}

function toYyyymmdd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function eurosFromMicros(micros?: number): number {
  if (!micros || Number.isNaN(micros)) return 0;
  return Math.round((micros / 1_000_000) * 100) / 100;
}

function csvEscape(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function writeCsv(outPath: string, headers: string[], rows: Array<Array<any>>) {
  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(','));
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('  ✓ Wrote', outPath, `(${rows.length} rows)`);
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function escapeLike(str: string): string {
  return str.replace(/'/g, "''");
}

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

async function queryAllAssets(customer: any): Promise<{ assets: any[]; textByResource: Map<string, string> }> {
  const rows: any[] = await customer.query(`
    SELECT
      asset.resource_name,
      asset.type,
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
      const chosen = typeof text === 'string' && text.length > 0 ? text : (typeof sitelink === 'string' ? sitelink : '');
      if (chosen) textByResource.set(rn, chosen);
      if ((type === 'TEXT' || type === 'TEXT_ASSET' || type === undefined || type === null) && typeof text === 'string' && text.length > 0) {
        assets.push({ resourceName: rn, text });
      }
    }
  }
  return { assets, textByResource };
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
  return { since, until };
}

async function exportKeywords(customer: any, outDir: string, exportDatePrefix: string, since: string, until: string, nameLike?: string) {
  console.log('\n[1/5] Keywords…');
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

  const keywordRawPath = path.join(outDir, `${exportDatePrefix}_keyword_raw.csv`);
  const kwRawHeaders = [
    'campaign_id','campaign_name','ad_group_id','ad_group_name','keyword_id','keyword_text','match_type','status','clicks','impressions','cost_eur','date_range'
  ];
  const kwRawRows: any[] = [];
  for (const r of keywordRows) {
    const campaignId = String(getField<any>(r, ['campaign.id']));
    const campaignName = String(getField<any>(r, ['campaign.name']) || '');
    const adGroupId = String(getField<any>(r, ['ad_group.id','adGroup.id']));
    const adGroupName = String(getField<any>(r, ['ad_group.name','adGroup.name']) || '');
    const keywordId = String(getField<any>(r, ['ad_group_criterion.criterion_id']));
    const keywordText = String(getField<any>(r, ['ad_group_criterion.keyword.text']) || '');
    const matchType = String(getField<any>(r, ['ad_group_criterion.keyword.match_type']) || '');
    const status = String(getField<any>(r, ['ad_group_criterion.status']) || '');
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    const impressions = Number(getField<any>(r, ['metrics.impressions']) || 0);
    const costMicros = Number(getField<any>(r, ['metrics.cost_micros']) || 0);
    kwRawRows.push([
      campaignId,campaignName,adGroupId,adGroupName,keywordId,keywordText,matchType,status,clicks,impressions,eurosFromMicros(costMicros),`${since}..${until}`
    ]);
  }
  writeCsv(keywordRawPath, kwRawHeaders, kwRawRows);

  const keywordPerfPath = path.join(outDir, `${exportDatePrefix}_keyword_perf.csv`);
  const kwPerfHeaders = [
    'campaign_id','campaign_name','ad_group_id','ad_group_name','keyword_id','keyword_text','match_type','status','clicks','impressions','ctr','cost_eur','avg_cpc_eur','conversions','cpl_eur','date_range'
  ];
  const kwPerfRows: any[] = [];
  for (const r of keywordRows) {
    const campaignId = String(getField<any>(r, ['campaign.id']));
    const campaignName = String(getField<any>(r, ['campaign.name']) || '');
    const adGroupId = String(getField<any>(r, ['ad_group.id','adGroup.id']));
    const adGroupName = String(getField<any>(r, ['ad_group.name','adGroup.name']) || '');
    const keywordId = String(getField<any>(r, ['ad_group_criterion.criterion_id']));
    const keywordText = String(getField<any>(r, ['ad_group_criterion.keyword.text']) || '');
    const matchType = String(getField<any>(r, ['ad_group_criterion.keyword.match_type']) || '');
    const status = String(getField<any>(r, ['ad_group_criterion.status']) || '');
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    const impressions = Number(getField<any>(r, ['metrics.impressions']) || 0);
    const costMicros = Number(getField<any>(r, ['metrics.cost_micros']) || 0);
    const conversions = Number(getField<any>(r, ['metrics.conversions']) || 0);
    const cost = eurosFromMicros(costMicros);
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
    const cpc = clicks > 0 ? Math.round((cost / clicks) * 100) / 100 : 0;
    const cpl = conversions > 0 ? Math.round((cost / conversions) * 100) / 100 : '';
    kwPerfRows.push([
      campaignId,campaignName,adGroupId,adGroupName,keywordId,keywordText,matchType,status,clicks,impressions,ctr,cost,cpc,conversions,cpl,`${since}..${until}`
    ]);
  }
  writeCsv(keywordPerfPath, kwPerfHeaders, kwPerfRows);
}

async function exportAssets(customer: any, outDir: string, exportDatePrefix: string, since: string, until: string, nameLike?: string) {
  console.log('\n[2/5] Assets (HEADLINE/DESCRIPTION/SITELINK)…');
  const nameClause = nameLike ? ` AND campaign.name LIKE '%${escapeLike(nameLike)}%'` : '';

  const allAssets = await queryAllAssets(customer);

  // HEADLINE
  const headlineRows: any[] = await customer.query(`
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
  const headlinePath = path.join(outDir, `${exportDatePrefix}_asset_headline_perf.csv`);
  const assetHeaders = ['asset_resource_name','field_type','text','clicks','impressions','cost_eur','date_range'];
  const headlineOut: any[] = [];
  for (const r of headlineRows) {
    const rn = String(getField<any>(r, ['ad_group_ad_asset_view.asset','adGroupAdAssetView.asset']) || '');
    if (!rn) continue;
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    const impressions = Number(getField<any>(r, ['metrics.impressions']) || 0);
    const costMicros = Number(getField<any>(r, ['metrics.cost_micros']) || 0);
    const text = allAssets.textByResource.get(rn) || '';
    headlineOut.push([rn,'HEADLINE',text,clicks,impressions,eurosFromMicros(costMicros),`${since}..${until}`]);
  }
  writeCsv(headlinePath, assetHeaders, headlineOut);

  // DESCRIPTION
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
  const descPath = path.join(outDir, `${exportDatePrefix}_asset_description_perf.csv`);
  const descOut: any[] = [];
  for (const r of descRows) {
    const rn = String(getField<any>(r, ['ad_group_ad_asset_view.asset','adGroupAdAssetView.asset']) || '');
    if (!rn) continue;
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    const impressions = Number(getField<any>(r, ['metrics.impressions']) || 0);
    const costMicros = Number(getField<any>(r, ['metrics.cost_micros']) || 0);
    const text = allAssets.textByResource.get(rn) || '';
    descOut.push([rn,'DESCRIPTION',text,clicks,impressions,eurosFromMicros(costMicros),`${since}..${until}`]);
  }
  writeCsv(descPath, assetHeaders, descOut);

  // SITELINK
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
  const sitelinkPath = path.join(outDir, `${exportDatePrefix}_asset_sitelink_perf.csv`);
  const sitelinkOut: any[] = [];
  for (const r of sitelinkRows) {
    const rn = String(getField<any>(r, ['ad_group_ad_asset_view.asset','adGroupAdAssetView.asset']) || '');
    if (!rn) continue;
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    const impressions = Number(getField<any>(r, ['metrics.impressions']) || 0);
    const costMicros = Number(getField<any>(r, ['metrics.cost_micros']) || 0);
    const text = allAssets.textByResource.get(rn) || '';
    sitelinkOut.push([rn,'SITELINK',text,clicks,impressions,eurosFromMicros(costMicros),`${since}..${until}`]);
  }
  writeCsv(sitelinkPath, assetHeaders, sitelinkOut);
}

async function exportSearchTerms(customer: any, outDir: string, exportDatePrefix: string, since: string, until: string, nameLike?: string) {
  console.log('\n[3/5] Search terms…');
  const nameClause = nameLike ? ` AND campaign.name LIKE '%${escapeLike(nameLike)}%'` : '';
  const rows: any[] = await customer.query(`
    SELECT 
      search_term_view.search_term,
      campaign.name,
      ad_group.name,
      metrics.impressions,
      metrics.clicks,
      metrics.average_cpc,
      metrics.conversions
    FROM search_term_view 
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
    ORDER BY metrics.clicks DESC
  `);
  const out = path.join(outDir, `${exportDatePrefix}_search_terms.csv`);
  const headers = ['search_term','campaign_name','ad_group_name','impressions','clicks','ctr','avg_cpc_eur','conversions','date_range'];
  const data: any[] = [];
  for (const r of rows) {
    const term = String(getField(r, ['search_term_view.search_term']) || '');
    const campaignName = String(getField(r, ['campaign.name']) || '');
    const adGroupName = String(getField(r, ['ad_group.name']) || '');
    const impressions = Number(getField(r, ['metrics.impressions']) || 0);
    const clicks = Number(getField(r, ['metrics.clicks']) || 0);
    const avgCpcMicros = Number(getField(r, ['metrics.average_cpc']) || 0);
    const conversions = Number(getField(r, ['metrics.conversions']) || 0);
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
    data.push([term, campaignName, adGroupName, impressions, clicks, ctr, eurosFromMicros(avgCpcMicros), conversions, `${since}..${until}`]);
  }
  writeCsv(out, headers, data);
}

async function exportQualityScores(customer: any, outDir: string, exportDatePrefix: string, since: string, until: string, nameLike?: string) {
  console.log('\n[QS] Quality score snapshot…');
  const nameClause = nameLike ? ` AND campaign.name LIKE '%${escapeLike(nameLike)}%'` : '';
  const rows: any[] = await customer.query(`
    SELECT
      campaign.name,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.quality_info.creative_quality_score,
      ad_group_criterion.quality_info.post_click_quality_score,
      metrics.impressions
    FROM keyword_view
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND ad_group_criterion.type = 'KEYWORD'
      AND ad_group_criterion.status IN ('ENABLED','PAUSED')
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
  `);

  const out = path.join(outDir, `${exportDatePrefix}_quality_scores.csv`);
  const headers = [
    'campaign_name',
    'ad_group_name',
    'keyword_id',
    'keyword_text',
    'match_type',
    'status',
    'quality_score',
    'creative_quality_score',
    'post_click_quality_score',
    'impressions',
    'date_range',
  ];
  const data: any[] = [];
  for (const r of rows) {
    const campaignName = String(getField(r, ['campaign.name']) || '');
    const adGroupName = String(getField(r, ['ad_group.name']) || '');
    const keywordId = String(getField(r, ['ad_group_criterion.criterion_id']) || '');
    const keywordText = String(getField(r, ['ad_group_criterion.keyword.text']) || '');
    const matchType = String(getField(r, ['ad_group_criterion.keyword.match_type']) || '');
    const status = String(getField(r, ['ad_group_criterion.status']) || '');
    const qs = String(getField(r, ['ad_group_criterion.quality_info.quality_score']) || '');
    const creative = String(getField(r, ['ad_group_criterion.quality_info.creative_quality_score']) || '');
    const postClick = String(getField(r, ['ad_group_criterion.quality_info.post_click_quality_score']) || '');
    const impressions = Number(getField(r, ['metrics.impressions']) || 0);
    data.push([campaignName, adGroupName, keywordId, keywordText, matchType, status, qs, creative, postClick, impressions, `${since}..${until}`]);
  }

  writeCsv(out, headers, data);
}

async function exportAdgroupPerf(customer: any, outDir: string, exportDatePrefix: string, since: string, until: string, nameLike?: string) {
  console.log('\n[4/5] Ad group performance…');
  const nameClause = nameLike ? ` AND campaign.name LIKE '%${escapeLike(nameLike)}%'` : '';
  const rows: any[] = await customer.query(`
    SELECT 
      campaign.name,
      ad_group.name,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions,
      metrics.cost_per_conversion
    FROM ad_group 
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
    ORDER BY metrics.clicks DESC
  `);
  const out = path.join(outDir, `${exportDatePrefix}_adgroup_perf.csv`);
  const headers = ['campaign_name','ad_group_name','impressions','clicks','ctr','avg_cpc_eur','cost_eur','conversions','cpa_eur','date_range'];
  const data: any[] = [];
  for (const r of rows) {
    const campaignName = String(getField(r, ['campaign.name']) || '');
    const adGroupName = String(getField(r, ['ad_group.name']) || '');
    const impressions = Number(getField(r, ['metrics.impressions']) || 0);
    const clicks = Number(getField(r, ['metrics.clicks']) || 0);
    const costMicros = Number(getField(r, ['metrics.cost_micros']) || 0);
    const avgCpcMicros = Number(getField(r, ['metrics.average_cpc']) || 0);
    const conversions = Number(getField(r, ['metrics.conversions']) || 0);
    const cpaMicros = Number(getField(r, ['metrics.cost_per_conversion']) || 0);
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
    data.push([campaignName, adGroupName, impressions, clicks, ctr, eurosFromMicros(avgCpcMicros), eurosFromMicros(costMicros), conversions, eurosFromMicros(cpaMicros), `${since}..${until}`]);
  }
  writeCsv(out, headers, data);
}

async function exportAssetLabels(customer: any, outDir: string, exportDatePrefix: string, since: string, until: string, nameLike?: string) {
  console.log('\n[5/5] Asset labels (ad-level)…');
  const nameClause = nameLike ? ` AND campaign.name LIKE '%${escapeLike(nameLike)}%'` : '';

  const headlineRows: any[] = await customer.query(`
    SELECT 
      ad_group_ad_asset_view.field_type,
      ad_group_ad_asset_view.performance_label,
      asset.text_asset.text,
      metrics.impressions,
      metrics.clicks,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions
    FROM ad_group_ad_asset_view 
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
      AND ad_group_ad_asset_view.field_type = 'HEADLINE'
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
      AND ad_group_ad.status IN ('ENABLED','PAUSED')
      AND metrics.impressions > 0
  `);

  const descRows: any[] = await customer.query(`
    SELECT 
      ad_group_ad_asset_view.field_type,
      ad_group_ad_asset_view.performance_label,
      asset.text_asset.text,
      metrics.impressions,
      metrics.clicks,
      metrics.average_cpc,
      metrics.cost_micros,
      metrics.conversions
    FROM ad_group_ad_asset_view 
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
      AND ad_group_ad_asset_view.field_type = 'DESCRIPTION'
      AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'
      AND ad_group_ad.status IN ('ENABLED','PAUSED')
      AND metrics.impressions > 0
  `);

  const out = path.join(outDir, `${exportDatePrefix}_asset_labels.csv`);
  const headers = ['field_type','text','performance_label','impressions','clicks','ctr','avg_cpc_eur','cost_eur','conversions','date_range'];
  const rows: any[] = [];

  const pushRow = (r: any) => {
    const ft = String(getField(r, ['ad_group_ad_asset_view.field_type']) || '');
    const text = String(getField(r, ['asset.text_asset.text']) || '');
    const label = String(getField(r, ['ad_group_ad_asset_view.performance_label']) || 'UNSPECIFIED');
    const imp = Number(getField(r, ['metrics.impressions']) || 0);
    const clk = Number(getField(r, ['metrics.clicks']) || 0);
    const cpcMicros = Number(getField(r, ['metrics.average_cpc']) || 0);
    const cost = Number(getField(r, ['metrics.cost_micros']) || 0);
    const conv = Number(getField(r, ['metrics.conversions']) || 0);
    const ctr = imp > 0 ? Math.round((clk / imp) * 10000) / 100 : 0;
    rows.push([ft, text, label, imp, clk, ctr, eurosFromMicros(cpcMicros), eurosFromMicros(cost), conv, `${since}..${until}`]);
  };

  for (const r of headlineRows) pushRow(r);
  for (const r of descRows) pushRow(r);

  rows.sort((a, b) => (a[0] as string).localeCompare(b[0] as string));
  writeCsv(out, headers, rows);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modules = typeof args.modules === 'string' ? args.modules.split(',').map((s) => s.trim()) : ['keywords','assets','asset_labels'];
  const { since, until } = normalizeDateWindow(args);
  const nameLike = typeof args.nameLike === 'string' ? args.nameLike : undefined;
  const outDir = typeof args.outDir === 'string' ? args.outDir : path.join('google_ads_api_scripts', 'private', 'exports');
  const exportDatePrefix = (typeof args.until === 'string' ? args.until : toYyyymmdd(new Date())).replace(/-/g, '');

  console.log('=== Unified Export ===');
  console.log('Params:', { modules, since, until, nameLike: nameLike || '(all campaigns)', outDir });

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

  if (modules.includes('keywords')) await exportKeywords(customer, outDir, exportDatePrefix, since, until, nameLike);
  if (modules.includes('assets')) await exportAssets(customer, outDir, exportDatePrefix, since, until, nameLike);
  if (modules.includes('search_terms')) await exportSearchTerms(customer, outDir, exportDatePrefix, since, until, nameLike);
  if (modules.includes('adgroups')) await exportAdgroupPerf(customer, outDir, exportDatePrefix, since, until, nameLike);
  if (modules.includes('asset_labels')) await exportAssetLabels(customer, outDir, exportDatePrefix, since, until, nameLike);
  if (modules.includes('quality_scores')) await exportQualityScores(customer, outDir, exportDatePrefix, since, until, nameLike);

  console.log('\n✅ Unified export complete.');
}

main().catch((e) => {
  console.error('Fatal error in unified export:', e);
  process.exit(1);
});
