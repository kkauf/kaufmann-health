import fs from 'fs';
import path from 'path';
import { enums } from 'google-ads-api';

export async function ensureSitelinkAssetsForCampaign(customer: any, campaignRn: string, items: Array<{ text: string; url: string }>, dryRun: boolean) {
  if (!items || items.length === 0) return;
  if (dryRun) {
    console.log(`  [DRY] Would create & attach ${items.length} sitelinks`);
    return;
  }
  try {
    const creates = items.map((it) => ({
      sitelink_asset: { link_text: it.text, final_urls: [it.url] },
    }));
    const created: any = await customer.assets.create(creates, { partial_failure: true });
    const rns: string[] = (created?.results || []).map((r: any) => r?.resource_name).filter(Boolean);
    if (rns.length) {
      await customer.campaignAssets.create(
        rns.map((rn) => ({
          campaign: campaignRn,
          asset: rn,
          field_type: (enums as any).AssetFieldType?.SITELINK ?? enums.AssetFieldType.SITELINK,
        })),
        { partial_failure: true }
      );
      console.log(`  ✓ Sitelinks attached: ${rns.length}`);
    }
  } catch (e) {
    console.error('  ✗ Sitelinks create/attach failed', e);
  }
}

export async function ensureCalloutAssetsForCampaign(customer: any, campaignRn: string, callouts: string[], dryRun: boolean) {
  if (!Array.isArray(callouts) || callouts.length === 0) return;
  if (dryRun) {
    console.log(`  [DRY] Would create & attach ${callouts.length} callouts`);
    return;
  }
  try {
    const creates = callouts.map((text) => ({ callout_asset: { callout_text: text } }));
    const created: any = await customer.assets.create(creates, { partial_failure: true });
    const rns: string[] = (created?.results || []).map((r: any) => r?.resource_name).filter(Boolean);
    if (rns.length) {
      await customer.campaignAssets.create(
        rns.map((rn) => ({
          campaign: campaignRn,
          asset: rn,
          field_type: (enums as any).AssetFieldType?.CALLOUT ?? enums.AssetFieldType.CALLOUT,
        })),
        { partial_failure: true }
      );
      console.log(`  ✓ Callouts attached: ${rns.length}`);
    }
  } catch (e) {
    console.error('  ✗ Callouts create/attach failed', e);
  }
}

export async function ensureStructuredSnippetsForCampaign(customer: any, campaignRn: string, snippets: Array<{ header: string; values: string[] }>, dryRun: boolean) {
  if (!Array.isArray(snippets) || snippets.length === 0) return;
  if (dryRun) {
    console.log(`  [DRY] Would create & attach ${snippets.length} structured snippets`);
    return;
  }
  try {
    const creates = snippets.map((s) => ({
      structured_snippet_asset: { header: s.header, values: (s.values || []).map((v) => ({ value: v })) },
    }));
    const created: any = await customer.assets.create(creates, { partial_failure: true });
    const rns: string[] = (created?.results || []).map((r: any) => r?.resource_name).filter(Boolean);
    if (rns.length) {
      await customer.campaignAssets.create(
        rns.map((rn) => ({
          campaign: campaignRn,
          asset: rn,
          field_type: (enums as any).AssetFieldType?.STRUCTURED_SNIPPET ?? enums.AssetFieldType.STRUCTURED_SNIPPET,
        })),
        { partial_failure: true }
      );
      console.log(`  ✓ Structured snippets attached: ${rns.length}`);
    }
  } catch (e) {
    console.error('  ✗ Structured snippets create/attach failed', e);
  }
}

async function readImageData(filePath: string): Promise<Buffer> {
  return fs.promises.readFile(filePath);
}

export async function ensureImageAssetsForCampaign(customer: any, campaignRn: string, images: Array<{ file_path?: string; url?: string; name?: string }>, dryRun: boolean) {
  if (!Array.isArray(images) || images.length === 0) return;
  if (dryRun) {
    console.log(`  [DRY] Would create & attach ${images.length} image assets`);
    return;
  }
  try {
    const createdRNs: string[] = [];
    for (const img of images) {
      try {
        if (!img.file_path) {
          console.log('  • Skipping image without file_path');
          continue;
        }
        const data = await readImageData(path.isAbsolute(img.file_path) ? img.file_path : path.resolve(process.cwd(), img.file_path));
        const res: any = await customer.assets.create([
          { name: img.name || undefined, image_asset: { data } },
        ], { partial_failure: true });
        const rn = res?.results?.[0]?.resource_name;
        if (rn) createdRNs.push(rn);
      } catch (e) {
        console.log('  • Skipped image create (read or API failed)');
      }
    }
    if (createdRNs.length) {
      const fieldType = (enums as any).AssetFieldType?.IMAGE;
      if (typeof fieldType === 'number') {
        await customer.campaignAssets.create(
          createdRNs.map((rn) => ({ campaign: campaignRn, asset: rn, field_type: fieldType })),
          { partial_failure: true }
        );
        console.log(`  ✓ Image assets attached: ${createdRNs.length}`);
      } else {
        console.log('  • Skipped image attach (field type unsupported by library version)');
      }
    }
  } catch (e) {
    console.error('  ✗ Image assets create/attach failed', e);
  }
}

