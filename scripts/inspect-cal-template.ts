/**
 * Inspect Cal.com template user structure
 * Run: npx tsx scripts/inspect-cal-template.ts
 */

import { Pool } from 'pg';
import { config } from 'dotenv';

// Load .env.local
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

async function inspect() {
  const client = await pool.connect();
  
  try {
    // 1. Get template user
    console.log('\n=== USER (kgmkauf) ===');
    const userResult = await client.query(`
      SELECT id, username, name, email, "timeZone", locale, "completedOnboarding"
      FROM users 
      WHERE username = 'kgmkauf'
    `);
    console.table(userResult.rows);
    
    if (userResult.rows.length === 0) {
      console.error('User kgmkauf not found!');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log(`\nTemplate User ID: ${userId}`);
    
    // 2. Get event types
    console.log('\n=== EVENT TYPES ===');
    const eventTypesResult = await client.query(`
      SELECT id, slug, title, length, "scheduleId", hidden, 
             "successRedirectUrl", "forwardParamsSuccessRedirect",
             locations::text, description
      FROM "EventType" 
      WHERE "userId" = $1
      ORDER BY id
    `, [userId]);
    console.table(eventTypesResult.rows);
    
    // 3. Get schedules
    console.log('\n=== SCHEDULES ===');
    const schedulesResult = await client.query(`
      SELECT id, name, "timeZone"
      FROM "Schedule" 
      WHERE "userId" = $1
      ORDER BY id
    `, [userId]);
    console.table(schedulesResult.rows);
    
    // 4. Get availability for each schedule
    for (const schedule of schedulesResult.rows) {
      console.log(`\n=== AVAILABILITY for Schedule "${schedule.name}" (ID: ${schedule.id}) ===`);
      const availResult = await client.query(`
        SELECT id, days, "startTime"::text, "endTime"::text, date
        FROM "Availability" 
        WHERE "scheduleId" = $1
        ORDER BY id
      `, [schedule.id]);
      console.table(availResult.rows);
    }
    
    // 5. Get webhooks
    console.log('\n=== WEBHOOKS ===');
    const webhooksResult = await client.query(`
      SELECT id, "subscriberUrl", active, "eventTriggers", secret IS NOT NULL as has_secret
      FROM "Webhook" 
      WHERE "userId" = $1
      ORDER BY "createdAt"
    `, [userId]);
    console.table(webhooksResult.rows);
    
    // 6. Summary for cloning
    console.log('\n=== SUMMARY FOR CLONING ===');
    console.log(`Template User ID: ${userId}`);
    console.log(`Event Types to clone: ${eventTypesResult.rows.length}`);
    for (const et of eventTypesResult.rows) {
      console.log(`  - ${et.slug} (ID: ${et.id}, ${et.length}min, scheduleId: ${et.scheduleId})`);
    }
    console.log(`Schedules: ${schedulesResult.rows.length}`);
    for (const s of schedulesResult.rows) {
      console.log(`  - ${s.name} (ID: ${s.id}, TZ: ${s.timeZone})`);
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

inspect().catch(console.error);
