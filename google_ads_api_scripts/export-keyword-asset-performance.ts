#!/usr/bin/env tsx
/**
 * Export keyword performance and RSA asset-combination price-serving shares to CSV.
 *
 * Produces:
 *  - keyword_raw.csv           Raw keyword clicks/impressions/cost per campaign/ad group/keyword/match_type
 *  - ad_price_share.csv        Per-ad click shares where the "price" headline served (pinned vs unpinned vs none)
 *  - adgroup_price_share.csv   Ad-group aggregated price-serving shares (weighted by ad clicks)
 *  - keyword_adjusted.csv      Keyword clicks split into estimated buckets: price_pinned / price_unpinned / no_price
 *  - asset_headline_perf.csv   Account-level HEADLINE asset performance with text (for context)
 *
 * Defaults:
 *  - since: 2025-09-01 (account time zone)
 *  - until: yesterday (excludeToday=true)
 *  - channel: SEARCH campaigns only (includes both Google Search and Search Partners; no network filter)
 *  - include ALL statuses (no filtering on enabled/paused/removed)
 *  - priceRegex default matches "80–120€ pro Sitzung" with dash variants
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
    priceRegex?: string | boolean;
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

type PriceAsset = { resourceName: string; text?: string };

type AdPinInfo = {
  adId: string;
  adGroupId: string;
  campaignId: string;
  priceLinked: boolean; // any price asset linked as HEADLINE
  pricePinned: boolean; // any price asset linked with pinned_field set
  pinnedFields: string[];
};

type AdPriceClicks = {
  adId: string;
  adGroupId: string;
  campaignId: string;
  clicksTotal: number;
  clicksPricePresent: number;
  clicksPricePinned: number;
  clicksPriceUnpinned: number;
};

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

async function queryAllAssets(customer: any): Promise<{ assets: PriceAsset[]; textByResource: Map<string, string> }> {
  const rows: any[] = await customer.query(`
    SELECT
      asset.resource_name,
      asset.type,
      asset.name,
      asset.text_asset.text
    FROM asset
  `);
  const assets: PriceAsset[] = [];
  const textByResource = new Map<string, string>();
  for (const r of rows) {
    const rn = getField<string>(r, ['asset.resource_name', 'asset.resourceName']);
    const type = getField<string>(r, ['asset.type', 'asset.type_']);
    const text = getField<string>(r, ['asset.text_asset.text', 'asset.textAsset.text']);
    if (rn && typeof text === 'string' && text.length > 0) {
      textByResource.set(rn, text);
      // GA v21 returns asset.type = 'TEXT' for RSA text assets. Older code used 'TEXT_ASSET'. Accept both.
      if (type === 'TEXT' || type === 'TEXT_ASSET' || type === undefined || type === null) {
        assets.push({ resourceName: rn, text });
      }
    }
  }
  return { assets, textByResource };
}

async function getPriceAssets(customer: any, priceRegex: RegExp): Promise<{ priceAssets: Set<string>; anyPriceAssets: PriceAsset[] }>
{
  const { assets, textByResource } = await queryAllAssets(customer);
  const anyPriceAssets: PriceAsset[] = [];
  for (const [rn, text] of textByResource.entries()) {
    if (typeof text === 'string' && priceRegex.test(text)) {
      anyPriceAssets.push({ resourceName: rn, text });
    }
  }
  const priceAssets = new Set(anyPriceAssets.map((a) => a.resourceName));
  return { priceAssets, anyPriceAssets };
}

async function getAdPinning(customer: any, priceAssets: Set<string>, nameLike?: string): Promise<Map<string, AdPinInfo>> {
  const nameClause = nameLike ? ` AND campaign.name LIKE '%${escapeLike(nameLike)}%'` : '';
  const rows: any[] = await customer.query(`
    SELECT
      ad_group_ad.ad.id,
      ad_group.id,
      campaign.id,
      ad_group_ad_asset_view.field_type,
      ad_group_ad_asset_view.pinned_field,
      ad_group_ad_asset_view.asset
    FROM ad_group_ad_asset_view
    WHERE ad_group_ad_asset_view.field_type = 'HEADLINE'
      AND campaign.advertising_channel_type = 'SEARCH'
      ${nameClause}
  `);

  const pinByAd = new Map<string, AdPinInfo>();

  for (const r of rows) {
    const adId = String(
      getField<any>(r, ['ad_group_ad.ad.id', 'adGroupAd.ad.id']) ||
        getField<any>(r, ['ad_group_ad.resource_name', 'adGroupAd.resourceName']) ||
        ''
    );
    const adGroupId = String(
      getField<any>(r, ['ad_group.id', 'adGroup.id']) ||
        getField<any>(r, ['ad_group.resource_name', 'adGroup.resourceName']) ||
        ''
    );
    const campaignId = String(
      getField<any>(r, ['campaign.id', 'campaign.id_']) ||
        getField<any>(r, ['campaign.resource_name', 'campaign.resourceName']) ||
        ''
    );
    const assetRn = getField<string>(r, ['ad_group_ad_asset_view.asset']);
    const pinnedField = getField<string>(r, ['ad_group_ad_asset_view.pinned_field']);
    if (!adId || !adGroupId || !campaignId || !assetRn) continue;
    const isPriceAsset = priceAssets.has(assetRn);

    const prev = pinByAd.get(adId) || {
      adId,
      adGroupId,
      campaignId,
      priceLinked: false,
      pricePinned: false,
      pinnedFields: [] as string[],
    } as AdPinInfo;

    if (isPriceAsset) {
      prev.priceLinked = true;
      if (pinnedField && pinnedField !== 'UNSPECIFIED') {
        prev.pricePinned = true;
        prev.pinnedFields.push(pinnedField);
      }
    }

    pinByAd.set(adId, prev);
  }

  return pinByAd;
}

async function getCombinationClicks(
  customer: any,
  since: string,
  until: string,
  priceAssets: Set<string>,
  adPinByAd: Map<string, AdPinInfo>,
  nameLike?: string
): Promise<Map<string, AdPriceClicks>> {
  const nameClause = nameLike ? ` AND campaign.name LIKE '%${escapeLike(nameLike)}%'` : '';

  // 1) Total clicks per ad
  const adRows: any[] = await customer.query(`
    SELECT
      campaign.id,
      ad_group.id,
      ad_group_ad.ad.id,
      metrics.clicks
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${since}' AND '${until}'
      AND campaign.advertising_channel_type = 'SEARCH'
      ${nameClause}
  `);

  const byAd = new Map<string, AdPriceClicks>();
  for (const r of adRows) {
    const adId = String(
      getField<any>(r, ['ad_group_ad.ad.id', 'adGroupAd.ad.id']) ||
        getField<any>(r, ['ad_group_ad.resource_name', 'adGroupAd.resourceName']) ||
        ''
    );
    const adGroupId = String(
      getField<any>(r, ['ad_group.id', 'adGroup.id']) ||
        getField<any>(r, ['ad_group.resource_name', 'adGroup.resourceName']) ||
        ''
    );
    const campaignId = String(
      getField<any>(r, ['campaign.id']) ||
        getField<any>(r, ['campaign.resource_name', 'campaign.resourceName']) ||
        ''
    );
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    if (!adId || !adGroupId || !campaignId) continue;
    const entry = byAd.get(adId) || {
      adId,
      adGroupId,
      campaignId,
      clicksTotal: 0,
      clicksPricePresent: 0,
      clicksPricePinned: 0,
      clicksPriceUnpinned: 0,
    } as AdPriceClicks;
    entry.clicksTotal += clicks;
    byAd.set(adId, entry);
  }

  // 2) Clicks per asset-ad pair, restricted to HEADLINE assets; we will sum clicks for price assets only
  const assetRows: any[] = await customer.query(`
    SELECT
      campaign.id,
      ad_group.id,
      ad_group_ad.ad.id,
      ad_group_ad_asset_view.field_type,
      ad_group_ad_asset_view.asset,
      metrics.clicks
    FROM ad_group_ad_asset_view
    WHERE ad_group_ad_asset_view.field_type = 'HEADLINE'
      AND campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
  `);

  for (const r of assetRows) {
    const adId = String(
      getField<any>(r, ['ad_group_ad.ad.id', 'adGroupAd.ad.id']) ||
        getField<any>(r, ['ad_group_ad.resource_name', 'adGroupAd.resourceName']) ||
        ''
    );
    const adGroupId = String(
      getField<any>(r, ['ad_group.id', 'adGroup.id']) ||
        getField<any>(r, ['ad_group.resource_name', 'adGroup.resourceName']) ||
        ''
    );
    const campaignId = String(
      getField<any>(r, ['campaign.id']) ||
        getField<any>(r, ['campaign.resource_name', 'campaign.resourceName']) ||
        ''
    );
    const assetRn = getField<string>(r, ['ad_group_ad_asset_view.asset']);
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    if (!adId || !adGroupId || !campaignId || !assetRn || clicks <= 0) continue;
    if (!priceAssets.has(assetRn)) continue;

    const entry = byAd.get(adId) || {
      adId,
      adGroupId,
      campaignId,
      clicksTotal: 0,
      clicksPricePresent: 0,
      clicksPricePinned: 0,
      clicksPriceUnpinned: 0,
    } as AdPriceClicks;
    entry.clicksPricePresent += clicks;
    const pin = adPinByAd.get(adId);
    if (pin?.pricePinned) entry.clicksPricePinned += clicks;
    else entry.clicksPriceUnpinned += clicks;
    byAd.set(adId, entry);
  }

  return byAd;
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
  const pricePatternStr = typeof args.priceRegex === 'string' ? args.priceRegex : '80\\s*[–-]\\s*120\\s*€\\s*pro\\s*Sitzung';
  const priceRegex = new RegExp(pricePatternStr, 'i');

  console.log('=== Export Keyword & Asset Performance ===');
  console.log('Params:', { since, until, nameLike: nameLike || '(all campaigns)', priceRegex: priceRegex.source, outDir });

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

  // 1) Identify price headline assets
  console.log('\n[1/5] Discovering price headline assets…');
  const { priceAssets, anyPriceAssets } = await getPriceAssets(customer, priceRegex);
  if (priceAssets.size === 0) {
    console.warn('  ⚠ No assets matched the price pattern. Check --priceRegex or asset texts. Proceeding with empty set.');
  } else {
    console.log('  ✓ Price assets:', anyPriceAssets.map((a) => a.resourceName + (a.text ? ` (${a.text})` : '')).slice(0, 5));
    if (anyPriceAssets.length > 5) console.log(`  …and ${anyPriceAssets.length - 5} more`);
  }

  // 2) Determine pinning per ad
  console.log('\n[2/5] Loading ad pinning for price headline…');
  const adPinByAd = await getAdPinning(customer, priceAssets, nameLike);
  console.log('  ✓ Pinning loaded for', adPinByAd.size, 'ads');

  // 3) Combination-level clicks per ad to find price-serving shares
  console.log('\n[3/5] Aggregating combination clicks per ad…');
  const byAd = await getCombinationClicks(customer, since, until, priceAssets, adPinByAd, nameLike);
  console.log('  ✓ Ads with clicks in window:', byAd.size);

  // 4) Aggregate to ad-group-level shares
  console.log('\n[4/5] Aggregating to ad-group price-serving shares…');
  const adgroupAgg = new Map<string, {
    campaignId: string;
    adGroupId: string;
    clicksTotal: number;
    clicksPricePresent: number;
    clicksPricePinned: number;
    clicksPriceUnpinned: number;
  }>();

  for (const ad of byAd.values()) {
    const key = ad.adGroupId;
    const agg = adgroupAgg.get(key) || {
      campaignId: ad.campaignId,
      adGroupId: ad.adGroupId,
      clicksTotal: 0,
      clicksPricePresent: 0,
      clicksPricePinned: 0,
      clicksPriceUnpinned: 0,
    };
    agg.clicksTotal += ad.clicksTotal;
    agg.clicksPricePresent += ad.clicksPricePresent;
    agg.clicksPricePinned += ad.clicksPricePinned;
    agg.clicksPriceUnpinned += ad.clicksPriceUnpinned;
    adgroupAgg.set(key, agg);
  }

  // 5) Keyword performance (raw) and adjusted by ad-group shares
  console.log('\n[5/5] Querying keyword performance…');
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
      metrics.cost_micros
    FROM keyword_view
    WHERE campaign.advertising_channel_type = 'SEARCH'
      AND segments.date BETWEEN '${since}' AND '${until}'
      ${nameClause}
  `);

  // Write CSVs
  console.log('\nWriting CSVs…');
  // CSV 1: keyword_raw.csv
  const keywordRawPath = path.join(outDir, 'keyword_raw.csv');
  const kwRawHeaders = [
    'campaign_id', 'campaign_name', 'ad_group_id', 'ad_group_name',
    'keyword_id', 'keyword_text', 'match_type', 'status',
    'clicks', 'impressions', 'cost_eur', 'date_range'
  ];
  const kwRawRows: any[] = [];

  type Share = { present: number; pinned: number; unpinned: number; none: number };
  function sharesForAdGroup(adGroupId: string): Share {
    const agg = adgroupAgg.get(adGroupId);
    if (!agg || agg.clicksTotal <= 0) return { present: 0, pinned: 0, unpinned: 0, none: 1 };
    const present = Math.min(1, Math.max(0, agg.clicksPricePresent / agg.clicksTotal));
    const pinned = agg.clicksPricePinned / agg.clicksTotal;
    const unpinned = agg.clicksPriceUnpinned / agg.clicksTotal;
    const none = Math.max(0, 1 - (pinned + unpinned));
    return { present, pinned, unpinned, none };
  }

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

  // CSV 2: ad_price_share.csv (per ad)
  const adPricePath = path.join(outDir, 'ad_price_share.csv');
  const adHeaders = [
    'campaign_id', 'ad_group_id', 'ad_id',
    'clicks_total', 'clicks_price_present', 'clicks_price_pinned', 'clicks_price_unpinned',
    'share_price_present', 'share_price_pinned', 'share_price_unpinned', 'share_no_price', 'date_range'
  ];
  const adRows: any[] = [];
  for (const ad of byAd.values()) {
    const total = ad.clicksTotal || 0;
    const present = total > 0 ? ad.clicksPricePresent / total : 0;
    const pinned = total > 0 ? ad.clicksPricePinned / total : 0;
    const unpinned = total > 0 ? ad.clicksPriceUnpinned / total : 0;
    const none = Math.max(0, 1 - (pinned + unpinned));
    adRows.push([
      ad.campaignId, ad.adGroupId, ad.adId,
      total, ad.clicksPricePresent, ad.clicksPricePinned, ad.clicksPriceUnpinned,
      present, pinned, unpinned, none, `${since}..${until}`
    ]);
  }
  writeCsv(adPricePath, adHeaders, adRows);

  // CSV 3: adgroup_price_share.csv
  const aggPath = path.join(outDir, 'adgroup_price_share.csv');
  const agHeaders = [
    'campaign_id', 'ad_group_id', 'clicks_total', 'clicks_price_present', 'clicks_price_pinned', 'clicks_price_unpinned',
    'share_price_present', 'share_price_pinned', 'share_price_unpinned', 'share_no_price', 'date_range'
  ];
  const agRows: any[] = [];
  for (const agg of adgroupAgg.values()) {
    const total = agg.clicksTotal || 0;
    const present = total > 0 ? agg.clicksPricePresent / total : 0;
    const pinned = total > 0 ? agg.clicksPricePinned / total : 0;
    const unpinned = total > 0 ? agg.clicksPriceUnpinned / total : 0;
    const none = Math.max(0, 1 - (pinned + unpinned));
    agRows.push([
      agg.campaignId, agg.adGroupId, agg.clicksTotal, agg.clicksPricePresent, agg.clicksPricePinned, agg.clicksPriceUnpinned,
      present, pinned, unpinned, none, `${since}..${until}`
    ]);
  }
  writeCsv(aggPath, agHeaders, agRows);

  // CSV 4: keyword_adjusted.csv (apply ad-group shares)
  const keywordAdjustedPath = path.join(outDir, 'keyword_adjusted.csv');
  const kwAdjHeaders = [
    'campaign_id', 'campaign_name', 'ad_group_id', 'ad_group_name',
    'keyword_id', 'keyword_text', 'match_type', 'status',
    'clicks_total', 'est_clicks_price_pinned', 'est_clicks_price_unpinned', 'est_clicks_no_price',
    'share_price_pinned', 'share_price_unpinned', 'share_no_price', 'date_range'
  ];
  const kwAdjRows: any[] = [];
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

    const s = sharesForAdGroup(adGroupId);
    const estPinned = Math.round(clicks * s.pinned);
    const estUnpinned = Math.round(clicks * s.unpinned);
    const estNone = Math.max(0, clicks - estPinned - estUnpinned);

    kwAdjRows.push([
      campaignId, campaignName, adGroupId, adGroupName,
      keywordId, keywordText, matchType, status,
      clicks, estPinned, estUnpinned, estNone,
      s.pinned, s.unpinned, s.none, `${since}..${until}`
    ]);
  }
  writeCsv(keywordAdjustedPath, kwAdjHeaders, kwAdjRows);

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

  const assetPerfPath = path.join(outDir, 'asset_headline_perf.csv');
  const assetHeaders = ['asset_resource_name', 'field_type', 'text', 'is_price', 'clicks', 'impressions', 'cost_eur', 'date_range'];
  const assetRows: any[] = [];
  for (const r of assetPerfRows) {
    const fieldType = String(getField<any>(r, ['ad_group_ad_asset_view.field_type', 'adGroupAdAssetView.fieldType']) || '');
    const rn = String(getField<any>(r, ['ad_group_ad_asset_view.asset', 'adGroupAdAssetView.asset']) || '');
    if (!rn) continue;
    const clicks = Number(getField<any>(r, ['metrics.clicks']) || 0);
    const impressions = Number(getField<any>(r, ['metrics.impressions']) || 0);
    const costMicros = Number(getField<any>(r, ['metrics.cost_micros']) || 0);
    const text = allAssets.textByResource.get(rn) || '';
    const isPrice = anyPriceAssets.some((a) => a.resourceName === rn);
    assetRows.push([rn, fieldType, text, isPrice ? 1 : 0, clicks, impressions, eurosFromMicros(costMicros), `${since}..${until}`]);
  }
  writeCsv(assetPerfPath, assetHeaders, assetRows);

  console.log('\n✅ Export complete. Files:', {
    keyword_raw: keywordRawPath,
    ad_price_share: adPricePath,
    adgroup_price_share: aggPath,
    keyword_adjusted: keywordAdjustedPath,
    asset_headline_perf: assetPerfPath,
  });
}

exportData().catch((e) => {
  console.error('Fatal error in export-keyword-asset-performance:', e);
  process.exit(1);
});
