#!/usr/bin/env npx tsx
/**
 * Sync verified therapists to Resend audience
 *
 * Usage:
 *   npx tsx scripts/sync-therapist-audience.ts                  # Sync only
 *   npx tsx scripts/sync-therapist-audience.ts --preview        # Preview email
 *   npx tsx scripts/sync-therapist-audience.ts --send-test      # Send test email
 *   npx tsx scripts/sync-therapist-audience.ts --send           # Send broadcast (CAREFUL!)
 *
 * Required env vars:
 *   RESEND_API_KEY
 *   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// Load env from .env.local
import { config } from 'dotenv';
config({ path: '.env.local' });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY not set');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase credentials not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Resend API helpers ---

async function resendFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(`https://api.resend.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend API error ${resp.status}: ${body}`);
  }

  return resp.json();
}

async function getOrCreateAudience(): Promise<string> {
  const { data: audiences } = await resendFetch<{ data: Array<{ id: string; name: string }> }>('/audiences');
  const existing = audiences.find(a => a.name === 'Verified Therapists');
  if (existing) {
    console.log(`📋 Found existing audience: ${existing.id}`);
    return existing.id;
  }

  const created = await resendFetch<{ id: string }>('/audiences', {
    method: 'POST',
    body: JSON.stringify({ name: 'Verified Therapists' }),
  });
  console.log(`✅ Created new audience: ${created.id}`);
  return created.id;
}

async function syncContacts(audienceId: string, therapists: Array<{ email: string; first_name?: string; last_name?: string }>) {
  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const t of therapists) {
    try {
      await resendFetch(`/audiences/${audienceId}/contacts`, {
        method: 'POST',
        body: JSON.stringify({
          email: t.email,
          first_name: t.first_name || undefined,
          last_name: t.last_name || undefined,
          unsubscribed: false,
        }),
      });
      added++;
      process.stdout.write('.');
    } catch (e) {
      const err = e as Error;
      if (err.message.includes('already exists') || err.message.includes('409')) {
        skipped++;
        process.stdout.write('s');
      } else {
        errors++;
        process.stdout.write('x');
      }
    }
  }
  console.log('');
  return { added, skipped, errors };
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const preview = args.includes('--preview');
  const sendTest = args.includes('--send-test');
  const send = args.includes('--send');

  console.log('🔄 Fetching verified therapists...');
  const { data: therapists, error } = await supabase
    .from('therapists')
    .select('id, email, first_name, last_name')
    .eq('status', 'verified')
    .not('email', 'is', null);

  if (error) {
    console.error('❌ Failed to fetch therapists:', error);
    process.exit(1);
  }

  console.log(`📊 Found ${therapists.length} verified therapists`);

  if (preview) {
    // Just show what would be sent
    console.log('\n📧 Email Preview:');
    console.log('Subject: Neues Feature: Buche Folgetermine direkt für deine Klient:innen');
    console.log('Preheader: Termine landen automatisch in beiden Kalendern – mit Erinnerungen');
    console.log('\n(Use --send-test to send a test email)');
    return;
  }

  // Sync to audience
  console.log('\n📤 Syncing to Resend audience...');
  const audienceId = await getOrCreateAudience();

  const result = await syncContacts(
    audienceId,
    therapists.map(t => ({
      email: t.email!,
      first_name: t.first_name || undefined,
      last_name: t.last_name || undefined,
    }))
  );

  console.log(`\n✅ Sync complete: ${result.added} added, ${result.skipped} skipped, ${result.errors} errors`);

  if (sendTest) {
    const testEmail = process.env.LEADS_NOTIFY_EMAIL;
    if (!testEmail) {
      console.error('❌ LEADS_NOTIFY_EMAIL not set');
      process.exit(1);
    }

    console.log(`\n📧 Sending test email to ${testEmail}...`);
    // Import email template dynamically to avoid module resolution issues
    const { renderTherapistProductUpdate } = await import('../src/lib/email/templates/therapistProductUpdate');
    const content = renderTherapistProductUpdate({ name: 'Test-Therapeut:in' });

    await resendFetch('/emails', {
      method: 'POST',
      body: JSON.stringify({
        from: `Kaufmann Health <${process.env.LEADS_FROM_EMAIL || 'noreply@kaufmann-health.de'}>`,
        to: testEmail,
        subject: `[TEST] ${content.subject}`,
        html: content.html,
      }),
    });
    console.log('✅ Test email sent!');
    return;
  }

  if (send) {
    console.log('\n⚠️  WARNING: About to send broadcast to ALL verified therapists!');
    console.log(`   Audience: ${audienceId}`);
    console.log(`   Recipients: ${therapists.length}`);
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n📧 Creating and sending broadcast...');
    const { renderTherapistProductUpdate } = await import('../src/lib/email/templates/therapistProductUpdate');
    const content = renderTherapistProductUpdate({});

    const broadcast = await resendFetch<{ id: string }>('/broadcasts', {
      method: 'POST',
      body: JSON.stringify({
        audience_id: audienceId,
        from: `Kaufmann Health <${process.env.LEADS_FROM_EMAIL || 'noreply@kaufmann-health.de'}>`,
        subject: content.subject,
        html: content.html,
        reply_to: process.env.LEADS_FROM_EMAIL || 'noreply@kaufmann-health.de',
        name: `Product Update: Client Booking - ${new Date().toISOString().split('T')[0]}`,
      }),
    });

    console.log(`📋 Created broadcast: ${broadcast.id}`);

    await resendFetch(`/broadcasts/${broadcast.id}/send`, { method: 'POST' });
    console.log('✅ Broadcast sent!');
    return;
  }

  console.log('\n💡 Next steps:');
  console.log('   --preview     Preview email content');
  console.log('   --send-test   Send test email to LEADS_NOTIFY_EMAIL');
  console.log('   --send        Send broadcast to all therapists');
}

main().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
