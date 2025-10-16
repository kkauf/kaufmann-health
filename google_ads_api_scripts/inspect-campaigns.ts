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

  const names = [
    'KH_BodyOriented_Positioning_Test_A',
    'KH_ReadyNow_Positioning_Test_B',
  ];
  const nameList = names.map((n) => `'${n.replace(/'/g, "''")}'`).join(',');

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
    WHERE campaign.name IN (${nameList})
  `);

  if (!rows.length) {
    console.log('No campaigns found.');
    return;
  }

  for (const r of rows) {
    const c = (r as any).campaign;
    const b = (r as any).campaign_budget;
    const budgetEur = b?.amount_micros ? (b.amount_micros / 1_000_000).toFixed(2) : 'n/a';
    console.log(`\n=== ${c.name} ===`);
    console.log('resource:', c.resource_name);
    console.log('status:', c.status);
    console.log('dates:', c.start_date, '→', c.end_date);
    console.log('budget:', b?.name, `€${budgetEur}/day`);

    // Languages
    const langs: any[] = await customer.query(`
      SELECT campaign_criterion.resource_name, campaign_criterion.language.language_constant
      FROM campaign_criterion
      WHERE campaign_criterion.campaign = '${c.resource_name}' AND campaign_criterion.type = 'LANGUAGE'
    `);
    console.log('languages:', langs.map((x) => (x as any)?.campaign_criterion?.language?.language_constant).filter(Boolean));

    // Ad groups and ad counts
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

main().catch((e) => {
  console.error('inspect-campaigns failed:', e);
  process.exit(1);
});
