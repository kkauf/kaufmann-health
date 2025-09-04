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

- Patient leads → `patient_registration` (EUR 10)
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
GOOGLE_ADS_CA_PATIENT_REGISTRATION="customers/XXX/conversionActions/AAA"
GOOGLE_ADS_CA_THERAPIST_REGISTRATION="customers/XXX/conversionActions/BBB"
```

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
  - Ensure `GOOGLE_ADS_CA_PATIENT_REGISTRATION` / `GOOGLE_ADS_CA_THERAPIST_REGISTRATION` are set to resource names.
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
