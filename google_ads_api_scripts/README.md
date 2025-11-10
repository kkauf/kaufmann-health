# Google Ads Enhanced Conversions Replay

This folder contains operational scripts to (re)upload Google Ads Enhanced Conversions for Leads using our server-side pipeline.

Why this exists
- __Recover from outages__: If OAuth/token or network issues prevented uploads.
- __Backfill after configuration changes__: New conversion actions or mappings.
- __Cookie-free measurement__: Stays aligned with our policy “server-seitiges Tracking ohne Cookies” and Datenschutz disclosures. Uses hashed email only.

Key properties
- __Exact parity__: Uses the same hashing, time formatting, action alias mapping, and upload endpoint as `src/lib/google-ads.ts` in production.
- __Safe to retry__: Google deduplicates via `order_id` (we use `people.id`). Replays won’t double count.
- __Backdating window__: Up to 63 days for Enhanced Conversions for Leads.

## Script
`reupload-leads.ts` — replays conversions from the `people` table in Supabase.

- Patient leads → `client_registration` (EUR 10)
- Therapist leads → `therapist_registration` (EUR 25)

It derives:
- `email` → normalized + SHA-256 hex per Google spec
- `conversion_date_time` → UTC `YYYY-MM-DD HH:MM:SS+00:00` from `created_at`
- `order_id` → `people.id`

## Requirements
Create `.env.local` at the project root with at least:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"

# Google Ads OAuth + account
GOOGLE_ADS_CLIENT_ID=""
GOOGLE_ADS_CLIENT_SECRET=""
GOOGLE_ADS_REFRESH_TOKEN=""
GOOGLE_ADS_DEVELOPER_TOKEN=""
GOOGLE_ADS_CUSTOMER_ID="1234567890"
# Optional manager for some accounts
GOOGLE_ADS_LOGIN_CUSTOMER_ID="0987654321"

# Conversion action resource names (aliases → resources)
GOOGLE_ADS_CA_CLIENT_REGISTRATION="customers/XXX/conversionActions/AAA"
GOOGLE_ADS_CA_THERAPIST_REGISTRATION="customers/XXX/conversionActions/BBB"
```

OAuth helper
- If you need to generate a refresh token, use the private helper at:
  - `google_ads_api_scripts/private/auth/generate_refresh_token.py` (gitignored)

Notes
- If any mapping is missing, uploads are skipped and an error is logged with the expected env keys.
- The script reads `.env.local` before importing Supabase/Google Ads modules.

## Install
```bash
npm install
```

`tsx` is included as a dev dependency and is used by the npm script.

## Usage
Common commands:

```bash
# Dry-run (no upload), last 63 days by default
npm run reupload:leads -- --type=patient --dry-run
npm run reupload:leads -- --type=therapist --dry-run
npm run reupload:leads -- --type=all --dry-run

# Upload for last 63 days (default window)
npm run reupload:leads -- --type=patient
npm run reupload:leads -- --type=therapist
npm run reupload:leads -- --type=all

# Limit by date (ISO or YYYY-MM-DD)
npm run reupload:leads -- --type=all --since=2025-08-01

# Target specific leads by ID (comma-separated UUIDs)
npm run reupload:leads -- --ids=uuid1,uuid2,uuid3

