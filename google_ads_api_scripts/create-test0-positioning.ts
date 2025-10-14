#!/usr/bin/env tsx
/**
 * Test #0: Positioning A/B Test Campaign Creator
 * ================================================
 * Creates two campaigns:
 *  - Variant A (body-oriented): /start?variant=body-oriented
 *  - Variant B (ready-now): /start?variant=ready-now
 * 
 * Usage:
 *   DRY_RUN=true npm run ads:create:test0        # dry run (default)
 *   CONFIRM_APPLY=true npm run ads:create:test0  # apply changes
 * 
 * Budget: €250 per variant (€18/day each for 14 days)
 * Auto-pauses at €250 via monitor-campaigns.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { TEST0_POSITIONING_AB } from './private/campaign-config-test0-positioning';

const DRY_RUN = process.env.DRY_RUN !== 'false' && process.env.CONFIRM_APPLY !== 'true';

console.log('=== Test #0: Positioning A/B Campaign Creator ===');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
console.log('');

// Convert TypeScript config to JSON array format expected by create-campaigns.ts
// Apply Plan B overrides: €25/day for 10 days starting today
function fmt(d: Date) {
  const iso = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
  return iso.slice(0, 10);
}
const today = new Date();
const end = new Date(today);
end.setDate(end.getDate() + 10);

const campaigns = [TEST0_POSITIONING_AB.variantA, TEST0_POSITIONING_AB.variantB].map((c) => ({
  ...c,
  budget_euros: 25,
  schedule: { start: fmt(today), end: fmt(end) },
}));

// Write config into git-ignored private folder
const privateDir = path.join(__dirname, 'private');
try { mkdirSync(privateDir, { recursive: true }); } catch {}
const configPath = path.join(privateDir, 'test0-positioning.config.json');
writeFileSync(configPath, JSON.stringify(campaigns, null, 2));
console.log(`Config written to: ${configPath}`);
console.log('');

console.log('Campaign Summary:');
for (const c of campaigns) {
  console.log(`  - ${c.name}`);
  console.log(`    Budget: €${c.budget_euros}/day`);
  console.log(`    Landing: ${c.landing_page}`);
  console.log(`    Schedule: ${c.schedule.start} → ${c.schedule.end}`);
  console.log(`    Keyword groups: ${Object.keys(c.keywords).length}`);
  console.log('');
}

// Forward to unified create script
const createScriptPath = path.join(__dirname, 'create-campaigns.ts');
const args = ['--config=' + configPath];

const env = {
  ...process.env,
  DRY_RUN: DRY_RUN ? 'true' : 'false',
  CONFIRM_APPLY: DRY_RUN ? 'false' : 'true',
};

console.log('Forwarding to create-campaigns.ts...\n');

const proc = spawn('tsx', [createScriptPath, ...args], {
  stdio: 'inherit',
  env,
});

proc.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✓ Campaign creation completed');
    console.log(`Note: Config stored at ${configPath} (ignored by git)`);
  } else {
    console.error(`\n✗ Campaign creation failed with code ${code}`);
    process.exit(code || 1);
  }
});
