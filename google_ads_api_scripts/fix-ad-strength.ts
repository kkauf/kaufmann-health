#!/usr/bin/env tsx

import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleAdsApi, enums } from 'google-ads-api';

dotenv.config({ path: fs.existsSync(path.join(process.cwd(), '.env.local')) ? path.join(process.cwd(), '.env.local') : undefined });

function requireEnv(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
}

const DRY_RUN = process.env.CONFIRM_APPLY !== 'true';

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN MODE (set CONFIRM_APPLY=true to apply)' : '🚀 APPLYING CHANGES');

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

  // === 1. Attach sitelinks to campaigns ===
  console.log('\n=== SITELINKS ===');
  
  // Get all account sitelinks
  const sitelinkRows: any[] = await customer.query(`
    SELECT asset.resource_name, asset.sitelink_asset.link_text
    FROM asset
    WHERE asset.type = 'SITELINK'
  `);
  const sitelinks = sitelinkRows.map(r => ({
    resourceName: r.asset.resource_name,
    linkText: r.asset.sitelink_asset?.link_text || r.asset.sitelink_asset?.linkText
  }));
  console.log(`Found ${sitelinks.length} account sitelinks`);

  // Campaigns to update
  const campaignNames = [
    'KH_Acq_Winners_Start',
    'KH_Acq_Winners_TherapieFinden', 
    'KH_Brand_Search'
  ];

  // Sitelinks to attach (pick 4+ good ones)
  const sitelinksToAttach = [
    'Direkt zum Aufnahmebogen',
    'NARM Therapie',
    'Somatic Experiencing',
    'Über Uns',
    'Therapeutenverzeichnis',
  ];

  for (const campName of campaignNames) {
    // Get campaign resource name
    const campRows: any[] = await customer.query(`
      SELECT campaign.resource_name, campaign.name
      FROM campaign
      WHERE campaign.name = '${campName}'
    `);
    if (!campRows.length) {
      console.log(`Campaign not found: ${campName}`);
      continue;
    }
    const campRn = campRows[0].campaign.resource_name;

    // Get currently attached sitelinks
    const attachedRows: any[] = await customer.query(`
      SELECT campaign.resource_name, campaign_asset.asset
      FROM campaign_asset
      WHERE campaign.resource_name = '${campRn}'
      AND campaign_asset.field_type = 'SITELINK'
    `);
    const attachedRNs = new Set(attachedRows.map(r => r.campaign_asset?.asset || r.campaignAsset?.asset));
    console.log(`\n${campName}: ${attachedRNs.size} sitelinks attached`);

    // Find sitelinks to add
    const toAdd: string[] = [];
    for (const linkText of sitelinksToAttach) {
      const sl = sitelinks.find(s => s.linkText === linkText);
      if (sl && !attachedRNs.has(sl.resourceName)) {
        toAdd.push(sl.resourceName);
        console.log(`  + Will attach: ${linkText}`);
      }
    }

    if (toAdd.length === 0) {
      console.log('  (no new sitelinks to attach)');
      continue;
    }

    if (!DRY_RUN) {
      for (const assetRn of toAdd) {
        try {
          await customer.campaignAssets.create([{
            campaign: campRn,
            asset: assetRn,
            field_type: enums.AssetFieldType.SITELINK,
          }]);
          console.log(`  ✓ Attached ${assetRn}`);
        } catch (e: any) {
          if (e.message?.includes('ALREADY_EXISTS')) {
            console.log(`  (already exists: ${assetRn})`);
          } else {
            console.error(`  ✗ Failed: ${e.message}`);
          }
        }
      }
    }
  }

  // === 2. Add headlines to RSAs ===
  console.log('\n=== HEADLINES ===');

  // New headlines to add per campaign
  const headlinesToAdd: Record<string, string[]> = {
    'KH_Acq_Winners_Start': [
      // Modality-focused + keyword insertion
      'NARM Therapie Berlin',          // 18 chars - missing modality
      'Somatische Therapie Berlin',    // 27 chars
      '{KeyWord:Körpertherapie}',      // KWI
      'Körpertherapie Berlin',         // 22 chars
      'Trauma Im Körper Lösen',        // 21 chars
      '80€–120€ pro Sitzung',          // 20 chars - price anchor
    ],
    'KH_Acq_Winners_TherapieFinden': [
      // Category-focused
      'Somatische Therapie Berlin',    // 27 chars
      '{KeyWord:Körpertherapie}',      // KWI
      'Trauma Im Körper Lösen',        // 21 chars  
      'NARM, SE & Hakomi',             // 17 chars
    ],
  };

  for (const [campName, newHeadlines] of Object.entries(headlinesToAdd)) {
    // Get current RSA
    const rsaRows: any[] = await customer.query(`
      SELECT 
        ad_group_ad.ad.resource_name,
        ad_group_ad.ad.responsive_search_ad.headlines,
        ad_group_ad.ad.responsive_search_ad.descriptions
      FROM ad_group_ad
      WHERE campaign.name = '${campName}'
      AND campaign.status = 'ENABLED'
      AND ad_group_ad.status != 'REMOVED'
    `);

    if (!rsaRows.length) {
      console.log(`No RSA found for ${campName}`);
      continue;
    }

    const rsa = rsaRows[0];
    const adRn = rsa.ad_group_ad.ad.resource_name;
    const currentHeadlines = rsa.ad_group_ad.ad.responsive_search_ad?.headlines || [];
    const currentDescriptions = rsa.ad_group_ad.ad.responsive_search_ad?.descriptions || [];
    
    console.log(`\n${campName}: ${currentHeadlines.length} headlines currently`);

    // Filter out duplicates and validate length
    const existingTexts = new Set(currentHeadlines.map((h: any) => h.text.toLowerCase()));
    const toAdd = newHeadlines.filter(h => {
      if (h.length > 30) {
        console.log(`  ⚠ Skipping (too long): ${h} (${h.length} chars)`);
        return false;
      }
      if (existingTexts.has(h.toLowerCase())) {
        console.log(`  (already exists): ${h}`);
        return false;
      }
      return true;
    });

    const needed = 15 - currentHeadlines.length;
    const adding = toAdd.slice(0, needed);
    
    if (adding.length === 0) {
      console.log('  (no new headlines to add)');
      continue;
    }

    console.log(`  Adding ${adding.length} headlines:`);
    adding.forEach(h => console.log(`    + ${h}`));

    if (!DRY_RUN) {
      // Build updated headlines array
      const updatedHeadlines = [
        ...currentHeadlines.map((h: any) => ({ text: h.text, pinned_field: h.pinned_field })),
        ...adding.map(text => ({ text }))
      ];

      try {
        await customer.ads.update([{
          resource_name: adRn,
          responsive_search_ad: {
            headlines: updatedHeadlines,
            descriptions: currentDescriptions.map((d: any) => ({ text: d.text, pinned_field: d.pinned_field })),
          }
        }]);
        console.log(`  ✓ Updated RSA with ${updatedHeadlines.length} headlines`);
      } catch (e: any) {
        console.error(`  ✗ Failed to update RSA: ${e.message}`);
      }
    }
  }

  console.log('\n' + (DRY_RUN ? '✅ DRY RUN complete. Run with CONFIRM_APPLY=true to apply.' : '✅ Changes applied!'));
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
