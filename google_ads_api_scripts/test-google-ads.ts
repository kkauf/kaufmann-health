// Run this to verify your Google Ads API setup works
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local', override: false });
dotenvConfig();
// dotenv loaded; dynamically import google-ads to ensure env is ready

async function testGoogleAdsSetup() {
  const { googleAdsTracker } = await import('@/lib/google-ads');
  console.log('Testing Google Ads API setup...');
  
  // Test 1: Check if configured
  const isConfigured = (googleAdsTracker as any).isConfigured();
  console.log('✓ Configuration check:', isConfigured ? 'PASS' : 'FAIL - missing env vars');
  
  if (!isConfigured) {
    console.log('Missing environment variables. Check:');
    console.log('- GOOGLE_ADS_CLIENT_ID');
    console.log('- GOOGLE_ADS_CLIENT_SECRET'); 
    console.log('- GOOGLE_ADS_REFRESH_TOKEN');
    console.log('- GOOGLE_ADS_DEVELOPER_TOKEN');
    console.log('- GOOGLE_ADS_CUSTOMER_ID');
    return;
  }

  // Test 2: Get access token
  try {
    const token = await (googleAdsTracker as any).getAccessToken();
    console.log('✓ Access token:', token ? 'PASS' : 'FAIL');
    if (!token) {
      console.log('Failed to get access token. Check OAuth credentials.');
      return;
    }
  } catch (e) {
    console.log('✗ Access token: FAIL -', e);
    return;
  }

  // Test 3: Validate conversion action mapping
  const testAction = 'patient_registration';
  const resolved = (googleAdsTracker as any).resolveConversionAction(testAction);
  console.log(`✓ Conversion action "${testAction}":`, resolved ? 'PASS' : 'FAIL - missing env var');
  
  if (!resolved) {
    console.log('Missing GOOGLE_ADS_CA_PATIENT_REGISTRATION env var');
    console.log('Go to Google Ads UI > Tools > Conversions to get the resource name');
    return;
  }

  // Test 4: Test conversion upload (will show in Google Ads within ~2 hours)
  try {
    console.log('Testing conversion upload...');
    await googleAdsTracker.trackConversion({
      email: 'test@example.com',
      conversionAction: 'patient_registration',
      conversionValue: 10,
      orderId: `test-${Date.now()}`,
    });
    console.log('✓ Conversion upload: PASS');
    console.log('Check Google Ads > Tools > Conversions in ~2 hours for test conversion');
  } catch (e) {
    console.log('✗ Conversion upload: FAIL -', e);
  }
}

// Run test
testGoogleAdsSetup().catch(console.error);