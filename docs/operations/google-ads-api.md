# Google Ads API Operations

## Overview
Programmatic campaign management for Kaufmann Health using the official Google Ads API. This supports:

- Test access and credentials verification
- One-off campaign creation from a typed config
- Ongoing monitoring with safe auto-pause rules
- Server-side Enhanced Conversions for Leads (hashed email only)

This document focuses on operational usage: how to run scripts safely, what to watch for, and the boundaries we keep for privacy and reliability.

## Setup

Create `.env.local` at the project root with the following (reusing values from server-side Enhanced Conversions setup):

```bash
# Google Ads OAuth + account
GOOGLE_ADS_CLIENT_ID=""
GOOGLE_ADS_CLIENT_SECRET=""
GOOGLE_ADS_REFRESH_TOKEN=""
GOOGLE_ADS_DEVELOPER_TOKEN=""
GOOGLE_ADS_CUSTOMER_ID="1234567890"
# Optional: use if the customer is under an MCC/manager
GOOGLE_ADS_LOGIN_CUSTOMER_ID="0987654321"

# Optional: for campaign creation (link a specific conversion action to campaign selective optimization)
# When set, the creation script will link this exact conversion action by name.
ADS_SELECTIVE_OPTIMIZATION_NAME="client_registration"
```

Notes
- Place secrets in `.env.local` (not committed). The scripts auto-load `.env.local` and fallback to `.env`.
- Conversion action resource names for Enhanced Conversions are configured in the app via `GOOGLE_ADS_CA_*` and are not required for monitoring/creation.

### API Access Level
Using Basic Access. The default Google Ads API basic limit is 15,000 operations/day, which is sufficient at our current scale. If we approach limits (bulk edits across many entities), consider spacing operations with small delays or batching.

## Scripts

All commands are defined in `package.json` and executed from the project root.

### Test Access

```bash
npm run ads:test-access
```

Verifies credentials and write permissions (creates and immediately deletes a temporary budget). See `google_ads_api_scripts/test-access.ts`.

### Create Campaigns (Week 38 template)

```bash
# Validate-only (no writes)
npm run ads:create:dry

# Apply changes (creates resources)
npm run ads:create
```

Details
- Reads campaign definitions from `google_ads_api_scripts/campaign-config.ts` (Week 38 template).
- Idempotent by campaign name (reuses budget if present, updates dates/network on existing campaign).
- Applies safe defaults: PAUSED status, Germany location, German language, Search only (no partner/content), sitelinks (Preise, FAQ).
- Creates ad groups per keyword tier and two RSA variants (A/B). Landing pages receive `?v=A` or `?v=B`.
- Optional: set `ADS_SELECTIVE_OPTIMIZATION_NAME` to link a conversion action for selective optimization.

Environment
- `ads:create:dry` sets `DRY_RUN=true`, which enables validate-only mode. No writes are performed.
- For `ads:create`, ensure all required env vars are present. The script runs a preflight (billing, language constant) before mutations.

### Monitor Performance (Auto-Pause)

```bash
# Dry run (no changes)
npm run ads:monitor

# Apply pauses for matching candidates
npm run ads:monitor:apply -- --nameLike="Week 38"
```

Default thresholds (see `google_ads_api_scripts/monitor-campaigns.ts`)
- Auto-pause when spend ≥ €30 and 0 conversions
- Auto-pause when spend > 2× daily budget and 0 conversions
- Warn only when CPA > €40 (no auto-pause)
- Window: last 3 full days by default (excludes today, configurable)
- Scope: ENABLED SEARCH campaigns only; optional `--nameLike="…"` to filter

Flags
- `--lookback=<days>` default 3
- `--excludeToday=true|false` default true
- `--minSpendNoConv=<€>` default 30
- `--cpaThreshold=<€>` default 40 (warn only)
- `--budgetMultiple=<n>` default 2
- `--nameLike=<substring>` optional filter
- `--apply` apply changes (only needed if calling the script directly; the npm script sets this for you)

Safety
- Start with dry run and name scoping.
- Only campaigns in `ENABLED` state are considered.

## Campaign Configuration

Edit `google_ads_api_scripts/campaign-config.ts` to change:

- Names: `CONSCIOUS WELLNESS SEEKERS - Week 38`, `DEPTH SEEKERS - Week 38`
- Budgets: €200/day (wellness), €100/day (depth)
- Schedules: Week 38 dates
- Keyword tiers and negatives
- Headlines/descriptions used for A/B RSA variants

Example (excerpt):

```ts
export const WEEK38_CONFIG = {
  wellness: {
    name: 'CONSCIOUS WELLNESS SEEKERS - Week 38',
    budget_euros: 200,
    landing_page: 'https://www.kaufmann-health.de/ankommen-in-dir',
    schedule: { start: '2025-09-18', end: '2025-09-22' },
    // ...
  },
  depth: {
    name: 'DEPTH SEEKERS - Week 38',
    budget_euros: 100,
    landing_page: 'https://www.kaufmann-health.de/wieder-lebendig',
    schedule: { start: '2025-09-20', end: '2025-09-21' },
    // ...
  }
}
```

## Daily Operations Checklist

- Morning (9:00)
  - Run `npm run ads:monitor` and review candidates
  - Review any paused campaigns in the Ads UI
  - Adjust bids only if necessary
- Midday (13:00)
  - Run `npm run ads:monitor`
  - Review search terms; add negatives if needed
- Evening (17:00)
  - Run `npm run ads:monitor`
  - Log notable outcomes in the Battle Plan
  - Prepare the next day's adjustments

## Privacy & Measurement Boundaries

- No tracking cookies. Public site remains cookie-free by design.
- Enhanced Conversions for Leads are triggered server-side after patient email confirmation (status transition to `new`) to avoid premature counting, per EARTH-146.
- PII policy: only hashed email is sent to Google Ads. No names, IP addresses, or cookies are included.

## Troubleshooting

- PERMISSION_DENIED
  - Verify developer token approval and correct customer ID
  - Ensure OAuth refresh token scope is valid
- RESOURCE_NOT_FOUND
  - The entity may have been removed or is under a different customer
  - Double-check resource name formats and IDs
- Rate limits
  - Basic access is typically sufficient. For bulk edits, space operations or batch requests.

## Future Enhancements

- Automated bid adjustments based on CPA/volume
- Keyword harvesting (auto-add converting search terms)
- Dayparting rules (pause during low-performing hours)
- Slack notifications for scale signals
- Reusable multi-week campaign templates
