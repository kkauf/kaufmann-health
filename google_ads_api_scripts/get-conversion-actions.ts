// Run this to get your conversion action resource names
// npx tsx google_ads_api_scripts/get-conversion-actions.ts
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local', override: true });
dotenvConfig();
// dotenv loaded; will dynamically import google-ads after env is ready

const NAME_TO_ALIAS: Record<string, string> = {
  'KH – Client Registration (preferences)': 'client_registration',
  'KH – Therapist Registration (application)': 'therapist_registration',
};

function toAlias(name: string): string | null {
  if (NAME_TO_ALIAS[name]) return NAME_TO_ALIAS[name];
  const normalized = name.trim().toLowerCase();
  if (normalized.includes('client registration')) return 'client_registration';
  if (normalized.includes('therapist registration')) return 'therapist_registration';
  return null;
}

async function getConversionActions() {
  // Import after env is loaded; use relative path to avoid tsconfig paths at runtime
  const { googleAdsTracker } = await import('../src/lib/google-ads');
  const token = await (googleAdsTracker as any).getAccessToken();
  if (!token) {
    console.log('Failed to get access token');
    return;
  }

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  if (!customerId || !developerToken) {
    console.log('Missing GOOGLE_ADS_CUSTOMER_ID or GOOGLE_ADS_DEVELOPER_TOKEN');
    return;
  }

  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    
    if (loginCustomerId) {
      headers['login-customer-id'] = loginCustomerId;
    }

    const query = `
      SELECT 
        conversion_action.id,
        conversion_action.name,
        conversion_action.resource_name,
        conversion_action.status,
        conversion_action.type,
        conversion_action.tag_snippets
      FROM conversion_action 
      WHERE conversion_action.status = 'ENABLED'
      ORDER BY conversion_action.name
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/v21/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.log('API Error:', error);
      return;
    }

    const data = await response.json();
    
    console.log('\n=== Your Conversion Actions ===');
    if (data.results && data.results.length > 0) {
      data.results.forEach((result: any) => {
        const action = result.conversionAction;
        console.log(`Name: ${action.name}`);
        console.log(`Resource: ${action.resourceName}`);
        console.log(`Status: ${action.status}`);
        console.log(`Type: ${action.type}`);
        if (action.tagSnippets) {
          console.log(`Tag Snippets: ${JSON.stringify(action.tagSnippets, null, 2)}`);
        }
        console.log('---');
      });
      
      console.log('\n=== Add these to your .env ===');
      data.results.forEach((result: any) => {
        const action = result.conversionAction;
        const alias = toAlias(action.name);
        if (alias) {
          const aliasKey = alias.toUpperCase();
          console.log(`GOOGLE_ADS_CA_${aliasKey}=${action.resourceName}`);
        } else {
          const fallbackKey = action.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
          console.log(`# Unknown alias for ${action.name}; adjust as needed`);
          console.log(`GOOGLE_ADS_CA_${fallbackKey}=${action.resourceName}`);
        }
      });
    } else {
      console.log('No conversion actions found. Create them in Google Ads UI first.');
    }

  } catch (e) {
    console.log('Error fetching conversion actions:', e);
  }
}

getConversionActions().catch(console.error);