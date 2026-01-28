/**
 * Fix Cal.com webhook event subscriptions
 *
 * Updates all KH webhooks to include MEETING_ENDED and no-show events
 * that were missing from the original provisioning.
 *
 * Usage: npx tsx scripts/fix-cal-webhook-events.ts [--dry-run]
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Client } = pg;

const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL;
const KH_WEBHOOK_URL = process.env.KH_CAL_WEBHOOK_URL || 'https://www.kaufmann-health.de/api/public/cal/webhook';

// All events we want to subscribe to
const ALL_EVENTS = [
  'BOOKING_CREATED',
  'BOOKING_CANCELLED',
  'BOOKING_RESCHEDULED',
  'MEETING_ENDED',
  'BOOKING_NO_SHOW_UPDATED',
  'AFTER_HOSTS_CAL_VIDEO_NO_SHOW',
  'AFTER_GUESTS_CAL_VIDEO_NO_SHOW',
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!CAL_DATABASE_URL) {
    console.error('Missing CAL_DATABASE_URL');
    process.exit(1);
  }

  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Target webhook URL: ${KH_WEBHOOK_URL}`);
  console.log(`Events to subscribe: ${ALL_EVENTS.join(', ')}\n`);

  const client = new Client({ connectionString: CAL_DATABASE_URL });
  await client.connect();

  try {
    // Find all KH webhooks
    const { rows: webhooks } = await client.query(
      `SELECT id, "userId", "subscriberUrl", "eventTriggers", active
       FROM "Webhook"
       WHERE "subscriberUrl" LIKE $1
       ORDER BY "createdAt" DESC`,
      [`%kaufmann%`]
    );

    console.log(`Found ${webhooks.length} KH webhook(s)\n`);

    for (const webhook of webhooks) {
      // eventTriggers is a Postgres array, could be string[] or need parsing
      const currentEvents: string[] = Array.isArray(webhook.eventTriggers)
        ? webhook.eventTriggers
        : typeof webhook.eventTriggers === 'string'
          ? webhook.eventTriggers.replace(/[{}]/g, '').split(',').filter(Boolean)
          : [];
      const missingEvents = ALL_EVENTS.filter((e) => !currentEvents.includes(e));

      console.log(`Webhook ${webhook.id}:`);
      console.log(`  User ID: ${webhook.userId}`);
      console.log(`  URL: ${webhook.subscriberUrl}`);
      console.log(`  Active: ${webhook.active}`);
      console.log(`  Current events: ${currentEvents.join(', ')}`);

      if (missingEvents.length === 0) {
        console.log(`  ✓ Already has all events\n`);
        continue;
      }

      console.log(`  Missing events: ${missingEvents.join(', ')}`);

      if (dryRun) {
        console.log(`  [DRY RUN] Would update to: ${ALL_EVENTS.join(', ')}\n`);
      } else {
        await client.query(
          `UPDATE "Webhook" SET "eventTriggers" = $1 WHERE id = $2`,
          [ALL_EVENTS, webhook.id]
        );
        console.log(`  ✓ Updated to: ${ALL_EVENTS.join(', ')}\n`);
      }
    }

    // Summary
    const needsUpdate = webhooks.filter((w) => {
      const current = w.eventTriggers || [];
      return ALL_EVENTS.some((e) => !current.includes(e));
    });

    console.log('---');
    console.log(`Total webhooks: ${webhooks.length}`);
    console.log(`Webhooks needing update: ${needsUpdate.length}`);
    if (dryRun && needsUpdate.length > 0) {
      console.log('\nRun without --dry-run to apply changes.');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
