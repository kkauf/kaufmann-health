/**
 * Check Cal.com webhooks configuration
 * Run: npx tsx scripts/check-cal-webhooks.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';

async function checkWebhooks() {
  const pool = new Pool({
    connectionString: process.env.CAL_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  const client = await pool.connect();
  
  try {
    // Check all webhooks
    console.log('=== All Webhooks ===');
    const webhooks = await client.query(`
      SELECT 
        w.id,
        w."userId",
        u.username,
        u.email,
        w."subscriberUrl",
        w.active,
        w."eventTriggers",
        w.secret IS NOT NULL as has_secret,
        LENGTH(w.secret) as secret_length,
        w."createdAt"
      FROM "Webhook" w
      LEFT JOIN users u ON u.id = w."userId"
      ORDER BY w."createdAt" DESC
    `);
    console.table(webhooks.rows);
    
    // Check expected webhook URL
    const expectedUrl = process.env.KH_CAL_WEBHOOK_URL || 'https://www.kaufmann-health.de/api/public/cal/webhook';
    console.log('\n=== Expected Webhook URL ===');
    console.log(expectedUrl);
    
    // Check which webhooks have correct URL
    console.log('\n=== Webhooks with correct URL ===');
    const correctWebhooks = await client.query(`
      SELECT 
        w.id,
        u.username,
        w."subscriberUrl",
        w.active
      FROM "Webhook" w
      LEFT JOIN users u ON u.id = w."userId"
      WHERE w."subscriberUrl" = $1
    `, [expectedUrl]);
    console.table(correctWebhooks.rows);
    
    // Check recent bookings
    console.log('\n=== Recent Bookings (last 7 days) ===');
    const bookings = await client.query(`
      SELECT 
        b.id,
        b.uid,
        b."userId",
        u.username as organizer,
        b."startTime",
        b.status,
        b."createdAt",
        b.metadata
      FROM "Booking" b
      LEFT JOIN users u ON u.id = b."userId"
      WHERE b."createdAt" > NOW() - INTERVAL '7 days'
      ORDER BY b."createdAt" DESC
      LIMIT 20
    `);
    console.table(bookings.rows.map(r => ({
      ...r,
      metadata: r.metadata ? JSON.stringify(r.metadata).slice(0, 50) + '...' : null
    })));
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkWebhooks().catch(console.error);
