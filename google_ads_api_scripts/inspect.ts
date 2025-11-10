#!/usr/bin/env tsx
/**
 * Unified inspector for Google Ads campaigns and ads
 *
 * Usage examples:
 *  - tsx google_ads_api_scripts/inspect.ts --show=campaigns --nameLike=Positioning_Test
 *  - tsx google_ads_api_scripts/inspect.ts --show=ads --names=KH_BodyOriented_Positioning_Test_A,KH_ReadyNow_Positioning_Test_B
 *  - tsx google_ads_api_scripts/inspect.ts --show=bids --nameLike=Browse_vs_Submit
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleAdsApi } from 'google-ads-api';

// Load env
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config();
}

const requireEnv = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
};

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), 'true'];
    args[k] = v;
  }
  return args as {
    show?: 'campaigns' | 'ads' | 'bids' | string;
    nameLike?: string | boolean;
    names?: string | boolean; // comma-separated list
  };
}

function asList(val?: string | boolean): string[] | undefined {
  if (!val || typeof val !== 'string') return undefined;
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

function escapeLike(s: string) { return s.replace(/'/g, "''"); }

function eurosFromMicros(micros?: number): number {
  if (!micros || Number.isNaN(micros)) return 0;
  return Math.round((micros / 1_000_000) * 100) / 100;
}

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

async function runCampaignsView(customer: any, names?: string[], nameLike?: string) {
  const where = (() => {
    if (names && names.length) {
      const list = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
      return `campaign.name IN (${list})`;
    }
    if (nameLike && nameLike.length) {
      return `campaign.name LIKE '%${escapeLike(nameLike)}%'`;
    }
    return 'TRUE';
  })();

  const rows: any[] = await customer.query(`
    SELECT
      campaign.name,
      campaign.resource_name,
      campaign.status,
      campaign.start_date,
      campaign.end_date,
      campaign_budget.name,
      campaign_budget.amount_micros
    FROM campaign
    WHERE ${where}
  `);

  if (!rows.length) {
    console.log('No campaigns found.');
    return;
  }

  for (const r of rows) {
    const c = (r as any).campaign;
    const b = (r as any).campaign_budget;
    const budgetEur = eurosFromMicros(b?.amount_micros);
    console.log(`\n=== ${c.name} ===`);
    console.log('resource:', c.resource_name);
    console.log('status:', c.status);
    console.log('dates:', c.start_date, '→', c.end_date);
    console.log('budget:', b?.name, `€${budgetEur}/day`);

    const langs: any[] = await customer.query(`
      SELECT campaign_criterion.language.language_constant
      FROM campaign_criterion
      WHERE campaign_criterion.campaign = '${c.resource_name}' AND campaign_criterion.type = 'LANGUAGE'
    `);
    console.log('languages:', langs.map((x) => (x as any)?.campaign_criterion?.language?.language_constant).filter(Boolean));

    const ags: any[] = await customer.query(`
      SELECT ad_group.name, ad_group.resource_name, ad_group.status
      FROM ad_group
      WHERE ad_group.campaign = '${c.resource_name}'
    `);
    console.log(`ad_groups: ${ags.length}`);
    for (const g of ags) {
      const ag = (g as any).ad_group;
      const ads: any[] = await customer.query(`
        SELECT ad_group_ad.resource_name, ad_group_ad.status
        FROM ad_group_ad
        WHERE ad_group_ad.ad_group = '${ag.resource_name}'
      `);
      console.log(`  - ${ag.name} [${ag.status}] → ads: ${ads.length}`);
    }
  }
}

async function runAdsView(customer: any, names?: string[], nameLike?: string) {
  const where = (() => {
    if (names && names.length) {
      const list = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
      return `campaign.name IN (${list})`;
    }
    if (nameLike && nameLike.length) {
      return `campaign.name LIKE '%${escapeLike(nameLike)}%'`;
    }
    return 'TRUE';
  })();

  const rows: any[] = await customer.query(`
    SELECT
      campaign.name,
      ad_group.name,
      ad_group_ad.resource_name,
      ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status,
      ad_group_ad.policy_summary.policy_topic_entries,
      ad_group_ad.ad.final_urls,
      ad_group_ad.ad.type
    FROM ad_group_ad
    WHERE ${where}
  `);

  if (!rows.length) {
    console.log('No ads found for the specified campaigns.');
    return;
  }

  const grouped: Record<string, any[]> = {};
  for (const r of rows) {
    const c = (r as any).campaign;
    const g = (r as any).ad_group;
    const a = (r as any).ad_group_ad;
    const key = `${c.name}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      ad_group: g.name,
      ad_resource: a.resource_name,
      status: a.status,
      approval_status: a.policy_summary?.approval_status,
      type: a.ad?.type,
      final_urls: a.ad?.final_urls,
      policy_topics: a.policy_summary?.policy_topic_entries,
    });
  }

  for (const [camp, ads] of Object.entries(grouped)) {
    console.log(`\n=== ${camp} → ${ads.length} ads ===`);
    for (const ad of ads) console.log(JSON.stringify(ad, null, 2));
  }
}

async function runBidsView(customer: any, names?: string[], nameLike?: string) {
  const where = (() => {
    if (names && names.length) {
      const list = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
      return `campaign.name IN (${list})`;
    }
    if (nameLike && nameLike.length) {
      return `campaign.name LIKE '%${escapeLike(nameLike)}%'`;
    }
    return `campaign.status != 'REMOVED'`;
  })();

  const rows: any[] = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.bidding_strategy_type,
      campaign.bidding_strategy,
      campaign.manual_cpc.enhanced_cpc_enabled,
      campaign.maximize_conversions.target_cpa_micros,
      campaign_budget.name,
      campaign_budget.amount_micros,
      campaign_budget.explicitly_shared
    FROM campaign
    WHERE ${where}
  `);

  if (!rows.length) {
    console.log('No campaigns found.');
    return;
  }

  const typeNameMap: Record<number, string> = {
    0: 'UNSPECIFIED',
    1: 'UNKNOWN',
    2: 'COMMISSION',
    3: 'MANUAL_CPC',
    4: 'MANUAL_CPM',
    5: 'MANUAL_CPV',
    6: 'MAXIMIZE_CONVERSIONS',
    7: 'MAXIMIZE_CONVERSION_VALUE',
    8: 'TARGET_CPA',
    9: 'TARGET_CPM',
    10: 'TARGET_ROAS',
    11: 'TARGET_SPEND',
  };

  for (const r of rows) {
    const c = (r as any).campaign;
    const b = (r as any).campaign_budget;
    console.log(`\n=== ${c.name} ===`);
    console.log(JSON.stringify({
      id: c.id,
      status: c.status,
      bidding_strategy_type: `${c.bidding_strategy_type} (${typeNameMap[c.bidding_strategy_type ?? -1] || 'N/A'})`,
      bidding_strategy: c.bidding_strategy,
      manual_cpc_ecpc: c.manual_cpc?.enhanced_cpc_enabled,
      maximize_conversions_tCPA_EUR: eurosFromMicros(c.maximize_conversions?.target_cpa_micros),
      budget: {
        name: b?.name,
        amount_eur: eurosFromMicros(b?.amount_micros),
        explicitly_shared: b?.explicitly_shared,
      },
    }, null, 2));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const show = (typeof args.show === 'string' ? args.show : 'campaigns') as 'campaigns' | 'ads' | 'bids';
  const names = asList(args.names);
  const nameLike = typeof args.nameLike === 'string' ? args.nameLike : undefined;

  const api = new GoogleAdsApi({
    client_id: requireEnv('GOOGLE_ADS_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_ADS_CLIENT_SECRET'),
    developer_token: requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
  });
  const customer = api.Customer({
    customer_id: requireEnv('GOOGLE_ADS_CUSTOMER_ID'),
    refresh_token: requireEnv('GOOGLE_ADS_REFRESH_TOKEN'),
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  });

  if (show === 'campaigns') return runCampaignsView(customer, names, nameLike);
  if (show === 'ads') return runAdsView(customer, names, nameLike);
  if (show === 'bids') return runBidsView(customer, names, nameLike);
}

main().catch((e) => {
  console.error('inspect failed:', e);
  process.exit(1);
});
