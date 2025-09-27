/*
 One-off deliverability test sender using our real email template and Resend client.

 Defaults are tuned for inbox placement testing (not cold outreach patterns):
 - No subject markers or visible injected codes by default
 - Caps recipients to 5 unless overridden with --max
 - Adds randomized per-send delay to avoid burst traffic

 Usage examples:
   # Send to default list (first 5 only), no marker
   RESEND_API_KEY=... tsx scripts/send-spam-test.ts

   # Override recipients and include an optional marker (appended at end of text only)
   RESEND_API_KEY=... tsx scripts/send-spam-test.ts --to="a@example.com,b@example.com" --marker="mlrch-XXXX" --max=10

 Notes:
 - Sends INDIVIDUAL emails per recipient (so addresses are not exposed in To:).
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

const DEFAULT_MARKER = '';

// Optional: append a small marker to the bottom of the HTML body for traceability
function appendMarker(html: string, marker?: string): string {
  const code = (marker || '').trim();
  if (!code) return html;
  const block = `<p data-test-marker="true" style="margin:16px 0 0; color:#9CA3AF; font-size:11px;">${code}</p>`;
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
  const marker = (args['marker'] || DEFAULT_MARKER).trim();
  const toCsv = (args['to'] || '').trim();
  const recipients = toCsv
    ? toCsv.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_RECIPIENTS;
  const max = Math.max(1, Number(args['max'] || 5));
  const limited = recipients.slice(0, max);

  // Render a real transactional template (patient confirmation) with benign sample data
  const { subject: baseSubject, html: baseHtml } = renderPatientConfirmation({
    name: 'Deliverability Test',
    city: 'Berlin',
    issue: 'Deliverability test email',
    sessionPreference: 'online',
  });

  const subject = baseSubject; // No subject marker by default
  const html = baseHtml ? appendMarker(baseHtml, marker) : undefined;
  // Place marker only in text (end) to avoid top-heavy signals
  const text = `This is a one-off deliverability test using our real patient confirmation template.${marker ? `\n\n${marker}` : ''}`;

  console.log(`Preparing to send ${limited.length} emails (cap=${max})...`);
  let sent = 0;
  for (const to of limited) {
    try {
      await sendEmail({ to, subject, html, text, context: { template: 'spam_test', marker } });
      sent++;
      console.log(`Sent to ${to}`);
      // randomized delay (600-1400ms) to avoid burst patterns
      const jitter = 600 + Math.floor(Math.random() * 800);
      await sleep(jitter);
    } catch (e) {
      console.error(`Failed to send to ${to}:`, e);
    }
  }
  console.log(`Done. Successfully attempted ${sent}/${limited.length}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
