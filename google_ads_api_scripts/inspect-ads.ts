#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
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

async function main() {
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

  // Find campaign resource names by exact name
  const targetNames = [
    'KH_BodyOriented_Positioning_Test_A',
    'KH_ReadyNow_Positioning_Test_B',
  ];
  const nameList = targetNames.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');
  const crs: any[] = await customer.query(`
    SELECT campaign.name, campaign.resource_name FROM campaign WHERE campaign.name IN (${nameList})
  `);
  const targetCampaigns: string[] = crs
    .map((r) => (r as any)?.campaign?.resource_name || (r as any)?.campaign?.resourceName)
    .filter(Boolean);
  if (targetCampaigns.length === 0) {
    console.log('No campaigns found matching target names.');
    return;
  }
  const rnList = targetCampaigns.map((rn) => `'${rn}'`).join(',');

  const rows: any[] = await customer.query(`
    SELECT
      campaign.name,
      campaign.resource_name,
      ad_group.name,
      ad_group.resource_name,
      ad_group_ad.resource_name,
      ad_group_ad.status,
      ad_group_ad.policy_summary.approval_status,
      ad_group_ad.policy_summary.policy_topic_entries,
      ad_group_ad.ad.final_urls,
      ad_group_ad.ad.type
    FROM ad_group_ad
    WHERE campaign.resource_name IN (${rnList})
  `);

  if (!rows.length) {
    console.log('No ads found for the specified campaigns.');
    return;
  }

  const out: Record<string, any[]> = {};
  for (const r of rows) {
    const c = (r as any).campaign;
    const g = (r as any).ad_group;
    const a = (r as any).ad_group_ad;
    const key = `${c.name}`;
    if (!out[key]) out[key] = [];
    out[key].push({
      ad_group: g.name,
      ad_resource: a.resource_name,
      status: a.status,
      approval_status: a.policy_summary?.approval_status,
      type: a.ad?.type,
      final_urls: a.ad?.final_urls,
      policy_topics: a.policy_summary?.policy_topic_entries,
    });
  }

  for (const [camp, ads] of Object.entries(out)) {
    console.log(`\n=== ${camp} → ${ads.length} ads ===`);
    for (const ad of ads) {
      console.log(JSON.stringify(ad, null, 2));
    }
  }
}

main().catch((e) => {
  console.error('inspect-ads failed:', e);
  process.exit(1);
});