export async function ensureCampaignAssets(customer: any, campaignRn: string, assetsCfg: any, dryRun: boolean) {
  try {
    await ensureSitelinkAssetsForCampaign(customer, campaignRn, assetsCfg?.sitelinks || [], dryRun);
    await ensureCalloutAssetsForCampaign(customer, campaignRn, assetsCfg?.callouts || [], dryRun);
    await ensureStructuredSnippetsForCampaign(customer, campaignRn, assetsCfg?.structured_snippets || [], dryRun);
    await ensureImageAssetsForCampaign(customer, campaignRn, assetsCfg?.images || [], dryRun);
  } catch (e) {
    console.log('  • Skipped ensureCampaignAssets (error)', e);
  }
}

export async function listAssetsByTypes(customer: any, types: string[]): Promise<{ resourceName: string; type: string; name?: string }[]> {
  const typeList = types.map((t) => `'${t}'`).join(',');
  const rows: any[] = await customer.query(`
    SELECT asset.resource_name, asset.type, asset.name
    FROM asset
    WHERE asset.type IN (${typeList})
  `);
  return rows.map((r) => {
    const a = (r as any).asset || (r as any).asset;
    return {
      resourceName: a?.resource_name || a?.resourceName,
      type: a?.type,
      name: a?.name,
    } as { resourceName: string; type: string; name?: string };
  }).filter((a) => !!a.resourceName);
}

export async function attachAssetsToCampaign(customer: any, campaignRn: string, assets: { resourceName: string; type: string; name?: string }[], dryRun: boolean) {
  const fieldTypeFor: Record<string, number | undefined> = {
    SITELINK: (enums as any).AssetFieldType?.SITELINK ?? enums.AssetFieldType.SITELINK,
    CALLOUT: (enums as any).AssetFieldType?.CALLOUT ?? enums.AssetFieldType.CALLOUT,
    STRUCTURED_SNIPPET: (enums as any).AssetFieldType?.STRUCTURED_SNIPPET ?? enums.AssetFieldType.STRUCTURED_SNIPPET,
    IMAGE: (enums as any).AssetFieldType?.IMAGE,
  };
  const byType: Record<string, { resourceName: string; type: string; name?: string }[]> = {};
  for (const a of assets) {
    if (!byType[a.type]) byType[a.type] = [];
    byType[a.type].push(a);
  }
  const limits: Record<string, number> = { SITELINK: 6, CALLOUT: 10, STRUCTURED_SNIPPET: 4, IMAGE: 10 };

  for (const t of Object.keys(byType)) {
    const selected = byType[t].slice(0, limits[t] || 5);
    if (selected.length === 0) continue;
    const fieldType = fieldTypeFor[t];
    if (typeof fieldType !== 'number') {
      console.log(`  • Skipping unsupported asset field type for ${t}`);
      continue;
    }
    if (dryRun) {
      console.log(`  [DRY] Would attach ${t} assets (${selected.length}) to campaign`);
      continue;
    }
    try {
      await customer.campaignAssets.create(
        selected.map((a) => ({ campaign: campaignRn, asset: a.resourceName, field_type: fieldType })),
        { partial_failure: true }
      );
      console.log(`  ✓ Attached ${t} assets: ${selected.length}`);
    } catch (e: any) {
      const msg = JSON.stringify(e?.errors || String(e));
      console.error(`  ✗ Failed attaching ${t} assets: ${msg}`);
    }
  }
}

export async function listSitelinkAssets(customer: any): Promise<{ resourceName: string; name?: string; linkText?: string }[]> {
  const rows: any[] = await customer.query(`
    SELECT asset.resource_name, asset.name, asset.sitelink_asset.link_text
    FROM asset
    WHERE asset.type = 'SITELINK'
  `);
  return rows.map((r) => {
    const a = (r as any).asset || (r as any).asset;
    return {
      resourceName: a?.resource_name || a?.resourceName,
      name: a?.name,
      linkText: a?.sitelink_asset?.link_text || a?.sitelinkAsset?.linkText,
    } as { resourceName: string; name?: string; linkText?: string };
  }).filter((a) => !!a.resourceName);
}

export async function getSitelinkRNsByNamesOrText(customer: any, names: string[]): Promise<string[]> {
  const all = await listSitelinkAssets(customer);
  const want = new Set(names.map((n) => (n || '').trim().toLowerCase()).filter(Boolean));
  const out: string[] = [];
  for (const a of all) {
    const nm = (a.name || '').trim().toLowerCase();
    const lt = (a.linkText || '').trim().toLowerCase();
    if (want.has(nm) || want.has(lt)) out.push(a.resourceName);
  }
  return Array.from(new Set(out));
}

export async function attachSitelinksToAdGroup(customer: any, adGroupRn: string, sitelinkRNs: string[], dryRun: boolean) {
  if (!sitelinkRNs.length) return;
  if (dryRun) {
    console.log(`    [DRY] Would attach ${sitelinkRNs.length} sitelinks to ad group`);
    return;
  }
  try {
    await customer.adGroupAssets.create(
      sitelinkRNs.map((rn) => ({
        ad_group: adGroupRn,
        asset: rn,
        field_type: (enums as any).AssetFieldType?.SITELINK ?? enums.AssetFieldType.SITELINK,
      })),
      { partial_failure: true }
    );
    console.log(`    ✓ Attached sitelinks to ad group: ${sitelinkRNs.length}`);
  } catch (e: any) {
    const msg = JSON.stringify(e?.errors || String(e));
    console.error(`    ✗ Failed attaching ad-group sitelinks: ${msg}`);
  }
}
