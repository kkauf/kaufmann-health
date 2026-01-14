/**
 * Fix Cal.com webhook secrets
 * Updates all KH webhooks to use the correct CAL_WEBHOOK_SECRET
 * 
 * Run: npx tsx scripts/fix-cal-webhook-secrets.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';

const EXPECTED_URL = 'https://www.kaufmann-health.de/api/public/cal/webhook';

async function fixWebhookSecrets() {
  const secret = process.env.CAL_WEBHOOK_SECRET || '';
  
  if (!secret) {
    console.error('ERROR: CAL_WEBHOOK_SECRET is not set in .env.local');
    console.log('\nTo fix this:');
    console.log('1. Get the CAL_WEBHOOK_SECRET from Vercel environment variables');
    console.log('2. Add it to .env.local');
    console.log('3. Run this script again');
    process.exit(1);
  }
  
  console.log('CAL_WEBHOOK_SECRET length:', secret.length);
  console.log('First 8 chars:', secret.slice(0, 8) + '...');
  
  const pool = new Pool({
    connectionString: process.env.CAL_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  const client = await pool.connect();
  
  try {
    // Check current state
    console.log('\n=== Current webhook secrets ===');
    const before = await client.query(`
      SELECT 
        w.id,
        u.username,
        LENGTH(w.secret) as current_secret_length
      FROM "Webhook" w
      LEFT JOIN users u ON u.id = w."userId"
      WHERE w."subscriberUrl" = $1
      ORDER BY u.username
    `, [EXPECTED_URL]);
    console.table(before.rows);
    
    // Update all KH webhooks with the correct secret
    console.log('\n=== Updating webhook secrets ===');
    const result = await client.query(`
      UPDATE "Webhook"
      SET secret = $1
      WHERE "subscriberUrl" = $2
      RETURNING id
    `, [secret, EXPECTED_URL]);
    
    console.log(`Updated ${result.rowCount} webhooks`);
    
    // Verify
    console.log('\n=== After update ===');
    const after = await client.query(`
      SELECT 
        w.id,
        u.username,
        LENGTH(w.secret) as new_secret_length
      FROM "Webhook" w
      LEFT JOIN users u ON u.id = w."userId"
      WHERE w."subscriberUrl" = $1
      ORDER BY u.username
    `, [EXPECTED_URL]);
    console.table(after.rows);
    
  } finally {
    client.release();
    await pool.end();
  }
}

fixWebhookSecrets().catch(console.error);
