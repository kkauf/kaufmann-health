import { enums } from 'google-ads-api';

function parseHighCpcTerms(): string[] {
  const raw = (process.env.HIGH_CPC_TERMS || '').trim();
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function eurosToMicrosFloat(eur: number): number {
  return Math.round((eur || 0) * 1_000_000);
}

function computeCpcMicrosForTerm(term: string, tierMaxCpcEur: number): number {
  const highs = parseHighCpcTerms();
  const t = term.toLowerCase();
  const isHigh = highs.some((h) => t.includes(h));
  const highEur = Number(process.env.HIGH_CPC_EUR) || tierMaxCpcEur || 5.0;
  const lowEur = Number(process.env.LOW_CPC_EUR) || 0.6;
  return eurosToMicrosFloat(isHigh ? highEur : lowEur);
}

export async function ensureAdGroup(customer: any, campaignRn: string, name: string, cpcMicros: number, dryRun: boolean): Promise<string> {
  if (dryRun || /\/DRY_/.test(campaignRn)) {
    console.log(`  [DRY] Would create ad group: ${name} (bid €${(cpcMicros/1_000_000).toFixed(2)})`);
    return `${campaignRn}/adGroups/DRY_${Date.now()}`;
  }
  try {
    const rows: any[] = await customer.query(`SELECT ad_group.resource_name FROM ad_group WHERE ad_group.name = '${name.replace(/'/g, "''")}' AND ad_group.campaign = '${campaignRn}' LIMIT 1`);
    const existing = rows?.[0]?.ad_group?.resource_name || rows?.[0]?.adGroup?.resourceName;
    if (existing) {
      console.log(`  • Ad group exists: ${name}`);
      return existing as string;
    }
  } catch {}
  try {
    const res: any = await customer.adGroups.create([
      { name, campaign: campaignRn, status: enums.AdGroupStatus.ENABLED, cpc_bid_micros: cpcMicros },
    ]);
    const rn = res?.results?.[0]?.resource_name || res?.[0]?.resource_name;
    if (!rn) throw new Error('No ad group resource_name');
    console.log(`  ✓ Ad group: ${name}`);
    return rn as string;
  } catch (e: any) {
    const s = String(e).toLowerCase();
    if (s.includes('already exists') || s.includes('already_exists') || s.includes('duplicate')) {
      const rows: any[] = await customer.query(`SELECT ad_group.resource_name FROM ad_group WHERE ad_group.name = '${name.replace(/'/g, "''")}' AND ad_group.campaign = '${campaignRn}' LIMIT 1`);
      const rn = rows?.[0]?.ad_group?.resource_name || rows?.[0]?.adGroup?.resourceName;
      if (!rn) throw e;
      console.log(`  • Ad group exists: ${name}`);
      return rn as string;
    }
    throw e;
  }
}

export async function ensureAdGroupBid(customer: any, adGroupRn: string, desiredCpcMicros: number, dryRun: boolean) {
  try {
    const rows: any[] = await customer.query(`
      SELECT ad_group.resource_name, ad_group.cpc_bid_micros
      FROM ad_group
      WHERE ad_group.resource_name = '${adGroupRn}'
      LIMIT 1
    `);
    const current = rows?.[0]?.ad_group?.cpc_bid_micros || rows?.[0]?.adGroup?.cpcBidMicros;
    if (typeof current === 'number' && current === desiredCpcMicros) return;
  } catch {}
  if (dryRun) {
    console.log(`    [DRY] Would set ad group CPC to €${(desiredCpcMicros/1_000_000).toFixed(2)}`);
    return;
  }
  try {
    await customer.adGroups.update([
      { resource_name: adGroupRn, cpc_bid_micros: desiredCpcMicros }
    ], { partial_failure: true });
    console.log(`    ✓ Ad group CPC updated to €${(desiredCpcMicros/1_000_000).toFixed(2)}`);
  } catch (e) {
    console.log('    • Skipped CPC update (may be unchanged or restricted)');
  }
}

export async function ensureKeywordBids(customer: any, adGroupRn: string, overrides: Record<string, number>, dryRun: boolean) {
  if (!overrides || Object.keys(overrides).length === 0) return;
  const rows: any[] = await customer.query(`
    SELECT ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.cpc_bid_micros
    FROM ad_group_criterion
    WHERE ad_group_criterion.ad_group = '${adGroupRn}' AND ad_group_criterion.type = 'KEYWORD'
  `);
  const updates: any[] = [];
  for (const r of rows) {
    const agc = (r as any).ad_group_criterion || (r as any).adGroupCriterion;
    const rn = agc?.resource_name || agc?.resourceName;
    const text = (agc?.keyword?.text || '').toString().toLowerCase().trim();
    if (!rn || !text) continue;
    const desired = overrides[text];
    if (typeof desired === 'number') {
      const current = agc?.cpc_bid_micros || agc?.cpcBidMicros;
      if (current !== desired) updates.push({ resource_name: rn, cpc_bid_micros: desired });
    }
  }
  if (updates.length === 0) return;
  if (dryRun) {
    console.log(`    [DRY] Would update ${updates.length} keyword bids in ad group`);
    return;
  }
  try {
    await customer.adGroupCriteria.update(updates, { partial_failure: true });
    console.log(`    ✓ Updated keyword bids: ${updates.length}`);
  } catch (e) {
    console.log('    • Skipped keyword bid updates (may be restricted)');
  }
}

export async function addKeywords(customer: any, adGroupRn: string, terms: string[], tierMaxCpcEur: number, dryRun: boolean) {
  for (const t of terms) {
    const cpcMicros = computeCpcMicrosForTerm(t, tierMaxCpcEur);
    if (dryRun) {
      console.log(`    [DRY] Would add KW (phrase+exact): ${t} @ ${Math.round(cpcMicros / 1_000_000 * 100) / 100}€`);
      continue;
    }
    try {
      const res: any = await customer.adGroupCriteria.create(
        [
          { ad_group: adGroupRn, status: enums.AdGroupCriterionStatus.ENABLED, cpc_bid_micros: cpcMicros, keyword: { text: t, match_type: enums.KeywordMatchType.PHRASE } },
          { ad_group: adGroupRn, status: enums.AdGroupCriterionStatus.ENABLED, cpc_bid_micros: cpcMicros, keyword: { text: t, match_type: enums.KeywordMatchType.EXACT } },
        ],
        { partial_failure: true }
      );

      const partial = (res && (res.partial_failure_error || res.partialFailureError)) ||
        (Array.isArray(res) && res[0] && (res[0].partial_failure_error || res[0].partialFailureError));

      if (partial) {
        console.error(`    ✗ KW had partial failures (likely policy/invalid): ${t}`);
        try {
          console.error(`      partial_failure_error: ${JSON.stringify(partial, null, 2)}`);
        } catch {
          console.error('      partial_failure_error present but could not be stringified');
        }
      } else {
        console.log(`    ✓ KW added (phrase+exact): ${t}`);
      }
    } catch (e: any) {
      if (String(e).includes('ALREADY_EXISTS') || String(e).includes('DUPLICATE')) {
        console.log(`    • KW exists: ${t}`);
        continue;
      }
      const msg = JSON.stringify(e?.errors || String(e));
      console.error(`    ✗ KW failed: ${t} :: ${msg}`);
    }
  }
}

export async function ensureKeywordBidsForAdGroup(customer: any, adGroupRn: string, terms: string[], tierMaxCpcEur: number, dryRun: boolean) {
  if (dryRun) {
    console.log('  [DRY] Would ensure per-term CPC bids for existing keywords');
    return;
  }
  const rows: any[] = await customer.query(`
    SELECT ad_group_criterion.resource_name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.cpc_bid_micros
    FROM ad_group_criterion
    WHERE ad_group_criterion.ad_group = '${adGroupRn}'
      AND ad_group_criterion.type = 'KEYWORD'
  `);
  const toUpdate: any[] = [];
  for (const r of rows) {
    const c = (r as any).ad_group_criterion || (r as any).adGroupCriterion;
    const text = c?.keyword?.text as string | undefined;
    const rn = c?.resource_name || c?.resourceName;
    if (!text || !rn) continue;
    if (!terms.some((t) => t.toLowerCase() === text.toLowerCase())) continue;
    const desired = computeCpcMicrosForTerm(text, tierMaxCpcEur);
    if (typeof c?.cpc_bid_micros === 'number' && c.cpc_bid_micros === desired) continue;
    toUpdate.push({ resource_name: rn, cpc_bid_micros: desired });
  }
  if (toUpdate.length) {
    try {
      await customer.adGroupCriteria.update(toUpdate, { partial_failure: true });
      console.log(`  ✓ Updated ${toUpdate.length} keyword bid(s)`);
    } catch (e) {
      console.error('  ✗ Failed updating keyword bids', e);
    }
  }
}
