/*
 One-off deliverability/spam test sender using our real email template and Resend client.

 Usage examples:
   # Send to default list with default code
   RESEND_API_KEY=... tsx scripts/send-spam-test.ts

   # Override recipients and code
   RESEND_API_KEY=... tsx scripts/send-spam-test.ts --to="a@example.com,b@example.com" --code="mlrch-XXXX"

 Notes:
 - Sends INDIVIDUAL emails per recipient (so addresses are not exposed in To:).
 - Inserts the tracking code visibly near the top of the email body and appends it to the subject.
 - Requires RESEND_API_KEY in env. Uses LEADS_FROM_EMAIL/EMAIL_FROM_DEFAULT for sender.
*/

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { sendEmail } from '../src/lib/email/client';
import { renderPatientConfirmation } from '../src/lib/email/templates/patientConfirmation';

function loadEnv() {
  const cwd = process.cwd();
  const localPath = path.join(cwd, '.env.local');
  if (fs.existsSync(localPath)) {
    dotenv.config({ path: localPath });
  }
  // Fallback to standard .env as well
  dotenv.config();
}

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const DEFAULT_RECIPIENTS = [
  'vincent.vanhoot@outreachrs.com',
  'julia.mcgregus@smartemailers.com',
  'siobhan@reachsecret.com',
  'marion@reputationwarmup.com',
  'maeva.bonnet@landininbox.com',
  'samuel.moore@deliverabble.com',
  'thomas@inboxdoctors.com',
  'sholto@emailreach.co',
  'louis.thornton@reevercorp.com',
  'scarlett.burton@reeverflow.com',
  'klaus@teamtreet.com',
  'leah@akunaoutreach.com',
  'josh@mailreech.com',
  'lucas@outboundancy.com',
  'felipe.hernandez.p@leadsflowtrain.com',
  'elie.djemoun@dopetaste.com',
  'tom.maupard778@gmail.com',
  'rob.thomson238@gmail.com',
  'pete.jenkins9422@gmail.com',
  'debbie.bakos567@gmail.com',
  'rita.johnson2r@gmail.com',
  'steven.lester.925@gmail.com',
  'nick.downey.997@hotmail.com',
  'marisa.fernandes5192@hotmail.com',
  'abhishek.baska6252@hotmail.com',
  'eva.schokker43@outlook.com',
  'laura.dufreisne75013@outlook.com',
  'emma.pasano62@outlook.com',
  'an.chamberlain44@yahoo.com',
  'oliver.yikes43@yahoo.com',
];

const DEFAULT_CODE = 'mlrch-75ab1156732';

function injectTestCode(html: string, code: string): string {
  const marker = '<td style="padding:24px; font-family: Arial, sans-serif; line-height:1.6; color:#374151;">';
  // Insert the raw code as plain, visible text at the very top of the email body.
  const block = `<p data-test-code="true" style="margin:0 0 12px; color:#111827; font-size:14px; line-height:1.4;">${code}</p>`;
  if (html.includes(marker)) return html.replace(marker, marker + block);
  // Fallback: append before </body>
  return html.replace('</body>', `${block}</body>`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // Load env from .env.local (preferred) and .env
  loadEnv();
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is required in environment to send emails. Aborting.');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const code = (args['code'] || DEFAULT_CODE).trim();
  const toCsv = (args['to'] || '').trim();
  const recipients = toCsv
    ? toCsv.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_RECIPIENTS;

  // Render a real transactional template (patient confirmation) with benign sample data
  const { subject: baseSubject, html: baseHtml } = renderPatientConfirmation({
    name: 'Deliverability Test',
    city: 'Berlin',
    issue: 'Deliverability test email',
    sessionPreference: 'online',
  });

  const subject = `${baseSubject} [${code}]`;
  const html = baseHtml ? injectTestCode(baseHtml, code) : undefined;
  // Put the code as the very first line in the plain-text body
  const text = `${code}\n\nThis is a one-off deliverability test using our real patient confirmation template.`;

  console.log(`Preparing to send ${recipients.length} emails...`);
  let sent = 0;
  for (const to of recipients) {
    try {
      await sendEmail({ to, subject, html, text, context: { template: 'spam_test', code } });
      sent++;
      console.log(`Sent to ${to}`);
      // small delay to avoid potential rate limiting
      await sleep(250);
    } catch (e) {
      console.error(`Failed to send to ${to}:`, e);
    }
  }
  console.log(`Done. Successfully attempted ${sent}/${recipients.length}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
