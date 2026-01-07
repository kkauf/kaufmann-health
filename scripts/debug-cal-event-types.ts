/**
 * Debug Cal.com event type issues
 * Run: npx tsx scripts/debug-cal-event-types.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';

async function debug() {
  const pool = new Pool({
    connectionString: process.env.CAL_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  const client = await pool.connect();
  
  try {
    // Check Host table structure
    console.log('=== Host table columns ===');
    const hostCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'Host'"
    );
    console.log(hostCols.rows.map(r => r.column_name).join(', '));
    
    // Check Host table data
    console.log('\n=== Host table data ===');
    const hosts = await client.query('SELECT * FROM "Host"');
    console.table(hosts.rows);
    
    // Check for relationship tables with eventTypeId
    console.log('\n=== Tables with eventTypeId column ===');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.columns 
      WHERE column_name = 'eventTypeId' AND table_schema = 'public'
    `);
    console.log(tables.rows.map(r => r.table_name).join(', '));
    
    // Check if template event types have hosts
    console.log('\n=== Hosts for template event types (1, 4) ===');
    const templateHosts = await client.query(
      'SELECT * FROM "Host" WHERE "eventTypeId" IN (1, 4)'
    );
    console.table(templateHosts.rows);
    
    // Check if cloned event types have hosts
    console.log('\n=== Hosts for cloned event types (5, 6, 7, 8) ===');
    const clonedHosts = await client.query(
      'SELECT * FROM "Host" WHERE "eventTypeId" IN (5, 6, 7, 8)'
    );
    console.table(clonedHosts.rows);
    
    console.log('\n=== Analysis ===');
    if (templateHosts.rows.length > 0 && clonedHosts.rows.length === 0) {
      console.log('ISSUE FOUND: Template event types have hosts, but cloned ones do not!');
      console.log('This is likely causing the "username undefined" error.');
      console.log('\nFix: Need to clone Host records for new event types.');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

debug().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
