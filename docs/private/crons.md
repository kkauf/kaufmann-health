# Scheduled Jobs (Crons) - Internal Reference

All cron jobs are configured in `vercel.json` and route through aggregator endpoints in `/api/cron/`.

## Schedule Overview

| Cron | Schedule | Frequency | Purpose |
|------|----------|-----------|---------|
| `cal-cache` | `*/10 * * * *` | Every 10 min | **CRITICAL**: Cal.com slot cache warming |
| `frequent` | `*/15 * * * *` | Every 15 min | Conversions backfill, system alerts, Cal.com webhook triggers |
| `cal-followups` | `*/30 * * * *` | Every 30 min | Booking follow-ups, cancellation recovery |
| `business-hours` | `0 7-20 * * *` | Hourly 7am-8pm | Therapist reminders, confirmation nudges |
| `morning-alerts` | `0 8 * * *` | Daily 8am | Ads monitoring, error digest, unmatched leads |
| `lead-nurturing` | `0 9 * * *` | Daily 9am | Document reminders, selection nudges |
| `lead-nurturing-late` | `30 10 * * *` | Daily 10:30am | Feedback requests, SMS cadence |
| `evening-alerts` | `0 20 * * *` | Daily 8pm | Ads monitoring, match quality report |
| `nightly` | `0 3 * * *` | Daily 3am | Booking reconciliation, ad spend sync |
| `weekly-friday` | `0 9 * * 5` | Fridays 9am | Therapist availability reminder |
| `weekly-monday` | `0 6 * * 1` | Mondays 6am | IndexNow SEO submission |
| `demand-digest` | `0 9 1 * *` | 1st of month 9am | Monthly therapist demand digest |

All times are UTC.

---

## Job Details by Aggregator

### `/api/cron/cal-cache` — Every 10 minutes
- `cal-warm-cache` → `/api/admin/cal/warm-cache`
- Fires `booking_system_down` critical alert on failure

### `/api/cron/frequent` — Every 15 minutes
- `conversions-backfill` → `/api/admin/leads/conversions/backfill?limit=200`
- `system-alerts` → `/api/admin/alerts/system?minutes=15`
- `cal-webhook-triggers` → `https://cal.kaufmann.health/api/cron/webhookTriggers?apiKey=$CAL_CRON_API_KEY`
  - External call to self-hosted Cal.com (not an internal KH route)
  - Fires MEETING_ENDED/MEETING_STARTED webhooks based on booking end/start times
  - Required because self-hosted Cal.com doesn't have its own cron scheduler
  - Processes `WebhookScheduledTriggers` table rows where `startAfter <= NOW()`
  - Skipped silently if `CAL_CRON_API_KEY` env var not set

### `/api/cron/cal-followups` — Every 30 minutes
- `booking-followups` → `/api/admin/cal/booking-followups?limit=50`
- `cancellation-recovery` → `/api/admin/cal/cancellation-recovery?limit=50`

### `/api/cron/business-hours` — Hourly 7am-8pm
- `therapist-action-reminders` → `/api/admin/matches/therapist-action-reminders?stage=20h`
- `confirmation-reminders` → `/api/admin/leads/confirmation-reminders?threshold=all&limit=200`

### `/api/cron/morning-alerts` — Daily 8am
- `ads-monitor-morning` → `/api/admin/ads/monitor?apply=false&lookback=3&excludeToday=true`
- `user-errors-digest` → `/api/admin/alerts/user-errors-digest`
- `unmatched-leads` → `/api/admin/alerts/unmatched-leads` (safety net: leads >24h with 0 matches/bookings)

### `/api/cron/lead-nurturing` — Daily 9am
- `therapist-document-reminders` → `/api/admin/therapists/document-reminders?limit=100`
- `therapist-reminders` → `/api/admin/therapists/reminders?limit=200`
- `rich-therapist-email` → `/api/admin/leads/rich-therapist-email?limit=200`
- `selection-nudge` → `/api/admin/leads/selection-nudge?limit=200`

### `/api/cron/lead-nurturing-late` — Daily 10:30am
- `feedback-request` → `/api/admin/leads/feedback-request?limit=200`
- `sms-cadence` → `/api/admin/leads/sms-cadence?limit=100`

### `/api/cron/evening-alerts` — Daily 8pm
- `ads-monitor-evening` → `/api/admin/ads/monitor?apply=false&lookback=1`
- `user-errors-digest` → `/api/admin/alerts/user-errors-digest`
- `match-quality-report` → `/api/admin/alerts/match-quality-report?days=1`
- ~~`new-leads`~~ — removed; covered by immediate notifications + daily `unmatched-leads` safety net

### `/api/cron/nightly` — Daily 3am
- `reconcile-bookings` → `/api/admin/cal/reconcile-bookings?days=7`
- `sync-spend` → `/api/admin/ads/sync-spend?days=1`

### `/api/cron/weekly-friday` — Fridays 9am
- `availability-reminder` → `/api/admin/therapists/availability-reminder?limit=100`

### `/api/cron/weekly-monday` — Mondays 6am
- `indexnow` → `/api/internal/indexnow`

### `/api/admin/therapists/demand-digest` — 1st of month 9am
- Direct endpoint (no aggregator)
- Sends monthly demand digest to active therapists
- Shows top patient demand vs therapist offerings
- Filters: `status=verified`, `cal_enabled=true`, `accepting_new=true`
- 28-day cooldown between sends
- Opt-out: `metadata.notifications.demand_digest_opt_out`

---

## Authentication

All KH cron endpoints require `Authorization: Bearer ${CRON_SECRET}` header.

The Cal.com webhook trigger uses a separate `CAL_CRON_API_KEY` (set in both Vercel and Railway).

```bash
# Manual testing - KH crons
curl -X POST "https://www.kaufmann-health.de/api/cron/frequent" \
  -H "Authorization: Bearer $CRON_SECRET"

# Manual testing - Cal.com webhook triggers directly
curl -X POST "https://cal.kaufmann.health/api/cron/webhookTriggers?apiKey=$CAL_CRON_API_KEY"
```
