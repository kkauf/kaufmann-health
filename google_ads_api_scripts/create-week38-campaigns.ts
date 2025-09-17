#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load env from .env.local (project root) first, then fallback to .env
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config();
}

import { GoogleAdsApi } from 'google-ads-api';
import { WEEK38_CONFIG, type CampaignConfig, type KeywordTier } from './campaign-config';

const DRY_RUN = process.env.DRY_RUN === 'true';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

function toYyyymmdd(dateStr: string) {
  return dateStr.replace(/-/g, '');
}

function eurosToMicros(euros: number) {
  return Math.round(euros * 1_000_000);
}

async function querySingle(customer: any, q: string): Promise<any | null> {
  const r = await customer.query(q);
  return Array.isArray(r) && r.length > 0 ? r[0] : null;
}

function printPlan(cfg: CampaignConfig) {
  console.log(`\n— Plan: ${cfg.name}`);
  console.log('  Budget €:', cfg.budget_euros);
  console.log('  Landing :', cfg.landing_page);
  console.log('  Dates   :', cfg.schedule.start, '→', cfg.schedule.end);
  const tiers = Object.entries(cfg.keywords) as Array<[string, KeywordTier]> ;
  for (const [tier, data] of tiers) {
    console.log(`  AdGroup Tier: ${tier} — maxCpc €${data.maxCpc.toFixed(2)} — ${data.terms.length} keywords`);
  }
  if (cfg.negativeKeywords?.length) {
    console.log('  Negatives:', cfg.negativeKeywords.join(', '));
  }
  console.log('  Headlines:', cfg.headlines.length, '— Descriptions:', cfg.descriptions.length);
}

async function main() {
  console.log('Week 38 Campaign Creation');
  console.log('Mode:', DRY_RUN ? 'DRY RUN (no changes will be made)' : 'APPLY (will create resources)');

  const client = new GoogleAdsApi({
    client_id: requireEnv('GOOGLE_ADS_CLIENT_ID'),
    client_secret: requireEnv('GOOGLE_ADS_CLIENT_SECRET'),
    developer_token: requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
  });
  const customer = client.Customer({
    customer_id: requireEnv('GOOGLE_ADS_CUSTOMER_ID'),
    login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    refresh_token: requireEnv('GOOGLE_ADS_REFRESH_TOKEN'),
  });

  // Idempotency: skip if campaign already exists by exact name
  async function ensureCampaign(cfg: CampaignConfig) {
    // plan output
    printPlan(cfg);

    const existing = await querySingle(
      customer,
      `SELECT campaign.resource_name, campaign.name, campaign.status FROM campaign WHERE campaign.name = '${cfg.name.replace(/'/g, "''")}' LIMIT 1`
    );
    if (existing) {
      console.log(`  ↪ Found existing campaign, skipping create: ${existing.campaign?.name}`);
      return existing.campaign;
    }

    if (DRY_RUN) {
      console.log('  ↪ DRY RUN: would create budget, campaign, criteria, ad groups, keywords, and ads');
      return null;
    }

    // 1) Create budget
    const budgetCreate: any = await customer.campaignBudgets.create([
      {
        name: `${cfg.name} Budget`,
        amount_micros: eurosToMicros(cfg.budget_euros),
        delivery_method: 'STANDARD',
      },
    ]);
    const budgetResource =
      budgetCreate?.results?.[0]?.resource_name || budgetCreate?.[0]?.resource_name || budgetCreate?.resource_name;
    if (!budgetResource) throw new Error('Budget creation failed: no resource_name');
    console.log('  ✓ Budget created:', budgetResource);

    // 2) Create campaign (start paused for safety)
    const campaignCreate: any = await customer.campaigns.create([
      {
        name: cfg.name,
        status: 'PAUSED',
        advertising_channel_type: 'SEARCH',
        campaign_budget: budgetResource,
        bidding_strategy_type: 'MANUAL_CPC',
        network_settings: {
          target_google_search: true,
          target_search_network: false,
          target_content_network: false,
          target_partner_search_network: false,
        },
        start_date: toYyyymmdd(cfg.schedule.start),
        end_date: toYyyymmdd(cfg.schedule.end),
        geo_target_type_setting: {
          positive_geo_target_type: 'PRESENCE',
          negative_geo_target_type: 'PRESENCE',
        },
      },
    ]);
    const campaignResource =
      campaignCreate?.results?.[0]?.resource_name ||
      campaignCreate?.[0]?.resource_name ||
      campaignCreate?.resource_name;
    if (!campaignResource) throw new Error('Campaign creation failed: no resource_name');
    console.log('  ✓ Campaign created:', campaignResource);

    // 3) Add Germany location targeting (geoTargetConstants/2276)
    const criteriaPayloads: any[] = [
      {
        campaign: campaignResource,
        location: { geo_target_constant: 'geoTargetConstants/2276' },
      },
    ];

    // 4) Add negative keywords if provided
    for (const kw of cfg.negativeKeywords || []) {
      criteriaPayloads.push({
        campaign: campaignResource,
        negative: true,
        keyword: { text: kw, match_type: 'BROAD' },
      });
    }

    const campaignCriteriaCreate: any = await customer.campaignCriteria.create(criteriaPayloads);
    const createdCriteria = campaignCriteriaCreate?.results?.length ?? 0;
    console.log('  ✓ Campaign criteria created:', createdCriteria);

    // 5) Create ad groups + keywords + ads
    await createAdGroupsKeywordsAndAds(customer, campaignResource, cfg);

    return { resource_name: campaignResource, name: cfg.name };
  }

  await ensureCampaign(WEEK38_CONFIG.wellness);
  await ensureCampaign(WEEK38_CONFIG.depth);

  console.log('\nDone.', DRY_RUN ? '(dry run)' : '');
}

