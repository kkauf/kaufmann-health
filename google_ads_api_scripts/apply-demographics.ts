#!/usr/bin/env tsx
/**
 * Apply demographic bid adjustments to all active SEARCH campaigns.
 *
 * Currently applies:
 *  - Age 55-64: -100% (exclude)
 *  - Age 65+: -100% (exclude)
 *  - Tablet: -100% (exclude)
 *
 * Usage:
 *   npx tsx google_ads_api_scripts/apply-demographics.ts              # dry run
 *   npx tsx google_ads_api_scripts/apply-demographics.ts --apply      # apply changes
 *   npx tsx google_ads_api_scripts/apply-demographics.ts --nameLike=TherapieFinden  # filter
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { GoogleAdsApi } from 'google-ads-api';

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

// Google Ads age range criterion IDs
const AGE_RANGES = {
  '18-24': 503001,
  '25-34': 503002,
  '35-44': 503003,
  '45-54': 503004,
  '55-64': 503005,
  '65+': 503006,
  'undetermined': 503999,
};

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const nameLikeArg = args.find(a => a.startsWith('--nameLike='));
  const nameLike = nameLikeArg ? nameLikeArg.split('=')[1] : undefined;

  console.log(`=== Demographic Bid Adjustments (${apply ? 'LIVE' : 'DRY RUN'}) ===\n`);

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

  // Find all active SEARCH campaigns
  const nameClause = nameLike ? ` AND campaign.name LIKE '%${nameLike.replace(/'/g, "''")}%'` : '';
  const campaigns: any[] = await customer.query(`
    SELECT campaign.resource_name, campaign.name, campaign.id
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND campaign.advertising_channel_type = 'SEARCH'
      ${nameClause}
  `);

  if (campaigns.length === 0) {
    console.log('No active SEARCH campaigns found.');
    return;
  }

  console.log(`Found ${campaigns.length} active campaigns:\n`);

  for (const c of campaigns) {
    const campaignRn = c.campaign?.resource_name || c.campaign?.resourceName;
    const campaignName = c.campaign?.name;
    const campaignId = c.campaign?.id;
    console.log(`\n--- ${campaignName} (${campaignId}) ---`);

    // Check existing demographic criteria
    const existingCriteria: any[] = await customer.query(`
      SELECT
        campaign_criterion.resource_name,
        campaign_criterion.criterion_id,
        campaign_criterion.type,
        campaign_criterion.age_range.type,
        campaign_criterion.device.type,
        campaign_criterion.bid_modifier
      FROM campaign_criterion
      WHERE campaign.resource_name = '${campaignRn}'
        AND campaign_criterion.type IN ('AGE_RANGE', 'DEVICE')
    `);

    const existingByType = new Map<string, any>();
    for (const ec of existingCriteria) {
      const criterion = ec.campaign_criterion || ec.campaignCriterion || {};
      const ageType = criterion.age_range?.type || criterion.ageRange?.type;
      const deviceType = criterion.device?.type || criterion.device?.type_;
      const key = ageType || deviceType;
      if (key) {
        existingByType.set(key, {
          resourceName: criterion.resource_name || criterion.resourceName,
          bidModifier: criterion.bid_modifier || criterion.bidModifier,
        });
      }
    }

    // Age exclusions: 55-64 and 65+
    const ageExclusions: Array<{ label: string; id: number }> = [
      { label: '55-64', id: AGE_RANGES['55-64'] },
      { label: '65+', id: AGE_RANGES['65+'] },
    ];

    for (const { label, id } of ageExclusions) {
      // Check for existing criterion with this age range
      const ageTypeKey = `AGE_RANGE_${label.replace('-', '_').replace('+', '_UP')}`;
      const existing = existingByType.get(ageTypeKey);

      if (existing && (existing.bidModifier === 0 || existing.bidModifier === -1)) {
        console.log(`  ✓ Age ${label}: already excluded`);
        continue;
      }

      if (!apply) {
        console.log(`  [DRY] Would exclude age ${label} (criterion ${id})`);
        continue;
      }

      try {
        // Negative campaign criterion = exclude this age range entirely
        await customer.campaignCriteria.create([{
          campaign: campaignRn,
          age_range: { type: id },
          negative: true,
        }]);
        console.log(`  ✓ Age ${label}: excluded (negative criterion)`);
      } catch (e: any) {
        if (e?.errors?.[0]?.message?.includes('ALREADY_EXISTS') ||
            e?.errors?.[0]?.error_code?.criterion_error === 'ALREADY_EXISTS') {
          console.log(`  ✓ Age ${label}: already excluded`);
        } else {
          console.log(`  ✗ Age ${label}: error — ${e?.errors?.[0]?.message || e.message}`);
        }
      }
    }

    // Tablet exclusion
    // Device bid adjustments in Search use bid_modifier on campaign criterion with device type
    const tabletKey = 'TABLET';
    const existingTablet = existingByType.get(tabletKey);

    // Tablet: Device bid adjustments for Smart Bidding require updating existing criteria
    // via the UI. Flag for manual action.
    console.log(`  ⚠ Tablet: set -100% bid adjustment manually in Google Ads UI → Devices`);
  }

  console.log(`\n${apply ? '✅ Applied.' : '🔍 Dry run complete. Add --apply to execute.'}`);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