# Adjust batch size (max 500 per batch)
npm run reupload:leads -- --type=all --batch=200
```

Flags
- `--type=patient|therapist|all` (default: `patient`)
- `--since=<ISO/Date>` used only when `--ids` not provided (default: last 63 days)
- `--ids=<uuid1,uuid2,...>` for explicit replay
- `--batch=<n>` batch size (default 100, max 500)
- `--dry-run` preview only

### Test API Access

Before running campaign automation, validate API credentials and permissions with:

```bash
npm run ads:test-access
```

Optionally also upload a test conversion:

```bash
npm run ads:test-access:upload
```

This performs:

- List up to 5 campaigns
- Search for conversion actions containing "lead"
- Create and delete a temporary campaign budget (`TEST_DELETE_ME_<timestamp>`) to verify write permissions

Requirements:

- Environment variables in `.env.local` (see Requirements above)
- Google Ads API access for the specified `GOOGLE_ADS_CUSTOMER_ID` (and `GOOGLE_ADS_LOGIN_CUSTOMER_ID` if using a manager)

Safety:

- The script creates a budget and immediately deletes it. No campaigns are created.

## Observability and Logs
The upload pipeline logs structured events to Supabase `events` via `src/lib/logger.ts`:

- `google_ads_uploaded` (info): `{ count, received, actions, order_ids }`
- `google_ads_partial_failure` (warn): `{ code, message, actions, order_ids }`
- `google_ads_noop` (info): missing config — `{ missing, actions, order_ids }`
- `google_ads_token_unavailable` (warn): OAuth/token problems
- `error` (error): with `stage` field: `get_access_token` or `upload_enhanced_conversions`

You can also verify in Google Ads UI: Goals → Conversions → action → uploads.

## Safety
- __Deduplication__: `order_id` prevents double counting on replays.
- __PII__: Only hashed email is sent to Google. We do not use cookies.
- __Backdating__: Keep within 63 days or Google may reject late conversions.

## Troubleshooting
- __Missing conversion action mapping__:
  - Ensure `GOOGLE_ADS_CA_CLIENT_REGISTRATION` / `GOOGLE_ADS_CA_THERAPIST_REGISTRATION` are set to resource names.
- __Token/Network errors__:
  - Check OAuth credentials and network. The client retries transient timeouts.
- __Partial failures (code/message)__:
  - Inspect `google_ads_partial_failure` logs for error codes (e.g., invalid payloads, time window issues).
- __Zero uploads__:
  - Verify filters (`--since`, `--type`) and that `people.email` exists and `type` ∈ {`patient`,`therapist`}.

## When to use
- After outages visible as `google_ads_token_unavailable` or `upload_error`.
- After adding/changing conversion action mappings.
- To re-send specific IDs requested by Ads support.

## Alternatives
- Google Ads Data Manager (CSV/Sheets) upload. Not used here to guarantee parity with our production hashing/formatting and to retain programmatic dedupe via `order_id`.

## Campaign Monitoring & Auto-Pause (EARTH-157)

`monitor-campaigns.ts` — queries Google Ads for spend/conversions over a window and identifies underperforming campaigns. By default it runs in DRY RUN and prints candidates. Use `--apply` to pause.

Prerequisites:

- Same environment setup as above (OAuth + account variables in `.env.local`).
- Optional: validate access first with `npm run ads:test-access`.

Usage:

```bash
# Dry-run (default)
npm run ads:monitor

# Limit to campaigns with name containing a term (e.g., Week 38)
npm run ads:monitor -- --nameLike="Week 38"

# Apply pauses (be careful)
npm run ads:monitor:apply -- --nameLike="Week 38"

# Customize window and thresholds
npm run ads:monitor -- --lookback=3 --excludeToday=true \
 --minSpendNoConv=30 --cpaThreshold=40 --budgetMultiple=2
```

Flags:

- `--lookback=<days>` lookback window (default: `3`)
- `--excludeToday=true|false` exclude today's partial data (default: `true`)
- `--minSpendNoConv=<€>` pause if spend ≥ this and 0 conversions (default: `30`)
- `--cpaThreshold=<€>` warn (report only) if CPA > threshold (default: `40`)
- `--budgetMultiple=<n>` pause if spend > n × daily budget with 0 conversions (default: `2`)
- `--nameLike=<substring>` only consider campaigns whose name contains this (optional)
- `--apply` actually pause matching campaigns (omit for dry-run)

Notes:

- The script only targets ENABLED SEARCH campaigns.
- Pauses use the official API: `campaign.status = PAUSED`.
- Start with dry-run and `--nameLike` to scope changes, then apply.

## Inspect Campaigns & Ads

Quick insights into campaigns, ads, policy, and bidding:

```bash
# Campaign overview (dates, budgets, languages, adgroup counts)
npm run ads:inspect -- --show=campaigns --nameLike=Positioning_Test

# Ads with policy details for specific campaigns
npm run ads:inspect:ads -- --names=KH_BodyOriented_Positioning_Test_A,KH_ReadyNow_Positioning_Test_B

# Bidding/strategy and budget details
npm run ads:inspect:bids -- --nameLike=Browse_vs_Submit
```

## Unified Campaign Creation

`create-campaigns.ts` — unified CLI that creates Search campaigns from a JSON array config. It forwards configuration to the battle‑tested engine under the hood and will fully replace the legacy scripts.

Commands

```bash
# Validate only (no writes)
npm run ads:create:dry -- --config=google_ads_api_scripts/private/your-campaigns.json

