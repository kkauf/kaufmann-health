/**
 * Check a specific therapist's Cal.com setup
 * Run: npx tsx scripts/check-therapist-cal.ts <cal_user_id>
 */

import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;
if (!CAL_DATABASE_URL) {
  console.error('CAL_DATABASE_URL not configured');
  process.exit(1);
}

const pool = new Pool({
  connectionString: CAL_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkTherapist(calUserId: number) {
  const client = await pool.connect();
  try {
    // Find user
    console.log(`\n=== USER (cal_user_id: ${calUserId}) ===`);
    const userResult = await client.query(`
      SELECT id, username, name, email, "timeZone", locale, "completedOnboarding", "defaultScheduleId"
      FROM users WHERE id = $1
    `, [calUserId]);
    
    if (userResult.rows.length === 0) {
      console.error(`User with ID ${calUserId} not found!`);
      return;
    }
    console.table(userResult.rows);
    
    // Get event types
    console.log('\n=== EVENT TYPES ===');
    const eventTypesResult = await client.query(`
      SELECT id, slug, title, length, "scheduleId", hidden, "requiresConfirmation"
      FROM "EventType" WHERE "userId" = $1 ORDER BY id
    `, [calUserId]);
    console.table(eventTypesResult.rows);
    
    if (eventTypesResult.rows.length === 0) {
      console.log('⚠️  No event types found! Therapist needs to create them.');
    }
    
    // Get schedules
    console.log('\n=== SCHEDULES ===');
    const schedulesResult = await client.query(`
      SELECT id, name, "timeZone" FROM "Schedule" WHERE "userId" = $1 ORDER BY id
    `, [calUserId]);
    console.table(schedulesResult.rows);
    
    if (schedulesResult.rows.length === 0) {
      console.log('⚠️  No schedules found!');
    }
    
    // Get availability for each schedule
    for (const schedule of schedulesResult.rows) {
      console.log(`\n=== AVAILABILITY for Schedule "${schedule.name}" (ID: ${schedule.id}) ===`);
      const availResult = await client.query(`
        SELECT id, days, "startTime"::text, "endTime"::text, date
        FROM "Availability" WHERE "scheduleId" = $1 ORDER BY id
      `, [schedule.id]);
      
      if (availResult.rows.length === 0) {
        console.log('⚠️  No availability set for this schedule!');
      } else {
        console.table(availResult.rows);
      }
    }
    
    // Check webhooks
    console.log('\n=== WEBHOOKS ===');
    const webhooksResult = await client.query(`
      SELECT id, "subscriberUrl", active, "eventTriggers"
      FROM "Webhook" WHERE "userId" = $1
    `, [calUserId]);
    
    if (webhooksResult.rows.length === 0) {
      console.log('⚠️  No webhooks configured!');
    } else {
      console.table(webhooksResult.rows);
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    const user = userResult.rows[0];
    console.log(`✓ User: ${user.name} (${user.username})`);
    console.log(`✓ Email: ${user.email}`);
    console.log(`✓ Onboarding completed: ${user.completedOnboarding}`);
    console.log(`✓ Default schedule: ${user.defaultScheduleId || 'Not set'}`);
    console.log(`✓ Event types: ${eventTypesResult.rows.length}`);
    console.log(`✓ Schedules: ${schedulesResult.rows.length}`);
    console.log(`✓ Webhooks: ${webhooksResult.rows.length}`);
    
    // Check booking page
    console.log(`\n🔗 Booking page: https://cal.kaufmann.health/${user.username}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

const calUserId = parseInt(process.argv[2] || '13', 10);
checkTherapist(calUserId).catch(console.error);
