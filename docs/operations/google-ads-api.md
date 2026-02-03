# Google Ads API Operations

## Overview
Programmatic campaign management for Kaufmann Health using the official Google Ads API. This supports:

- Test access and credentials verification
- One-off campaign creation from a typed config
- Ongoing monitoring with safe auto-pause rules

> **For conversion tracking architecture, see [docs/google-ads-conversions.md](../google-ads-conversions.md)**

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

### Create / Update Campaigns

```bash
# Dry-run (no writes, shows what would change)
npm run ads:create:dry -- --config=google_ads_api_scripts/private/<config>.json

# Apply changes
CONFIRM_APPLY=true npm run ads:create -- --config=google_ads_api_scripts/private/<config>.json

# Filter to specific campaigns
npm run ads:create:dry -- --config=...json --nameLike="TherapieFinden"
```

Details
- Reads campaign definitions from JSON config files in `google_ads_api_scripts/private/`.
- **Idempotent**: reuses existing budgets/campaigns by name, updates budget amounts and bidding strategy if config differs.
- For new campaigns: creates with PAUSED status, Search only (no partner/content).
- Creates ad groups per keyword tier with RSAs.
- Optional: set `ADS_SELECTIVE_OPTIMIZATION_NAME` to link a conversion action for selective optimization.

Environment
- `ads:create:dry` sets `DRY_RUN=true`. No writes are performed.
- `CONFIRM_APPLY=true` is required to actually write changes.
- The script runs a preflight (billing, language constant) before mutations.

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

Campaign configs live in `google_ads_api_scripts/private/` as JSON files using a `{ base, variants }` structure. The base defines shared defaults; each variant is a campaign that inherits from base and can override any field.

Active configs:
- `acquisition-winners-self-service.config.json` — TherapieFinden Berlin, Start, NARM Berlin, NARM Online
- `test5-online-restructured.config.json` — Online TherapieFinden (Germany-wide)

### Config structure

```json
{
  "base": {
    "budget_euros": 10,
    "landing_page": "https://...",
    "schedule": { "start": "2026-01-17", "end": "2026-12-31" },
    "languages": ["de"],
    "geo": { "mode": "berlin_proximity", "radius_km": 50 },
    "bidding": { "strategy": "MAXIMIZE_CONVERSIONS", "target_cpa_eur": 10.0 },
    "negativeKeywords": ["krankenkasse", "..."],
    "assets": { "sitelinks": [...], "structured_snippets": [...] },
    "ads": { "rsas_per_adgroup": 1, "path1": "psychotherapie" }
  },
  "variants": [
    {
      "name": "KH_Campaign_Name",
      "budget_euros": 25.0,
      "bidding": { "strategy": "MAXIMIZE_CONVERSIONS", "target_cpa_eur": 15.0 },
      "keywords": { "tier_name": { "maxCpc": 3.0, "terms": [...], "headlines": [...] } },
      "ads": { "path2": "finden" }
    }
  ]
}
```

### Merge behavior

| Field | Merge | Notes |
|-------|-------|-------|
| `bidding` | Replace | Variant fully replaces base bidding (must include strategy + CPA) |
| `ads` | Spread | Variant overrides individual fields, base fills the rest |
| `keywords`, `geo`, `languages` | Replace | Variant replaces base entirely |
| `assets` | Replace | Variant replaces base entirely |
| `budget_euros`, `name` | Replace | Per-variant |

### Bidding strategies

```json
// Maximize conversions with target CPA (recommended)
{ "strategy": "MAXIMIZE_CONVERSIONS", "target_cpa_eur": 10.0 }

// Maximize clicks with CPC ceiling
{ "strategy": "MAXIMIZE_CLICKS", "cpc_ceiling_eur": 3.0 }

// Manual CPC
{ "strategy": "MANUAL_CPC" }
```

The script ensures bidding matches config on every run — if the live campaign has different bidding, it updates to match. This makes the config the source of truth for bidding strategy and target CPA.

### Keyword echo (Quality Score)

Keywords landing on `/therapie-finden` or `/lp/narm` get their H1 echoed from the search term via `src/lib/ads-landing.ts`. This improves Quality Score by matching the landing page headline to the ad keyword. New keywords should be added to the `keywordToTitle` map in that file.

## Sitelinks

Sitelinks are configured in the campaign JSON config under `assets.sitelinks`. The create-campaigns script will:
1. Check for existing sitelinks by link_text (case-insensitive match)
2. Reuse existing sitelinks if text matches
3. Create new sitelinks if no match found
4. Attach all specified sitelinks to the campaign

**Important**: Sitelink URLs are immutable. To change a URL, create a new sitelink with different text.

Current active sitelinks (Jan 2026):
- **NARM** → /lp/narm (landing page)
- **SE Therapie** → /lp/somatic-experiencing (landing page)
- **Therapeutenverzeichnis** → /therapeuten (directory)
- **Direkt zum Aufnahmebogen** → /fragebogen (intake)

To list sitelinks and their attachments:
```bash
npx tsx google_ads_api_scripts/list-sitelinks.ts --nameLike="KH_Acq"
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

- Dedicated `/lp/traumatherapie` landing page for trauma keywords (PostClick QS fix)
- Keyword harvesting (auto-add converting search terms)
- Dayparting rules (pause during low-performing hours)
- Slack notifications for scale signals
