/**
 * Provision a test Cal.com user to verify template cloning works
 * Run: npx tsx scripts/provision-cal-test-user.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  // Dynamic imports after env is loaded
  const { provisionCalUser } = await import('../src/lib/cal/provision');
  const { fetchCalSlotsFromDb } = await import('../src/lib/cal/slots-db');
  console.log('\n=== Cal.com Test User Provisioning ===\n');

  // Test user details - with avatar and practice address
  const testUser = {
    email: 'test-template2@kaufmann.health',
    firstName: 'Avatar',
    lastName: 'Test',
    timeZone: 'Europe/Berlin',
    avatarUrl: 'https://www.kaufmann-health.de/profile-pictures/katherine.JPEG',
    practiceAddress: 'Musterstraße 123, 10115 Berlin',
  };

  console.log('Provisioning test user:', testUser);
  console.log('');

  try {
    const result = await provisionCalUser(testUser);

    console.log('✅ Provisioning successful!\n');
    console.log('Results:');
    console.log('  Cal User ID:', result.cal_user_id);
    console.log('  Username:', result.cal_username);
    console.log('  Password:', result.cal_password || '(existing user, password not available)');
    console.log('  Login URL:', result.cal_login_url);
    console.log('  Intro Event Type ID:', result.cal_intro_event_type_id);
    console.log('  Full Session Event Type ID:', result.cal_full_session_event_type_id);
    console.log('');

    // Verify by fetching slots
    console.log('Verifying by fetching slots...\n');

    const today = new Date();
    const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const startDate = today.toISOString().split('T')[0];
    const endDate = twoWeeksLater.toISOString().split('T')[0];

    const introSlots = await fetchCalSlotsFromDb(
      result.cal_username,
      'intro',
      startDate,
      endDate,
      'Europe/Berlin'
    );

    const fullSessionSlots = await fetchCalSlotsFromDb(
      result.cal_username,
      'full-session',
      startDate,
      endDate,
      'Europe/Berlin'
    );

    console.log(`Intro slots (next 2 weeks): ${introSlots?.length ?? 'null (error)'}`);
    if (introSlots && introSlots.length > 0) {
      console.log('  First 3 slots:', introSlots.slice(0, 3));
    }

    console.log(`Full session slots (next 2 weeks): ${fullSessionSlots?.length ?? 'null (error)'}`);
    if (fullSessionSlots && fullSessionSlots.length > 0) {
      console.log('  First 3 slots:', fullSessionSlots.slice(0, 3));
    }

    console.log('\n=== Cal.com booking URLs ===');
    console.log(`Intro: https://cal.kaufmann.health/${result.cal_username}/intro`);
    console.log(`Full Session: https://cal.kaufmann.health/${result.cal_username}/full-session`);

    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('❌ Provisioning failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
