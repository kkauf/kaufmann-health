// Verify Google Ads API access & permissions
// Usage: npm run ads:test-access

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load env from .env.local first (project root), then fallback to .env
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config();
}

import { GoogleAdsApi } from 'google-ads-api';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

async function testAccess() {
  console.log('=== Google Ads API Access Test ===');

  // Required envs
  const client_id = requireEnv('GOOGLE_ADS_CLIENT_ID');
  const client_secret = requireEnv('GOOGLE_ADS_CLIENT_SECRET');
  const developer_token = requireEnv('GOOGLE_ADS_DEVELOPER_TOKEN');
  const refresh_token = requireEnv('GOOGLE_ADS_REFRESH_TOKEN');
  const customer_id = requireEnv('GOOGLE_ADS_CUSTOMER_ID');
  const login_customer_id = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined;

  // Init client
  const api = new GoogleAdsApi({ client_id, client_secret, developer_token });
  const customer = api.Customer({ customer_id, refresh_token, login_customer_id });

  try {
    // Test 1: List campaigns (limited)
    console.log('\n[1/4] Listing campaigns (limit 5)…');
    const campaigns = await customer.query(`
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign_budget.amount_micros
      FROM campaign 
      LIMIT 5
    `);
    console.log('  ✓ Can read campaigns:', campaigns.length);

    // Test 2: Find conversion actions
    console.log('\n[2/4] Finding conversion actions (name contains "lead")…');
    const conversions = await customer.query(`
      SELECT 
        conversion_action.name,
        conversion_action.id,
        conversion_action.resource_name
      FROM conversion_action
      WHERE conversion_action.name LIKE '%lead%'
      LIMIT 5
    `);
    console.log('  ✓ Found conversion actions:', conversions.map((c: any) => c.conversion_action?.name));

    // Test 3: Create test budget
    console.log('\n[3/4] Creating test campaign budget…');
    const budgetName = `TEST_DELETE_ME_${Date.now()}`;
    const createResult: any = await customer.campaignBudgets.create([
      {
        name: budgetName,
        amount_micros: 1_000_000, // €1.00 daily
        delivery_method: 'STANDARD',
      },
    ]);
    const createdResourceName =
      createResult?.results?.[0]?.resource_name || createResult?.[0]?.resource_name || createResult?.resource_name;
    if (!createdResourceName) {
      console.log('Create response:', createResult);
      throw new Error('Unable to determine resource_name from create response');
    }
    console.log('  ✓ Created budget:', createdResourceName);

    // Test 4: Delete test budget
    console.log('\n[4/4] Deleting test campaign budget…');
    await customer.campaignBudgets.remove([createdResourceName]);
    console.log('  ✓ Deleted test budget');

    console.log('\n✅ All access tests passed! Ready to create campaigns.');
  } catch (error: any) {
    console.error('\n❌ Access test failed:', error?.message || error);
    if (error?.details) console.error('Details:', error.details);
    process.exit(1);
  }
}

void testAccess();
