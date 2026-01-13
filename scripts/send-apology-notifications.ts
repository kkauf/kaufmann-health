/**
 * Send apology emails/SMS to patients affected by the Jan 11-13 matching bug.
 * 
 * Usage: npx tsx scripts/send-apology-notifications.ts [--dry-run]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '+4915906549998';

// Affected patients with their rebuilt match URLs
const AFFECTED_PATIENTS = [
  { id: '98589ffb-6b7d-4992-8c3e-36b1d03aa39e', name: 'Enes', contact: 'phone', url: 'https://kaufmann-health.de/matches/8fe465a9-f2e6-448d-8f65-40faf10397a9' },
  { id: '7e2bfbd9-1ddf-4261-891a-5701ea352887', name: 'Kamy', contact: 'email', url: 'https://kaufmann-health.de/matches/c587dcce-c854-47a3-ba2b-5b662bb4fc46' },
  { id: '78b9a2c7-b696-49f5-81e7-e22f3b621092', name: 'Cinzia Buemi', contact: 'email', url: 'https://kaufmann-health.de/matches/62a04244-aba8-490b-b3d6-44c869f958b6' },
  { id: '4ecbfc10-419c-4ef4-8fb4-317df7db09b2', name: 'Laura Teschner', contact: 'phone', url: 'https://kaufmann-health.de/matches/5938c78d-8455-4bf6-b167-c473abce1534' },
  { id: '03e94443-f07c-4236-a0b1-bbab8c3eb8bb', name: 'Lucien', contact: 'email', url: 'https://kaufmann-health.de/matches/4e6a1122-1eb7-4be1-bb49-b55bdff7144a' },
  { id: '34fc6775-5f22-4d98-a421-c579b6d4e8ba', name: 'Hansi', contact: 'phone', url: 'https://kaufmann-health.de/matches/7ef3ff33-c50b-4752-8b5e-8b14e73bf9d9' },
  { id: '9948fcf2-14f8-47a7-b637-d4a51495c4a6', name: 'Ina', contact: 'email', url: 'https://kaufmann-health.de/matches/9b9ab872-faca-48ea-9a7c-6e2ea6f37729' },
];

function getApologyEmailHtml(name: string, matchUrl: string): string {
  const firstName = name.split(' ')[0];
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { color: #059669; font-size: 24px; margin-bottom: 20px; }
    .button { display: inline-block; background: #059669; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 500; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">Kaufmann Health</div>
  
  <p>Liebe/r ${firstName},</p>
  
  <p>wir möchten uns aufrichtig bei dir entschuldigen. Durch einen technischen Fehler in unserem System konnten wir dir leider nicht sofort passende Therapeut:innen anzeigen.</p>
  
  <p><strong>Das haben wir jetzt behoben.</strong> Wir haben deine Therapeuten-Vorschläge neu generiert – basierend auf deinen Präferenzen findest du jetzt passende Therapeut:innen, die für dich ausgewählt wurden.</p>
  
  <p style="text-align: center;">
    <a href="${matchUrl}" class="button">Deine Therapeut:innen ansehen</a>
  </p>
  
  <p>Du kannst direkt ein <strong>kostenloses 15-minütiges Kennenlerngespräch</strong> buchen – unverbindlich und ohne Risiko. So kannst du herausfinden, ob die Chemie stimmt.</p>
  
  <p>Falls du Fragen hast oder Unterstützung bei der Auswahl brauchst, sind wir jederzeit für dich da. Antworte einfach auf diese E-Mail.</p>
  
  <p>Nochmals entschuldige die Unannehmlichkeiten – wir wissen, wie wichtig es ist, schnell die richtige Unterstützung zu finden.</p>
  
  <p>Herzliche Grüße,<br>
  Dein Kaufmann Health Team</p>
  
  <div class="footer">
    <p>Kaufmann Health<br>
    <a href="https://kaufmann-health.de">kaufmann-health.de</a></p>
  </div>
</body>
</html>
`;
}

function getApologyEmailText(name: string, matchUrl: string): string {
  const firstName = name.split(' ')[0];
  return `Liebe/r ${firstName},

wir möchten uns aufrichtig bei dir entschuldigen. Durch einen technischen Fehler in unserem System konnten wir dir leider nicht sofort passende Therapeut:innen anzeigen.

Das haben wir jetzt behoben. Wir haben deine Therapeuten-Vorschläge neu generiert – basierend auf deinen Präferenzen findest du jetzt passende Therapeut:innen, die für dich ausgewählt wurden.

Deine Therapeut:innen ansehen: ${matchUrl}

Du kannst direkt ein kostenloses 15-minütiges Kennenlerngespräch buchen – unverbindlich und ohne Risiko.

Falls du Fragen hast, sind wir jederzeit für dich da. Antworte einfach auf diese E-Mail.

Herzliche Grüße,
Dein Kaufmann Health Team`;
}

function getApologySmsText(name: string, matchUrl: string): string {
  const firstName = name.split(' ')[0];
  return `Hallo ${firstName}, Entschuldigung für die Verzögerung! Wir hatten einen technischen Fehler. Hier ist deine Therapeutenauswahl: ${matchUrl} - Kaufmann Health`;
}

async function sendEmail(to: string, name: string, matchUrl: string, dryRun: boolean): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('  Missing RESEND_API_KEY');
    return false;
  }

  const html = getApologyEmailHtml(name, matchUrl);
  const text = getApologyEmailText(name, matchUrl);

  if (dryRun) {
    console.log(`  [DRY RUN] Would send email to ${to}`);
    return true;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kaufmann Health <team@kaufmann-health.de>',
        to: [to],
        subject: 'Deine Therapeut:innen – Entschuldigung für die Verzögerung',
        html,
        text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  Email failed: ${err}`);
      return false;
    }

    console.log(`  ✅ Email sent to ${to}`);
    return true;
  } catch (e) {
    console.error(`  Email error: ${e}`);
    return false;
  }
}

async function sendSms(to: string, name: string, matchUrl: string, dryRun: boolean): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('  Missing TWILIO credentials');
    return false;
  }

  const message = getApologySmsText(name, matchUrl);

  if (dryRun) {
    console.log(`  [DRY RUN] Would send SMS to ${to}: "${message}"`);
    return true;
  }

  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: TWILIO_FROM_NUMBER,
          Body: message,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`  SMS failed: ${err}`);
      return false;
    }

    console.log(`  ✅ SMS sent to ${to}`);
    return true;
  } catch (e) {
    console.error(`  SMS error: ${e}`);
    return false;
  }
}

async function main(dryRun: boolean) {
  console.log(`\n=== Send Apology Notifications ${dryRun ? '(DRY RUN)' : ''} ===\n`);

  const results: { name: string; type: string; status: string }[] = [];

  for (const patient of AFFECTED_PATIENTS) {
    console.log(`\nProcessing ${patient.name} (${patient.contact})...`);

    // Get contact details
    const { data: person } = await supabase
      .from('people')
      .select('email, phone_number')
      .eq('id', patient.id)
      .single();

    if (!person) {
      console.error(`  Patient not found`);
      results.push({ name: patient.name, type: patient.contact, status: 'not_found' });
      continue;
    }

    if (patient.contact === 'email') {
      const email = person.email;
      if (!email || email.startsWith('temp_')) {
        console.error(`  No valid email`);
        results.push({ name: patient.name, type: 'email', status: 'no_email' });
        continue;
      }

      const success = await sendEmail(email, patient.name, patient.url, dryRun);
      results.push({ name: patient.name, type: 'email', status: success ? 'sent' : 'failed' });
    } else {
      const phone = person.phone_number;
      if (!phone) {
        console.error(`  No phone number`);
        results.push({ name: patient.name, type: 'sms', status: 'no_phone' });
        continue;
      }

      const success = await sendSms(phone, patient.name, patient.url, dryRun);
      results.push({ name: patient.name, type: 'sms', status: success ? 'sent' : 'failed' });
    }
  }

  // Summary
  console.log('\n=== Summary ===\n');
  for (const r of results) {
    console.log(`${r.name.padEnd(17)} | ${r.type.padEnd(5)} | ${r.status}`);
  }

  const sent = results.filter(r => r.status === 'sent').length;
  console.log(`\nTotal sent: ${sent}/${results.length}`);
}

const dryRun = process.argv.includes('--dry-run');
main(dryRun).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
