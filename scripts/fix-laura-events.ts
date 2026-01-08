import { config } from 'dotenv';
config({ path: '.env.local' });

import { chromium } from 'playwright';
import { Pool } from 'pg';

const CAL_ORIGIN = process.env.NEXT_PUBLIC_CAL_ORIGIN || 'https://cal.kaufmann.health';
const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Login as laura-mankel
    console.log('Logging in as laura-mankel...');
    await page.goto(`${CAL_ORIGIN}/auth/login`);
    await page.fill('input[name="email"]', 'Lmankel@me.com');
    await page.fill('input[name="password"]', 'TempFix2026Cal');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/event-types**', { timeout: 30000 });
    console.log('Logged in successfully');
    
    // Create intro event
    console.log('Creating intro event...');
    await page.click('button:has-text("Neu")');
    await page.waitForTimeout(1000);
    await page.fill('input[name="title"]', 'Kostenloses Kennenlerngespräch (15 Min)');
    await page.fill('input[name="slug"]', 'intro');
    await page.fill('input[name="length"]', '15');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Weiter")');
    await page.waitForURL('**/event-types/**', { timeout: 15000 });
    console.log('Created intro event');
    
    // Go back to event types
    await page.goto(`${CAL_ORIGIN}/event-types`);
    await page.waitForTimeout(2000);
    
    // Create full-session event
    console.log('Creating full-session event...');
    await page.click('button:has-text("Neu")');
    await page.waitForTimeout(1000);
    await page.fill('input[name="title"]', 'Therapiesitzung (50 Min)');
    await page.fill('input[name="slug"]', 'full-session');
    await page.fill('input[name="length"]', '50');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Weiter")');
    await page.waitForURL('**/event-types/**', { timeout: 15000 });
    console.log('Created full-session event');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
  
  // Verify
  const pool = new Pool({ connectionString: CAL_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  const { rows } = await client.query('SELECT id, slug FROM "EventType" WHERE "userId" = 10');
  console.log('\nLaura\'s event types:', rows);
  client.release();
  await pool.end();
}

main().catch(console.error);
