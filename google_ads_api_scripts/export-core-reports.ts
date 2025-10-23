#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleAdsApi } from 'google-ads-api';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeCsv(outPath: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.map(v => {
    if (typeof v === 'string') {
      const needsQuote = v.includes(',') || v.includes('\n') || v.includes('"');
      const escaped = v.replace(/"/g, '""');
      return needsQuote ? `"${escaped}"` : escaped;
    }
    return String(v);
  }).join(','))].join('\n') + '\n';
  fs.writeFileSync(outPath, csv);
  console.log('  ✓ Wrote', outPath, `(${rows.length} rows)`);
}

function eurosFromMicros(micros?: number): number {
  if (!micros || Number.isNaN(micros)) return 0;
  return Math.round((micros / 1_000_000) * 100) / 100; // 2 decimals
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), 'true'];
    args[k] = v;
  }
  return args;
}

function normalizeDateWindow(args: Record<string, string | boolean>) {
  const since = typeof args.since === 'string' ? args.since : '2025-10-16';
  const until = typeof args.until === 'string' ? args.until : new Date().toISOString().slice(0, 10);
  return { since, until };
}

function escapeLike(s: string) { return s.replace(/[%_]/g, m => `\\${m}`); }

function getField<T>(row: any, paths: string[]): T | undefined {
  for (const p of paths) {
    const parts = p.split('.');
    let cur: any = row;
    let ok = true;
    for (const part of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, part)) cur = cur[part]; else { ok = false; break; }
    }
    if (ok) return cur as T;
  }
  return undefined;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { since, until } = normalizeDateWindow(args);
  const nameLike = typeof args.nameLike === 'string' ? args.nameLike : 'Positioning_Test';
  const outDir = typeof args.outDir === 'string' ? args.outDir : path.join('google_ads_api_scripts', 'private', 'exports');
  const exportDatePrefix = (typeof args.until === 'string' ? args.until : new Date().toISOString().slice(0, 10)).replace(/-/g, '');

  console.log('=== Export Core Reports ===');
  console.log('Params:', { since, until, nameLike, outDir });

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

  const campaignClause = nameLike ? ` AND campaign.name LIKE '%${nameLike}%'` : '';

  // 1) Campaign Performance by Ad Group
  console.log('\n[1/4] Ad group performance…');
  const adgroupRows: any[] = await customer.query(`
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
      ${campaignClause}
    ORDER BY metrics.clicks DESC
  `);
  const adgroupOut = path.join(outDir, `${exportDatePrefix}_adgroup_perf.csv`);
  const adgroupHeaders = [
    'campaign_name','ad_group_name','impressions','clicks','ctr','avg_cpc_eur','cost_eur','conversions','cpa_eur','date_range'
  ];
  const adgroupData: any[] = [];
  for (const r of adgroupRows) {
    const campaignName = String(getField(r, ['campaign.name']) || '');
    const adGroupName = String(getField(r, ['ad_group.name']) || '');
    const impressions = Number(getField(r, ['metrics.impressions']) || 0);
    const clicks = Number(getField(r, ['metrics.clicks']) || 0);
    const costMicros = Number(getField(r, ['metrics.cost_micros']) || 0);
    const avgCpcMicros = Number(getField(r, ['metrics.average_cpc']) || 0);
    const conversions = Number(getField(r, ['metrics.conversions']) || 0);
    const cpaMicros = Number(getField(r, ['metrics.cost_per_conversion']) || 0);
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0; // percent
    adgroupData.push([
      campaignName, adGroupName, impressions, clicks, ctr, eurosFromMicros(avgCpcMicros), eurosFromMicros(costMicros), conversions, eurosFromMicros(cpaMicros), `${since}..${until}`
    ]);
  }
  writeCsv(adgroupOut, adgroupHeaders, adgroupData);

  // 2) Search Terms Report
  console.log('[2/4] Search terms…');
  const searchRows: any[] = await customer.query(`
    SELECT 
      search_term_view.search_term,
      campaign.name,
      ad_group.name,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions
    FROM search_term_view 
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${campaignClause}
    ORDER BY metrics.clicks DESC
  `);
  const searchOut = path.join(outDir, `${exportDatePrefix}_search_terms.csv`);
  const searchHeaders = [
    'search_term','campaign_name','ad_group_name','impressions','clicks','ctr','avg_cpc_eur','conversions','date_range'
  ];
  const searchData: any[] = [];
  for (const r of searchRows) {
    const term = String(getField(r, ['search_term_view.search_term']) || '');
    const campaignName = String(getField(r, ['campaign.name']) || '');
    const adGroupName = String(getField(r, ['ad_group.name']) || '');
    const impressions = Number(getField(r, ['metrics.impressions']) || 0);
    const clicks = Number(getField(r, ['metrics.clicks']) || 0);
    const avgCpcMicros = Number(getField(r, ['metrics.average_cpc']) || 0);
    const conversions = Number(getField(r, ['metrics.conversions']) || 0);
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
    searchData.push([term, campaignName, adGroupName, impressions, clicks, ctr, eurosFromMicros(avgCpcMicros), conversions, `${since}..${until}`]);
  }
  writeCsv(searchOut, searchHeaders, searchData);

  // 3) Headlines Performance (ad-level RSA assets)
  console.log('[3/4] Headlines (ad-level)…');
  const headlineComboRows: any[] = await customer.query(`
    SELECT 
      campaign.name,
      campaign.advertising_channel_type,
      ad_group_ad_asset_view.field_type,
      asset.text_asset.text,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM ad_group_ad_asset_view 
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${campaignClause}
      AND ad_group_ad_asset_view.field_type = 'HEADLINE'
      AND metrics.impressions > 0
  `);
  const headlinesOut = path.join(outDir, `${exportDatePrefix}_headlines_perf.csv`);
  const headlinesHeaders = ['field_type','text','impressions','clicks','ctr','conversions','date_range'];
  const headlineAgg = new Map<string, { imp: number; clk: number; conv: number }>();
  for (const r of headlineComboRows) {
    const text = String(getField(r, ['asset.text_asset.text']) || '');
    if (!text) continue;
    const key = text;
    const imp = Number(getField(r, ['metrics.impressions']) || 0);
    const clk = Number(getField(r, ['metrics.clicks']) || 0);
    const conv = Number(getField(r, ['metrics.conversions']) || 0);
    const cur = headlineAgg.get(key) || { imp: 0, clk: 0, conv: 0 };
    cur.imp += imp; cur.clk += clk; cur.conv += conv;
    headlineAgg.set(key, cur);
  }
  const headlinesData: any[] = [];
  for (const [text, v] of headlineAgg.entries()) {
    const ctr = v.imp > 0 ? Math.round((v.clk / v.imp) * 10000) / 100 : 0;
    headlinesData.push(['HEADLINE', text, v.imp, v.clk, ctr, v.conv, `${since}..${until}`]);
  }
  // Sort by CTR desc to mirror UI ordering
  headlinesData.sort((a, b) => (b[4] as number) - (a[4] as number));
  writeCsv(headlinesOut, headlinesHeaders, headlinesData);

  // 4) Descriptions Performance (ad-level RSA assets)
  console.log('[4/4] Descriptions (ad-level)…');
  const descComboRows: any[] = await customer.query(`
    SELECT 
      campaign.name,
      campaign.advertising_channel_type,
      ad_group_ad_asset_view.field_type,
      asset.text_asset.text,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions
    FROM ad_group_ad_asset_view 
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${campaignClause}
      AND ad_group_ad_asset_view.field_type = 'DESCRIPTION'
      AND metrics.impressions > 0
  `);
  const descOut = path.join(outDir, `${exportDatePrefix}_descriptions_perf.csv`);
  const descHeaders = ['field_type','text','impressions','clicks','ctr','conversions','date_range'];
  const descAgg = new Map<string, { imp: number; clk: number; conv: number }>();
  for (const r of descComboRows) {
    const text = String(getField(r, ['asset.text_asset.text']) || '');
    if (!text) continue;
    const imp = Number(getField(r, ['metrics.impressions']) || 0);
    const clk = Number(getField(r, ['metrics.clicks']) || 0);
    const conv = Number(getField(r, ['metrics.conversions']) || 0);
    const cur = descAgg.get(text) || { imp: 0, clk: 0, conv: 0 };
    cur.imp += imp; cur.clk += clk; cur.conv += conv;
    descAgg.set(text, cur);
  }
  const descData: any[] = [];
  for (const [text, v] of descAgg.entries()) {
    const ctr = v.imp > 0 ? Math.round((v.clk / v.imp) * 10000) / 100 : 0;
    descData.push(['DESCRIPTION', text, v.imp, v.clk, ctr, v.conv, `${since}..${until}`]);
  }
  descData.sort((a, b) => (b[4] as number) - (a[4] as number));
  writeCsv(descOut, descHeaders, descData);

  console.log('\n✅ Core reports exported:', { adgroupOut, searchOut, headlinesOut, descOut });
}

main().catch((e) => {
  console.error('Fatal error in export-core-reports:', e);
  process.exit(1);
});
