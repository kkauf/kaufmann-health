#!/usr/bin/env npx tsx
/**
 * Send test product update email
 * Usage: npx tsx scripts/send-test-product-update.ts [email]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { renderTherapistProductUpdate } from '../src/lib/email/templates/therapistProductUpdate';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function main() {
  const email = process.argv[2] || process.env.LEADS_NOTIFY_EMAIL;

  if (!email) {
    console.error('Usage: npx tsx scripts/send-test-product-update.ts <email>');
    process.exit(1);
  }

  if (!RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not set');
    process.exit(1);
  }

  console.log(`📧 Sending test email to ${email}...`);

  const content = renderTherapistProductUpdate({ name: 'Test-Therapeut:in' });

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Kaufmann Health <noreply@kaufmann-health.de>',
      to: email,
      subject: `[TEST] ${content.subject}`,
      html: content.html,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error('❌ Failed:', resp.status, body);
    process.exit(1);
  }

  const data = await resp.json();
  console.log('✅ Test email sent!');
  console.log('   ID:', data.id);
  console.log('   Subject:', content.subject);
}

main().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