# Apply changes (creates/updates resources; campaigns start PAUSED)
CONFIRM_APPLY=true npm run ads:create -- --config=google_ads_api_scripts/private/your-campaigns.json
```

Config sources
- `--config=/abs/path/to/file.json` or `ADS_CONFIG_PATH`
- `ADS_CONFIG_JSON='[ ... ]'` (highest priority)
- Embedded samples are disabled by default; enable only with `ALLOW_EMBEDDED_ADS_CONFIG=true`

Optional filters
- `--nameLike="Berlin"` to subset by campaign name
- `--adgroups="core,expansion"` to limit which tiers to apply

What it does
- Idempotent by campaign name; ensures dedicated budgets and updates existing campaigns
- Search‑only network
- Optional languages and geo via JSON (no enforced defaults)
- Optional sitelinks, selective optimization, and geo modes (national Germany via ID 2276, or Berlin proximity)
- AdGroups per keyword tier; adds missing keywords with policy‑aware replacements
- Creates up to 2 RSAs per AdGroup; supports URL params (e.g., `?v=C`)

Minimal JSON example

```json
[
  {
    "name": "CONSCIOUS WELLNESS – DE",
    "budget_euros": 150,
    "landing_page": "https://www.kaufmann-health.de/ankommen-in-dir",
    "schedule": { "start": "2025-10-01", "end": "2025-10-15" },
    "keywords": {
      "core": { "maxCpc": 2.5, "terms": ["körpertherapie online", "somatic experiencing"] }
    },
    "negativeKeywords": ["krankenkasse", "jobs", "ausbildung"],
    "ads": {
      "final_url_params": { "v": "C" },
      "headlines": ["80–120€ pro Sitzung", "Therapie ohne Krankenkasseneintrag", "Körperorientierte Begleitung"],
      "descriptions": ["Jetzt passende Begleitung finden.", "Vertraulich. Persönlich. Online."],
      "rsas_per_adgroup": 2
    }
  }
]
```

Safety
- Start with dry‑run and `VALIDATE_ONLY=true` if desired
- Apply only with `CONFIRM_APPLY=true`
- Private JSON configs should live in `google_ads_api_scripts/private/` (git‑ignored)

Notes
- RSA fallbacks come only from `private/ad-templates.local.json` (or `ad-templates.json`). No in‑code default headlines/descriptions exist.

### Modules

- `lib/util.ts` → common helpers (`requireEnv`, URL/path utils, text utils)
- `lib/assets.ts` → sitelinks/callouts/snippets/images create + attach
- `lib/adgroups.ts` → ad group ensure, keyword add/bid helpers
- `lib/campaign.ts` → budgets, campaign ops, negatives, optional languages/geo
- `lib/rsa.ts` → RSA asset prep and ad creation

### Using JSON configs (private)

Use existing private configs directly with the creator:

```bash
# Test 0
npm run ads:create:dry -- --config=google_ads_api_scripts/private/test0-positioning.config.json
CONFIRM_APPLY=true npm run ads:create -- --config=google_ads_api_scripts/private/test0-positioning.config.json
```

## Unified Export (General Reports)

Use the unified exporter for common reports. Outputs are date‑prefixed CSVs in `google_ads_api_scripts/private/exports/`.

```bash
# Typical (keywords + assets + labels)
npm run ads:export -- --nameLike=Positioning_Test --since=2025-10-01

# Everything
npm run ads:export:all -- --nameLike=Browse_vs_Submit
```

Modules
- `keywords` → `*_keyword_raw.csv`, `*_keyword_perf.csv`
- `assets` → `*_asset_headline_perf.csv`, `*_asset_description_perf.csv`, `*_asset_sitelink_perf.csv`
- `search_terms` → `*_search_terms.csv`
- `adgroups` → `*_adgroup_perf.csv`
- `asset_labels` → `*_asset_labels.csv`

Flags
- `--modules=keywords,assets,search_terms,adgroups,asset_labels`
- `--since=YYYY-MM-DD`, `--until=YYYY-MM-DD`, `--nameLike=...`, `--outDir=...`

 