async function createAdGroupsKeywordsAndAds(customer: any, campaignResourceName: string, cfg: CampaignConfig) {
  const tiers = Object.entries(cfg.keywords) as Array<[string, KeywordTier]>;

  for (const [tierName, data] of tiers) {
    if (DRY_RUN) {
      console.log(`  ↪ DRY RUN: would create AdGroup '${tierName}' with ${data.terms.length} keywords (maxCpc €${data.maxCpc})`);
      continue;
    }

    // Create ad group
    const adGroupCreate: any = await customer.adGroups.create([
      {
        campaign: campaignResourceName,
        name: `${cfg.name} - ${tierName}`,
        status: 'ENABLED',
        type: 'SEARCH_STANDARD',
        cpc_bid_micros: eurosToMicros(data.maxCpc),
      },
    ]);
    const adGroupResource =
      adGroupCreate?.results?.[0]?.resource_name || adGroupCreate?.[0]?.resource_name || adGroupCreate?.resource_name;
    if (!adGroupResource) throw new Error('Ad group creation failed: no resource_name');
    console.log('  ✓ AdGroup created:', adGroupResource);

    // Add keywords (phrase match)
    if (data.terms.length > 0) {
      const criteriaPayloads = data.terms.map((term) => ({
        ad_group: adGroupResource,
        keyword: {
          text: term,
          match_type: 'PHRASE',
        },
      }));
      const agCriteriaCreate: any = await customer.adGroupCriteria.create(criteriaPayloads);
      console.log('    ✓ Keywords added:', agCriteriaCreate?.results?.length ?? criteriaPayloads.length);
    }

    // Create two RSA variants (A/B)
    await createResponsiveSearchAd(customer, adGroupResource, cfg, 'A');
    await createResponsiveSearchAd(customer, adGroupResource, cfg, 'B');
  }
}

async function createResponsiveSearchAd(
  customer: any,
  adGroupResourceName: string,
  cfg: CampaignConfig,
  variant: 'A' | 'B'
) {
  if (DRY_RUN) {
    console.log(`    ↪ DRY RUN: would create RSA variant ${variant}`);
    return;
  }

  const variantHeadlines = [...cfg.headlines];
  // Light variant tweak per EARTH-156
  if (variant === 'A') variantHeadlines[5] = 'Der nächste Schritt deiner Heilungsreise';
  else variantHeadlines[5] = 'Finde deinen Therapeuten - diese Woche noch';

  const adCreate: any = await customer.adGroupAds.create([
    {
      ad_group: adGroupResourceName,
      status: 'ENABLED',
      ad: {
        responsive_search_ad: {
          headlines: variantHeadlines.slice(0, 15).map((text) => ({ text })),
          descriptions: cfg.descriptions.slice(0, 4).map((text) => ({ text })),
          final_urls: [`${cfg.landing_page}?v=${variant}`],
          tracking_url_template: `${cfg.landing_page}?v=${variant}&gclid={gclid}&keyword={keyword}`,
        },
      },
    },
  ]);
  const adResource = adCreate?.results?.[0]?.resource_name || adCreate?.[0]?.resource_name || adCreate?.resource_name;
  if (!adResource) throw new Error('Ad creation failed: no resource_name');
  console.log(`    ✓ RSA ${variant} created:`, adResource);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
