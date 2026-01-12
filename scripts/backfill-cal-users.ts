/**
 * Backfill Cal.com users for existing verified therapists (EARTH-252)
 * 
 * Usage:
 *   npx tsx scripts/backfill-cal-users.ts --dry-run   # Preview without changes
 *   npx tsx scripts/backfill-cal-users.ts             # Execute backfill
 *   npx tsx scripts/backfill-cal-users.ts --no-email  # Execute without sending emails
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const isDryRun = process.argv.includes('--dry-run');
const skipEmail = process.argv.includes('--no-email');

interface TherapistRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  photo_url: string | null;
  metadata: {
    profile?: {
      practice_address?: string;
    };
  } | null;
  cal_username: string | null;
}

async function main() {
  console.log('\n=== Cal.com User Backfill for Verified Therapists ===\n');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no changes)' : '🚀 LIVE EXECUTION'}`);
  console.log(`Email: ${skipEmail ? '❌ Disabled' : '✅ Will send welcome emails'}\n`);

  // Dynamic imports after env is loaded
  const { provisionCalUser } = await import('../src/lib/cal/provision');
  const { sendEmail } = await import('../src/lib/email/client');
  const { renderTherapistCalOnboarding } = await import('../src/lib/email/templates/therapistCalOnboarding');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get verified therapists without Cal.com accounts
  const { data: therapists, error } = await supabase
    .from('therapists')
    .select('id, first_name, last_name, email, photo_url, metadata, cal_username')
    .eq('status', 'verified')
    .is('cal_username', null);

  if (error) {
    console.error('❌ Failed to fetch therapists:', error.message);
    process.exit(1);
  }

  const eligibleTherapists = (therapists || []) as TherapistRow[];
  console.log(`Found ${eligibleTherapists.length} verified therapists without Cal.com accounts:\n`);

  if (eligibleTherapists.length === 0) {
    console.log('✅ All verified therapists already have Cal.com accounts!');
    process.exit(0);
  }

  // Preview therapists
  for (const t of eligibleTherapists) {
    const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Unknown';
    const address = t.metadata?.profile?.practice_address || '(no address)';
    const photo = t.photo_url ? '✅' : '❌';
    console.log(`  - ${name} <${t.email}>`);
    console.log(`    Photo: ${photo} | Address: ${address}`);
  }
  console.log('');

  if (isDryRun) {
    console.log('🔍 Dry run complete. No changes made.');
    console.log('   Run without --dry-run to execute backfill.');
    process.exit(0);
  }

  // Process each therapist
  const results: Array<{
    name: string;
    email: string;
    success: boolean;
    calUsername?: string;
    calPassword?: string;
    error?: string;
  }> = [];

  for (const t of eligibleTherapists) {
    const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Unknown';
    console.log(`\nProcessing: ${name} <${t.email}>...`);

    try {
      // Provision Cal.com user with square-cropped avatar
      const { getSquareAvatarUrl } = await import('../src/lib/cal/provision');
      const result = await provisionCalUser({
        email: t.email,
        firstName: t.first_name || 'Therapist',
        lastName: t.last_name || '',
        timeZone: 'Europe/Berlin',
        avatarUrl: getSquareAvatarUrl(t.photo_url),
        practiceAddress: t.metadata?.profile?.practice_address || undefined,
      });

      console.log(`  ✅ Cal.com user created: ${result.cal_username} (ID: ${result.cal_user_id})`);

      // Update KH therapists table
      const { error: updateError } = await supabase
        .from('therapists')
        .update({
          cal_user_id: result.cal_user_id,
          cal_username: result.cal_username,
          cal_enabled: true,
          cal_intro_event_type_id: result.cal_intro_event_type_id,
          cal_full_session_event_type_id: result.cal_full_session_event_type_id,
        })
        .eq('id', t.id);

      if (updateError) {
        throw new Error(`Failed to update KH therapists table: ${updateError.message}`);
      }
      console.log(`  ✅ KH therapists table updated`);

      // Send welcome email (if not skipped and password available)
      if (!skipEmail && result.cal_password) {
        const emailContent = renderTherapistCalOnboarding({
          name: t.first_name,
          calEmail: t.email,
          calPassword: result.cal_password,
          calLoginUrl: result.cal_login_url,
          portalUrl: `https://www.kaufmann-health.de/portal`,
        });

        const sent = await sendEmail({
          to: t.email,
          subject: emailContent.subject,
          html: emailContent.html,
        });

        if (sent) {
          console.log(`  ✅ Welcome email sent`);
        } else {
          console.log(`  ⚠️ Email send failed (non-blocking)`);
        }
      } else if (skipEmail) {
        console.log(`  ⏭️ Email skipped (--no-email flag)`);
      } else {
        console.log(`  ⏭️ Email skipped (existing user, no password)`);
      }

      results.push({
        name,
        email: t.email,
        success: true,
        calUsername: result.cal_username,
        calPassword: result.cal_password || undefined,
      });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ Failed: ${errorMsg}`);
      results.push({
        name,
        email: t.email,
        success: false,
        error: errorMsg,
      });
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===\n');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (successful.length > 0) {
    console.log('\n--- Successful Provisioning ---');
    for (const r of successful) {
      console.log(`${r.name}: ${r.calUsername}`);
      if (r.calPassword) {
        console.log(`  Password: ${r.calPassword}`);
      }
    }
  }

  if (failed.length > 0) {
    console.log('\n--- Failed ---');
    for (const r of failed) {
      console.log(`${r.name}: ${r.error}`);
    }
  }

  console.log('\n✅ Backfill complete!');
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
