/**
 * Send Cal.com onboarding emails to all therapists with Cal accounts
 * 
 * Usage:
 *   npx tsx scripts/send-cal-onboarding-emails.ts --dry-run   # Preview without sending
 *   npx tsx scripts/send-cal-onboarding-emails.ts             # Send emails
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CAL_DATABASE_URL = process.env.CAL_DATABASE_URL!;
// Force production URL for email links
const BASE_URL = 'https://kaufmann.health';

const isDryRun = process.argv.includes('--dry-run');

interface TherapistRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  cal_username: string | null;
}

async function main() {
  console.log('\n=== Send Cal.com Onboarding Emails ===\n');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no emails sent)' : '📧 SENDING EMAILS'}\n`);

  // Dynamic imports after env is loaded
  const { sendEmail } = await import('../src/lib/email/client');
  const { renderTherapistCalOnboarding } = await import('../src/lib/email/templates/therapistCalOnboarding');
  const { createTherapistSessionToken } = await import('../src/lib/auth/therapistSession');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const calPool = new Pool({ connectionString: CAL_DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // Get all verified therapists with Cal.com accounts (exclude test accounts)
  const { data: therapists, error } = await supabase
    .from('therapists')
    .select('id, first_name, last_name, email, cal_username')
    .eq('status', 'verified')
    .not('cal_username', 'is', null)
    .not('email', 'ilike', '%@kaufmann.earth')
    .not('email', 'ilike', '%test%');

  if (error) {
    console.error('❌ Failed to fetch therapists:', error.message);
    process.exit(1);
  }

  const eligibleTherapists = (therapists || []) as TherapistRow[];
  console.log(`Found ${eligibleTherapists.length} therapists with Cal.com accounts:\n`);

  if (eligibleTherapists.length === 0) {
    console.log('No therapists to email.');
    process.exit(0);
  }

  const calClient = await calPool.connect();
  const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

  for (const t of eligibleTherapists) {
    const name = `${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Unknown';
    console.log(`Processing: ${name} <${t.email}>...`);

    try {
      // Get Cal.com password from database (we stored it during provisioning)
      // Actually, we need to generate a new temporary password since we don't store plaintext
      // For now, we'll tell them to use the forgot password flow or we set a known password
      
      // Let's check if they have the password stored in metadata
      const { data: therapistFull } = await supabase
        .from('therapists')
        .select('metadata')
        .eq('id', t.id)
        .single();

      // Get Cal user info
      const { rows: calUsers } = await calClient.query(
        'SELECT id, email FROM users WHERE username = $1',
        [t.cal_username]
      );

      if (calUsers.length === 0) {
        console.log(`  ⚠️ Cal.com user not found for ${t.cal_username}`);
        results.failed.push(`${name}: Cal user not found`);
        continue;
      }

      const calUser = calUsers[0];
      const calEmail = calUser.email;

      // Generate authenticated portal link with redirect to calendar section
      const portalToken = await createTherapistSessionToken({
        therapist_id: t.id,
        email: t.email,
        name: t.first_name || name,
      });
      const portalUrl = `${BASE_URL}/portal/auth?token=${encodeURIComponent(portalToken)}&redirect=${encodeURIComponent('/portal#calendar')}`;

      // For password, we'll tell them to reset it via the Cal.com forgot password flow
      // Or we can generate a new one - let's generate a fresh password
      const bcrypt = await import('bcryptjs');
      const newPassword = generatePassword();
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update password in Cal.com
      await calClient.query(
        'UPDATE "UserPassword" SET hash = $1 WHERE "userId" = $2',
        [passwordHash, calUser.id]
      );

      const emailContent = renderTherapistCalOnboarding({
        name: t.first_name,
        calUsername: t.cal_username!,
        calPassword: newPassword,
        calLoginUrl: 'https://cal.kaufmann.health/auth/login',
        portalUrl,
      });

      if (isDryRun) {
        console.log(`  📧 Would send to: ${t.email}`);
        console.log(`     Cal username: ${t.cal_username}`);
        console.log(`     Password: ${newPassword}`);
        console.log(`     Portal URL: ${portalUrl.substring(0, 80)}...`);
        results.success.push(name);
      } else {
        const sent = await sendEmail({
          to: t.email,
          subject: emailContent.subject,
          html: emailContent.html,
          context: {
            kind: 'cal_onboarding',
            therapist_id: t.id,
          },
        });

        if (sent) {
          console.log(`  ✅ Email sent to ${t.email}`);
          results.success.push(name);
        } else {
          console.log(`  ❌ Failed to send email to ${t.email}`);
          results.failed.push(`${name}: Email send failed`);
        }
      }
    } catch (err) {
      console.error(`  ❌ Error processing ${name}:`, err);
      results.failed.push(`${name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  calClient.release();
  await calPool.end();

  console.log('\n=== SUMMARY ===\n');
  console.log(`✅ ${isDryRun ? 'Would send' : 'Sent'}: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\n--- Failed ---');
    results.failed.forEach(f => console.log(`  - ${f}`));
  }

  console.log('\n✅ Done!');
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

main().catch(console.error);
