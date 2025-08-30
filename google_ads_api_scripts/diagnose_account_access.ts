// Run this to diagnose Google Ads account access issues
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local', override: false });
dotenvConfig();

async function diagnoseAccountAccess() {
  console.log('Diagnosing Google Ads account access...\n');
  
  // Check environment variables
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const loginCustomerId: string | null = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? null;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  console.log('Environment Variables:');
  console.log('- GOOGLE_ADS_CUSTOMER_ID:', customerId ? `${customerId} ✓` : '❌ MISSING');
  console.log('- GOOGLE_ADS_LOGIN_CUSTOMER_ID:', loginCustomerId ? `${loginCustomerId} ✓` : '⚠️  Not set');
  console.log('- GOOGLE_ADS_DEVELOPER_TOKEN:', developerToken ? '✓ Set' : '❌ MISSING');
  console.log('- OAuth credentials:', (clientId && clientSecret && refreshToken) ? '✓ Set' : '❌ MISSING');
  
  if (!customerId || !developerToken || !clientId || !clientSecret || !refreshToken) {
    console.log('\n❌ Missing required environment variables');
    return;
  }

  // Test OAuth token
  try {
    console.log('\nTesting OAuth token...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.log('❌ OAuth token failed:', error);
      return;
    }

    const tokens = await tokenResponse.json();
    console.log('✓ OAuth token works');

    // Test different account access patterns
    const accessToken = tokens.access_token;
    
    console.log('\nTesting account access patterns...');
    
    // Test 1: Access without login-customer-id
    console.log('\nTest 1: Access customer directly (no login-customer-id header)');
    await testAccountAccess(accessToken, developerToken, customerId, null);
    
    // Test 2: Access with login-customer-id (if provided)
    if (loginCustomerId && loginCustomerId !== customerId) {
      console.log('\nTest 2: Access via manager account');
      await testAccountAccess(accessToken, developerToken, customerId, loginCustomerId);
    }
    
    // Test 3: Try to list accessible customers
    console.log('\nTest 3: List accessible customers');
    await listAccessibleCustomers(accessToken, developerToken, loginCustomerId);

  } catch (error) {
    console.log('❌ Error during diagnosis:', error);
  }
}

async function testAccountAccess(
  accessToken: string, 
  developerToken: string, 
  customerId: string, 
  loginCustomerId: string | null
) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };
  
  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId;
    console.log(`  Using login-customer-id: ${loginCustomerId}`);
  } else {
    console.log('  No login-customer-id header');
  }

  try {
    const query = `
      SELECT 
        customer.resource_name, 
        customer.descriptive_name 
      FROM customer 
      LIMIT 1
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:search`,
      { method: 'POST', headers, body: JSON.stringify({ query }) }
    );

    if (response.ok) {
      const data = await response.json();
      const name = data.results?.[0]?.customer?.descriptiveName ?? 'N/A';
      console.log(`  ✓ SUCCESS - Can access customer ${customerId}`);
      console.log(`    Account name: ${name}`);
    } else {
      const error = await response.text();
      console.log(`  ❌ FAILED - ${response.status}: ${error}`);
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error}`);
  }
}

async function listAccessibleCustomers(
  accessToken: string, 
  developerToken: string, 
  loginCustomerId: string | null
) {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };
  
  if (loginCustomerId) {
    headers['login-customer-id'] = loginCustomerId;
  }

  try {
    const response = await fetch(
      'https://googleads.googleapis.com/v20/customers:listAccessibleCustomers',
      { method: 'GET', headers }
    );

    if (response.ok) {
      const data = await response.json();
      console.log('  ✓ Accessible customers:');
      if (data.resourceNames && data.resourceNames.length > 0) {
        data.resourceNames.forEach((name: string) => {
          const customerId = name.split('/')[1];
          console.log(`    - ${customerId}`);
        });
      } else {
        console.log('    No accessible customers found');
      }
    } else {
      const error = await response.text();
      console.log(`  ❌ Failed to list customers: ${response.status}: ${error}`);
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error}`);
  }
}

diagnoseAccountAccess().catch(console.error);