/**
 * Fix Cal.com event type schedule assignments
 * 
 * Issue: Event types may be assigned to wrong availability schedules
 * - intro event should use "Kennenlerngespräch" schedule
 * - full-session event should use "Sitzungen" schedule
 * 
 * Run: npx tsx scripts/fix-cal-schedules.ts
 * Dry run: npx tsx scripts/fix-cal-schedules.ts --dry-run
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { Pool } from 'pg';

const DRY_RUN = process.argv.includes('--dry-run');

interface EventType {
  id: number;
  userId: number;
  slug: string;
  scheduleId: number | null;
  scheduleName: string | null;
}

interface Schedule {
  id: number;
  userId: number;
  name: string;
}

interface User {
  id: number;
  username: string;
  email: string;
}

async function main() {
  console.log(`\n=== Cal.com Schedule Assignment Fix ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  const pool = new Pool({
    connectionString: process.env.CAL_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    // Get all users with their event types and schedules
    const { rows: users } = await client.query<User>(`
      SELECT id, username, email 
      FROM users 
      WHERE username IS NOT NULL 
        AND username NOT IN ('template', 'admin')
      ORDER BY id
    `);

    console.log(`Found ${users.length} Cal.com users to check\n`);

    let totalFixed = 0;
    let totalIssues = 0;

    for (const user of users) {
      // Get user's schedules
      const { rows: schedules } = await client.query<Schedule>(`
        SELECT id, "userId", name 
        FROM "Schedule" 
        WHERE "userId" = $1
      `, [user.id]);

      if (schedules.length === 0) {
        console.log(`⚠️  ${user.username}: No schedules found`);
        continue;
      }

      // Get user's event types with their current schedule
      const { rows: eventTypes } = await client.query<EventType>(`
        SELECT 
          e.id, 
          e."userId", 
          e.slug, 
          e."scheduleId",
          s.name as "scheduleName"
        FROM "EventType" e
        LEFT JOIN "Schedule" s ON e."scheduleId" = s.id
        WHERE e."userId" = $1
          AND e.slug IN ('intro', 'full-session')
      `, [user.id]);

      if (eventTypes.length === 0) {
        console.log(`⚠️  ${user.username}: No intro/full-session event types found`);
        continue;
      }

      // Find appropriate schedules
      const kennenlernSchedule = schedules.find(s => 
        s.name.toLowerCase().includes('kennenlerngespräch') || 
        s.name.toLowerCase().includes('kennenlerng') ||
        s.name.toLowerCase().includes('intro')
      );
      const sitzungenSchedule = schedules.find(s => 
        s.name.toLowerCase().includes('sitzung') ||
        s.name.toLowerCase().includes('session')
      );

      // Check each event type
      for (const evt of eventTypes) {
        const expectedSchedule = evt.slug === 'intro' ? kennenlernSchedule : sitzungenSchedule;
        
        if (!expectedSchedule) {
          console.log(`⚠️  ${user.username}: No ${evt.slug === 'intro' ? 'Kennenlerngespräch' : 'Sitzungen'} schedule found`);
          totalIssues++;
          continue;
        }

        const isCorrect = evt.scheduleId === expectedSchedule.id;
        
        if (!isCorrect) {
          totalIssues++;
          const currentScheduleName = evt.scheduleName || 'null';
          console.log(`❌ ${user.username}: ${evt.slug} uses "${currentScheduleName}" but should use "${expectedSchedule.name}"`);
          
          if (!DRY_RUN) {
            await client.query(`
              UPDATE "EventType" 
              SET "scheduleId" = $1 
              WHERE id = $2
            `, [expectedSchedule.id, evt.id]);
            console.log(`   ✅ Fixed: ${evt.slug} → "${expectedSchedule.name}"`);
            totalFixed++;
          }
        } else {
          console.log(`✅ ${user.username}: ${evt.slug} correctly uses "${evt.scheduleName}"`);
        }
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total issues found: ${totalIssues}`);
    if (DRY_RUN) {
      console.log(`Fixes that would be applied: ${totalIssues}`);
      console.log(`\nRun without --dry-run to apply fixes`);
    } else {
      console.log(`Total fixes applied: ${totalFixed}`);
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
