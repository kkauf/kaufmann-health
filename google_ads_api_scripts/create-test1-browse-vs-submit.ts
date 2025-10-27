#!/usr/bin/env tsx
/**
 * Test #1: Browse vs Submit Campaign Creator
 * ==========================================
 * Creates a single campaign with two ad groups (Control/Browse) by
 * forwarding a JSON array of CampaignConfig to the unified creator.
 *
 * Usage:
 *   DRY_RUN=true npm run ads:create:test1:dry     # dry run (default)
 *   CONFIRM_APPLY=true npm run ads:create:test1   # apply changes
 *
 * Budget: €25/day per variant for 10 days starting 2025-10-29
 */

import { writeFileSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { TEST1_BROWSE_VS_SUBMIT } from './private/campaign-config-test1-browse-vs-submit';

const DRY_RUN = process.env.DRY_RUN !== 'false' && process.env.CONFIRM_APPLY !== 'true';

console.log('=== Test #1: Browse vs Submit Campaign Creator ===');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
console.log('');

// Convert TypeScript config to JSON array format expected by create-campaigns.ts
const campaigns = [TEST1_BROWSE_VS_SUBMIT.control, TEST1_BROWSE_VS_SUBMIT.browse];

// Write config into git-ignored private folder
const privateDir = path.join(__dirname, 'private');
try { mkdirSync(privateDir, { recursive: true }); } catch {}
const configPath = path.join(privateDir, 'test1-browse-vs-submit.config.json');
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
