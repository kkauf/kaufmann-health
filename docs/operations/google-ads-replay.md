# Google Ads Enhanced Conversions Replay (Runbook)

Why
- Recover missed uploads/outages and backfill after config changes.
- Cookie-free, server-side hashed email. Safe to retry (dedupe via `order_id`).
- Backdating window: 63 days.

Where
- Full usage and environment details: [google_ads_api_scripts/README.md](../../google_ads_api_scripts/README.md)

Quick start
```bash
# Preview (no upload)
npm run reupload:leads -- --type=patient --dry-run

# Upload (last 63 days)
npm run reupload:leads -- --type=patient
npm run reupload:leads -- --type=therapist

# Useful flags
#   --since=YYYY-MM-DD  limit by date
#   --ids=uuid1,uuid2   specific leads
```
