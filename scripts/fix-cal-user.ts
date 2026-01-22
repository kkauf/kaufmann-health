/**
 * Fix Cal.com event types for a specific therapist
 * 
 * Creates missing event types via Playwright UI automation.
 * 
 * Run: npx tsx scripts/fix-cal-user.ts <therapist_email_or_cal_username>
 * Example: npx tsx scripts/fix-cal-user.ts astrid-peacock
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;

async function main() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error('Usage: npx tsx scripts/fix-cal-user.ts <email_or_cal_username>');
    process.exit(1);
  }

  if (!CAL_DATABASE_URL) {
    console.error('CAL_DATABASE_URL not configured');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: CAL_DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    // Find user
    const { rows: users } = await client.query(
      'SELECT id, email, username FROM users WHERE email = $1 OR username = $1',
      [identifier]
    );

    if (users.length === 0) {
      console.error(`User not found: ${identifier}`);
      process.exit(1);
    }

    const user = users[0];
    console.log(`Found Cal user: ${user.username} (${user.email}), ID: ${user.id}`);

    // Check existing event types
    const { rows: events } = await client.query(
      'SELECT id, slug, hidden, "scheduleId" FROM "EventType" WHERE "userId" = $1',
      [user.id]
    );
    console.log(`Existing event types: ${events.length}`);
    events.forEach(e => console.log(`  - ${e.slug} (id: ${e.id}, hidden: ${e.hidden}, scheduleId: ${e.scheduleId})`));

    const hasIntro = events.some(e => e.slug === 'intro');
    const hasFullSession = events.some(e => e.slug === 'full-session');

    if (hasIntro && hasFullSession) {
      console.log('\n✅ Both event types exist. Checking schedule assignments...');
      
      // Get schedules
      const { rows: schedules } = await client.query(
        'SELECT id, name FROM "Schedule" WHERE "userId" = $1',
        [user.id]
      );
      
      const kennenlernSchedule = schedules.find(s => 
        s.name.toLowerCase().includes('kennenlerng') || s.name.toLowerCase().includes('intro')
      );
      const sitzungenSchedule = schedules.find(s => 
        s.name.toLowerCase().includes('sitzung') || s.name.toLowerCase().includes('session')
      );
      
      let fixed = 0;
      for (const evt of events) {
        const target = evt.slug === 'intro' ? kennenlernSchedule : sitzungenSchedule;
        if (target && evt.scheduleId !== target.id) {
          await client.query('UPDATE "EventType" SET "scheduleId" = $1 WHERE id = $2', [target.id, evt.id]);
          console.log(`  Fixed: ${evt.slug} → ${target.name}`);
          fixed++;
        }
        if (evt.hidden) {
          await client.query('UPDATE "EventType" SET hidden = false WHERE id = $1', [evt.id]);
          console.log(`  Unhidden: ${evt.slug}`);
          fixed++;
        }
      }
      
      if (fixed === 0) {
        console.log('  All event types properly configured!');
      }
      return;
    }

    // Need to create missing event types via Playwright
    console.log('\n⚠️  Missing event types - creating via Playwright...');
    console.log(`  Missing: ${!hasIntro ? 'intro ' : ''}${!hasFullSession ? 'full-session' : ''}`);

    // Generate a temporary password for login
    const tempPassword = Array.from({ length: 16 }, () => 
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 54)]
    ).join('');
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    
    await client.query('UPDATE "UserPassword" SET hash = $1 WHERE "userId" = $2', [passwordHash, user.id]);
    console.log(`  Set temporary password for ${user.email}`);

    client.release();

    // Create event types via Playwright
    const { createEventTypesViaUI, KH_INTRO_EVENT, KH_FULL_SESSION_EVENT } = await import('../src/lib/cal/createEventTypes');
    
    const toCreate = [];
    if (!hasIntro) toCreate.push(KH_INTRO_EVENT);
    if (!hasFullSession) toCreate.push(KH_FULL_SESSION_EVENT);
    
    const result = await createEventTypesViaUI(user.email, tempPassword, user.username, toCreate);
    
    if (result.success) {
      console.log('\n✅ Event types created successfully!');
      console.log(`  Intro ID: ${result.introId}`);
      console.log(`  Full Session ID: ${result.fullSessionId}`);
      
      // Now run schedule fix
      console.log('\nRunning schedule assignment fix...');
      const { execSync } = await import('child_process');
      execSync('npx tsx scripts/fix-cal-schedules.ts', { stdio: 'inherit', cwd: process.cwd() });
    } else {
      console.error('\n❌ Failed to create event types:', result.error);
      process.exit(1);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
