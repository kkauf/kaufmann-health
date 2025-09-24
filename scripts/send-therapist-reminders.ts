/*
 Small helper to batch-trigger therapist profile reminders.

 Usage:
   CRON_SECRET=... BASE_URL=https://kaufmann-health.de npm run reminders:run -- --stage="Erinnerung" --limit=200

 Defaults:
   - BASE_URL: http://localhost:3000
   - stage: undefined
   - limit: 100
*/

import 'dotenv/config';

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const BASE_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    console.error('CRON_SECRET is required');
    process.exit(1);
  }
  const stage = args['stage'];
  const limit = Number(args['limit'] || 100);

  const url = `${BASE_URL.replace(/\/$/, '')}/api/admin/therapists/reminders`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': CRON_SECRET,
    },
    body: JSON.stringify({ stage, limit }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('Request failed:', res.status, res.statusText, text);
    process.exit(1);
  }
  console.log('Success:', text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
