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

import { writeFileSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { TEST0_POSITIONING_AB } from './private/campaign-config-test0-positioning';

const DRY_RUN = process.env.DRY_RUN !== 'false' && process.env.CONFIRM_APPLY !== 'true';

console.log('=== Test #0: Positioning A/B Campaign Creator ===');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
console.log('');

// Convert TypeScript config to JSON array format expected by create-campaigns.ts
const campaigns = [TEST0_POSITIONING_AB.variantA, TEST0_POSITIONING_AB.variantB];

// Write to temp file
const tempPath = path.join(__dirname, '.temp-test0-config.json');
writeFileSync(tempPath, JSON.stringify(campaigns, null, 2));
console.log(`Config written to: ${tempPath}`);
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
const args = ['--config=' + tempPath];

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
    console.log(`Note: Temp config at ${tempPath} can be deleted or kept for review`);
  } else {
    console.error(`\n✗ Campaign creation failed with code ${code}`);
    process.exit(code || 1);
  }
});
