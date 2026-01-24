/**
 * Therapist Outreach Campaign Script
 *
 * Sends personalized cold outreach emails to therapists from various directories.
 * Supports batched sending, follow-ups, and status tracking via Supabase.
 *
 * Usage:
 *   npx tsx scripts/outreach/send-outreach.ts import <json-file> <source>  # Import contacts
 *   npx tsx scripts/outreach/send-outreach.ts send [--limit=10] [--dry-run] # Send first emails
 *   npx tsx scripts/outreach/send-outreach.ts follow-up [--days=30] [--limit=10] [--dry-run]
 *   npx tsx scripts/outreach/send-outreach.ts status [--source=se_directory]
 *   npx tsx scripts/outreach/send-outreach.ts mark-replied <email>
 *   npx tsx scripts/outreach/send-outreach.ts mark-opted-out <email>
 *
 * See docs/private/outreach-system.md for full documentation.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'konstantin@kaufmann-health.de';
const FROM_NAME = 'Konstantin Kaufmann';
const REPLY_TO = 'partners@kaufmann-health.de';

const DEFAULT_DAILY_LIMIT = 10;
const DEFAULT_FOLLOW_UP_DAYS = 30;
const DELAY_BETWEEN_EMAILS_MS = 2000;

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

function getFirstEmailSubject(city: string): string {
  return `Eine Idee für Ihre Praxis in ${city}`;
}

function getFirstEmailHtml(firstName: string, lastName: string, city: string): string {
  const fullName = `${firstName} ${lastName}`.trim();
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .greeting { margin-bottom: 20px; }
    .section { margin-bottom: 16px; }
    .model-list { margin: 16px 0; padding-left: 0; }
    .model-list li { list-style: none; margin: 8px 0; }
    .model-list li:before { content: "•"; margin-right: 8px; color: #059669; }
    .highlight { background: #f0fdf4; padding: 12px 16px; border-radius: 8px; margin: 20px 0; }
    .cta { margin: 24px 0; }
    .cta a { color: #059669; }
    .footer { margin-top: 32px; color: #666; font-size: 14px; border-top: 1px solid #eee; padding-top: 16px; }
    .opt-out { margin-top: 24px; font-size: 13px; color: #999; font-style: italic; }
  </style>
</head>
<body>
  <p class="greeting">Guten Tag ${fullName},</p>

  <p class="section">ich bin auf Ihr Profil im SE-Therapeutenverzeichnis gestoßen und wollte Ihnen kurz Kaufmann Health vorstellen – eine Plattform zur Vermittlung von Klient:innen, die bewusst einen anderen Weg geht.</p>

  <p class="section">Die Idee entstand aus der Praxis heraus: Die Frau unseres Gründers ist selbst Körperpsychotherapeutin, und für sie stellte sich die Frage: Wie kann ich passende Klient:innen erreichen – ohne hohe Fixkosten oder ineffektive Verzeichnisse?</p>

  <p><strong>Unser Modell:</strong></p>
  <ul class="model-list">
    <li>Registrierung und Profil: kostenlos</li>
    <li>Keine Fixkosten, keine Abo-Gebühren</li>
    <li>25% Provision nur auf die ersten 10 Sitzungen</li>
    <li>Ab Sitzung 11: 0% – die Klient:innen-Beziehung gehört Ihnen</li>
  </ul>

  <div class="highlight">
    Bei 20 Sitzungen à 100€ behalten Sie 87,5% – bei typischen Plattformen wären es 60-75%, für immer.
  </div>

  <p class="section">Alle Details: <a href="https://www.kaufmann-health.de/fuer-therapeuten">kaufmann-health.de/fuer-therapeuten</a></p>

  <p class="cta">Wenn Sie Fragen haben oder ein kurzes Gespräch wünschen:<br>
  <a href="https://cal.kaufmann.health/josephine-kaufmann/intro">https://cal.kaufmann.health/josephine-kaufmann/intro</a></p>

  <p>Herzliche Grüße<br>
  Konstantin Kaufmann</p>

  <p class="opt-out">Falls diese Nachricht nicht relevant für Sie ist, ignorieren Sie sie einfach – Sie hören nicht erneut von uns.</p>
</body>
</html>
`;
}

function getFirstEmailText(firstName: string, lastName: string, city: string): string {
  const fullName = `${firstName} ${lastName}`.trim();
  return `Guten Tag ${fullName},

ich bin auf Ihr Profil im SE-Therapeutenverzeichnis gestoßen und wollte Ihnen kurz Kaufmann Health vorstellen – eine Plattform zur Vermittlung von Klient:innen, die bewusst einen anderen Weg geht.

Die Idee entstand aus der Praxis heraus: Die Frau unseres Gründers ist selbst Körperpsychotherapeutin, und für sie stellte sich die Frage: Wie kann ich passende Klient:innen erreichen – ohne hohe Fixkosten oder ineffektive Verzeichnisse?

Unser Modell:
• Registrierung und Profil: kostenlos
• Keine Fixkosten, keine Abo-Gebühren
• 25% Provision nur auf die ersten 10 Sitzungen
• Ab Sitzung 11: 0% – die Klient:innen-Beziehung gehört Ihnen

Bei 20 Sitzungen à 100€ behalten Sie 87,5% – bei typischen Plattformen wären es 60-75%, für immer.

Alle Details: https://www.kaufmann-health.de/fuer-therapeuten

Wenn Sie Fragen haben oder ein kurzes Gespräch wünschen:
https://cal.kaufmann.health/josephine-kaufmann/intro

Herzliche Grüße
Konstantin Kaufmann

Falls diese Nachricht nicht relevant für Sie ist, ignorieren Sie sie einfach – Sie hören nicht erneut von uns.`;
}

function getFollowUpSubject(city: string): string {
  return `Kurze Nachfrage: Körperpsychotherapie-Plattform für ${city}`;
}

function getFollowUpHtml(firstName: string, lastName: string, city: string): string {
  const fullName = `${firstName} ${lastName}`.trim();
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .cta a { color: #059669; }
    .footer { margin-top: 32px; color: #666; font-size: 14px; }
    .opt-out { margin-top: 24px; font-size: 13px; color: #999; font-style: italic; }
  </style>
</head>
<body>
  <p>Guten Tag ${fullName},</p>

  <p>ich hatte Ihnen vor einigen Wochen geschrieben und wollte kurz nachfragen, ob Sie meine Nachricht erhalten haben.</p>

  <p>Falls Sie gerade keine neuen Klient:innen suchen oder kein Interesse haben, verstehe ich das natürlich – dann ignorieren Sie diese Nachricht einfach.</p>

  <p>Falls das Thema für Sie doch interessant ist: Wir haben inzwischen weitere Therapeut:innen in ${city} aufgenommen und vermitteln aktiv Klient:innen, die gezielt nach Körperpsychotherapie suchen.</p>

  <p class="cta">Mehr Infos: <a href="https://www.kaufmann-health.de/fuer-therapeuten">kaufmann-health.de/fuer-therapeuten</a><br>
  Oder direkt ein kurzes Gespräch: <a href="https://cal.kaufmann.health/josephine-kaufmann/intro">Termin buchen</a></p>

  <p>Herzliche Grüße<br>
  Konstantin Kaufmann</p>

  <p class="opt-out">Sie erhalten diese Nachricht, weil wir Sie im SE-Therapeutenverzeichnis gefunden haben. Bei Desinteresse hören Sie nicht erneut von uns.</p>
</body>
</html>
`;
}

function getFollowUpText(firstName: string, lastName: string, city: string): string {
  const fullName = `${firstName} ${lastName}`.trim();
  return `Guten Tag ${fullName},

ich hatte Ihnen vor einigen Wochen geschrieben und wollte kurz nachfragen, ob Sie meine Nachricht erhalten haben.

Falls Sie gerade keine neuen Klient:innen suchen oder kein Interesse haben, verstehe ich das natürlich – dann ignorieren Sie diese Nachricht einfach.

Falls das Thema für Sie doch interessant ist: Wir haben inzwischen weitere Therapeut:innen in ${city} aufgenommen und vermitteln aktiv Klient:innen, die gezielt nach Körperpsychotherapie suchen.

Mehr Infos: https://www.kaufmann-health.de/fuer-therapeuten
Oder direkt ein kurzes Gespräch: https://cal.kaufmann.health/josephine-kaufmann/intro

Herzliche Grüße
Konstantin Kaufmann

Sie erhalten diese Nachricht, weil wir Sie im SE-Therapeutenverzeichnis gefunden haben. Bei Desinteresse hören Sie nicht erneut von uns.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  dryRun: boolean
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('  Missing RESEND_API_KEY');
    return false;
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would send to ${to}: "${subject}"`);
    return true;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        reply_to: REPLY_TO,
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  Email failed: ${err}`);
      return false;
    }

    console.log(`  ✅ Sent to ${to}`);
    return true;
  } catch (e) {
    console.error(`  Email error: ${e}`);
    return false;
  }
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      result[key] = value ?? true;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

interface Contact {
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  city: string;
  phone?: string;
  website?: string;
}

async function importContacts(jsonFile: string, source: string) {
  console.log(`\n=== Importing contacts from ${jsonFile} (source: ${source}) ===\n`);

  const filePath = path.resolve(jsonFile);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const contacts: Contact[] = JSON.parse(raw);

  console.log(`Found ${contacts.length} contacts in file`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const c of contacts) {
    if (!c.email) {
      console.log(`  Skipping (no email): ${c.fullName || c.firstName}`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from('outreach_contacts').upsert(
      {
        email: c.email.toLowerCase().trim(),
        first_name: c.firstName || null,
        last_name: c.lastName || null,
        full_name: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || null,
        city: c.city || null,
        phone: c.phone || null,
        website: c.website || null,
        source,
        status: 'pending',
      },
      { onConflict: 'email', ignoreDuplicates: true }
    );

    if (error) {
      console.error(`  Error importing ${c.email}: ${error.message}`);
      errors++;
    } else {
      imported++;
    }
  }

  console.log(`\nImport complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
}

async function sendFirstEmails(limit: number, dryRun: boolean, source?: string) {
  console.log(`\n=== Sending first emails (limit: ${limit}, dry-run: ${dryRun}) ===\n`);

  let query = supabase
    .from('outreach_contacts')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (source) {
    query = query.eq('source', source);
  }

  const { data: contacts, error } = await query;

  if (error) {
    console.error(`Error fetching contacts: ${error.message}`);
    process.exit(1);
  }

  if (!contacts || contacts.length === 0) {
    console.log('No pending contacts to send to');
    return;
  }

  console.log(`Found ${contacts.length} contacts to email\n`);

  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    const city = contact.city || 'Ihrer Stadt';
    const firstName = contact.first_name || '';
    const lastName = contact.last_name || '';

    console.log(`Processing: ${contact.email} (${city})`);

    const subject = getFirstEmailSubject(city);
    const html = getFirstEmailHtml(firstName, lastName, city);
    const text = getFirstEmailText(firstName, lastName, city);

    const success = await sendEmail(contact.email, subject, html, text, dryRun);

    if (success) {
      sent++;
      if (!dryRun) {
        await supabase
          .from('outreach_contacts')
          .update({ status: 'sent', first_sent_at: new Date().toISOString() })
          .eq('id', contact.id);
      }
    } else {
      failed++;
      if (!dryRun) {
        await supabase
          .from('outreach_contacts')
          .update({ status: 'bounced', notes: 'Failed to send first email' })
          .eq('id', contact.id);
      }
    }

    // Rate limiting
    if (contacts.indexOf(contact) < contacts.length - 1) {
      await sleep(DELAY_BETWEEN_EMAILS_MS);
    }
  }

  console.log(`\nComplete: ${sent} sent, ${failed} failed`);
}

async function sendFollowUps(days: number, limit: number, dryRun: boolean, source?: string) {
  console.log(`\n=== Sending follow-ups (${days}+ days since first email, limit: ${limit}) ===\n`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  let query = supabase
    .from('outreach_contacts')
    .select('*')
    .eq('status', 'sent')
    .lt('first_sent_at', cutoffDate.toISOString())
    .is('follow_up_1_sent_at', null)
    .order('first_sent_at', { ascending: true })
    .limit(limit);

  if (source) {
    query = query.eq('source', source);
  }

  const { data: contacts, error } = await query;

  if (error) {
    console.error(`Error fetching contacts: ${error.message}`);
    process.exit(1);
  }

  if (!contacts || contacts.length === 0) {
    console.log('No contacts ready for follow-up');
    return;
  }

  console.log(`Found ${contacts.length} contacts for follow-up\n`);

  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    const city = contact.city || 'Ihrer Stadt';
    const firstName = contact.first_name || '';
    const lastName = contact.last_name || '';

    console.log(`Processing: ${contact.email} (first sent: ${contact.first_sent_at})`);

    const subject = getFollowUpSubject(city);
    const html = getFollowUpHtml(firstName, lastName, city);
    const text = getFollowUpText(firstName, lastName, city);

    const success = await sendEmail(contact.email, subject, html, text, dryRun);

    if (success) {
      sent++;
      if (!dryRun) {
        await supabase
          .from('outreach_contacts')
          .update({
            status: 'followed_up',
            follow_up_1_sent_at: new Date().toISOString(),
          })
          .eq('id', contact.id);
      }
    } else {
      failed++;
    }

    if (contacts.indexOf(contact) < contacts.length - 1) {
      await sleep(DELAY_BETWEEN_EMAILS_MS);
    }
  }

  console.log(`\nComplete: ${sent} sent, ${failed} failed`);
}

async function showStatus(source?: string) {
  console.log(`\n=== Outreach Status ${source ? `(source: ${source})` : '(all sources)'} ===\n`);

  let query = supabase.from('outreach_contacts').select('status, source');
  if (source) {
    query = query.eq('source', source);
  }

  const { data: contacts, error } = await query;

  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }

  const stats: Record<string, Record<string, number>> = {};

  for (const c of contacts || []) {
    if (!stats[c.source]) {
      stats[c.source] = { total: 0 };
    }
    stats[c.source].total++;
    stats[c.source][c.status] = (stats[c.source][c.status] || 0) + 1;
  }

  for (const [src, counts] of Object.entries(stats)) {
    console.log(`\n${src}:`);
    console.log(`  Total:       ${counts.total}`);
    console.log(`  Pending:     ${counts.pending || 0}`);
    console.log(`  Sent:        ${counts.sent || 0}`);
    console.log(`  Followed up: ${counts.followed_up || 0}`);
    console.log(`  Replied:     ${counts.replied || 0}`);
    console.log(`  Opted out:   ${counts.opted_out || 0}`);
    console.log(`  Converted:   ${counts.converted || 0}`);
    console.log(`  Bounced:     ${counts.bounced || 0}`);
  }
}

async function markStatus(email: string, status: 'replied' | 'opted_out' | 'converted') {
  const timestampField =
    status === 'replied'
      ? 'replied_at'
      : status === 'opted_out'
        ? 'opted_out_at'
        : 'converted_at';

  const { error } = await supabase
    .from('outreach_contacts')
    .update({ status, [timestampField]: new Date().toISOString() })
    .eq('email', email.toLowerCase().trim());

  if (error) {
    console.error(`Error updating ${email}: ${error.message}`);
  } else {
    console.log(`✅ Marked ${email} as ${status}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);

  switch (command) {
    case 'import': {
      const jsonFile = rest.find((r) => !r.startsWith('--'));
      const source = rest.find((r, i) => !r.startsWith('--') && i > 0);
      if (!jsonFile || !source) {
        console.error('Usage: import <json-file> <source>');
        console.error('Example: import /tmp/se-berlin.json se_directory');
        process.exit(1);
      }
      await importContacts(jsonFile, source);
      break;
    }

    case 'send': {
      const limit = parseInt(String(args.limit), 10) || DEFAULT_DAILY_LIMIT;
      const dryRun = Boolean(args['dry-run']);
      const source = args.source as string | undefined;
      await sendFirstEmails(limit, dryRun, source);
      break;
    }

    case 'follow-up': {
      const days = parseInt(String(args.days), 10) || DEFAULT_FOLLOW_UP_DAYS;
      const limit = parseInt(String(args.limit), 10) || DEFAULT_DAILY_LIMIT;
      const dryRun = Boolean(args['dry-run']);
      const source = args.source as string | undefined;
      await sendFollowUps(days, limit, dryRun, source);
      break;
    }

    case 'status': {
      const source = args.source as string | undefined;
      await showStatus(source);
      break;
    }

    case 'mark-replied': {
      const email = rest.find((r) => !r.startsWith('--'));
      if (!email) {
        console.error('Usage: mark-replied <email>');
        process.exit(1);
      }
      await markStatus(email, 'replied');
      break;
    }

    case 'mark-opted-out': {
      const email = rest.find((r) => !r.startsWith('--'));
      if (!email) {
        console.error('Usage: mark-opted-out <email>');
        process.exit(1);
      }
      await markStatus(email, 'opted_out');
      break;
    }

    case 'mark-converted': {
      const email = rest.find((r) => !r.startsWith('--'));
      if (!email) {
        console.error('Usage: mark-converted <email>');
        process.exit(1);
      }
      await markStatus(email, 'converted');
      break;
    }

    default:
      console.log(`
Therapist Outreach Campaign Script

Commands:
  import <json-file> <source>     Import contacts from JSON file
  send [options]                  Send first emails to pending contacts
  follow-up [options]             Send follow-up emails
  status [--source=X]             Show campaign statistics
  mark-replied <email>            Mark contact as replied
  mark-opted-out <email>          Mark contact as opted out
  mark-converted <email>          Mark contact as converted

Send/Follow-up Options:
  --limit=N       Number of emails to send (default: 10)
  --dry-run       Preview without sending
  --source=X      Filter by source (e.g., se_directory)

Examples:
  npx tsx scripts/outreach/send-outreach.ts import /tmp/se-berlin.json se_directory
  npx tsx scripts/outreach/send-outreach.ts send --limit=10 --dry-run
  npx tsx scripts/outreach/send-outreach.ts send --limit=10
  npx tsx scripts/outreach/send-outreach.ts follow-up --days=30 --limit=5
  npx tsx scripts/outreach/send-outreach.ts status
  npx tsx scripts/outreach/send-outreach.ts mark-replied therapist@example.com
      `);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
