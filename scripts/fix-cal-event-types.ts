/**
 * Fix broken Cal.com event types that are missing bookingFields
 * Run: npx tsx scripts/fix-cal-event-types.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';

async function fix() {
  const pool = new Pool({
    connectionString: process.env.CAL_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  const client = await pool.connect();
  
  try {
    // Get bookingFields from template event types
    const introFields = await client.query(
      'SELECT "bookingFields" FROM "EventType" WHERE id = 1'
    );
    const fullSessionFields = await client.query(
      'SELECT "bookingFields" FROM "EventType" WHERE id = 4'
    );
    
    console.log('Fixing cloned event types with missing bookingFields...\n');
    
    // Fix intro event types (IDs 6, 8)
    const introResult = await client.query(
      'UPDATE "EventType" SET "bookingFields" = $1 WHERE id IN (6, 8) AND "bookingFields" IS NULL',
      [introFields.rows[0]?.bookingFields || null]
    );
    console.log(`Fixed ${introResult.rowCount} intro event types`);
    
    // Fix full-session event types (IDs 5, 7)
    // Handle JSON properly - if it's already an object, stringify it
    const fullFields = fullSessionFields.rows[0]?.bookingFields;
    const fullFieldsJson = typeof fullFields === 'string' ? fullFields : JSON.stringify(fullFields);
    const fullResult = await client.query(
      'UPDATE "EventType" SET "bookingFields" = $1::jsonb WHERE id IN (5, 7) AND "bookingFields" IS NULL',
      [fullFieldsJson]
    );
    console.log(`Fixed ${fullResult.rowCount} full-session event types`);
    
    // Verify
    console.log('\n=== Verification ===');
    const verify = await client.query(
      'SELECT id, slug, "userId", "bookingFields" IS NOT NULL as has_booking_fields FROM "EventType" ORDER BY id'
    );
    console.table(verify.rows);
    
    console.log('\n✅ Fix complete! Event types should now be editable in Cal.com.');
    
  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
