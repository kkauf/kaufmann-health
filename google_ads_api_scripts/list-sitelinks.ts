#!/usr/bin/env tsx

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleAdsApi } from 'google-ads-api';
import { listSitelinkAssets } from './lib/assets';

dotenv.config({ path: fs.existsSync(path.join(process.cwd(), '.env.local')) ? path.join(process.cwd(), '.env.local') : undefined });

function requireEnv(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), 'true'];
    args[k] = v === 'true' ? true : v === 'false' ? false : v;
  }
  return args as { nameLike?: string | boolean };
}

function escapeLike(s: string) { return s.replace(/'/g, "''"); }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const NAME_LIKE = typeof args.nameLike === 'string' ? String(args.nameLike) : undefined;

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

  const all = await listSitelinkAssets(customer);
  console.log(`Account sitelink assets: ${all.length}`);
  for (const a of all) console.log(`- ${a.linkText || a.name} (${a.resourceName})`);

  if (NAME_LIKE) {
    const rows: any[] = await customer.query(`
      SELECT campaign.name, campaign.resource_name
      FROM campaign
      WHERE campaign.name LIKE '%${escapeLike(NAME_LIKE)}%'
    `);
    if (!rows.length) {
      console.log(`No campaigns matched: ${NAME_LIKE}`);
      return;
    }
    for (const r of rows) {
      const c = (r as any).campaign;
      const campRn = c.resource_name || c.resourceName;
      const attached = await customer.query(`
        SELECT campaign.resource_name, campaign_asset.asset FROM campaign_asset
        WHERE campaign.resource_name='${campRn}' AND campaign_asset.field_type='SITELINK'
      `);
      const attachedRNs = (attached || []).map((x: any) => x?.campaign_asset?.asset || x?.campaignAsset?.asset).filter(Boolean);
      const map = new Map(all.map(a => [a.resourceName, a.linkText || a.name || '']));
      console.log(`\n=== ${c.name} ===`);
      console.log(`Attached sitelinks: ${attachedRNs.length}`);
      for (const rn of attachedRNs) console.log(`  • ${map.get(rn) || rn}`);
      console.log(`Available (not attached): ${all.filter(a => !attachedRNs.includes(a.resourceName)).length}`);
    }
  }
}

main().catch((e) => { console.error('list-sitelinks failed:', e); process.exit(1); });
