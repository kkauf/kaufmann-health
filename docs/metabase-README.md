# Metabase Dashboard – Setup & Runbook

> **Metabase URL**: https://metabase-production-c3d3.up.railway.app

## File Structure

| File | Purpose |
|------|---------|
| `metabase-kpis.md` | Single-value cards for the main KPI dashboard |
| `metabase-detail.md` | Trends, funnels, attribution, operational queries |
| `metabase-README.md` | This file – setup instructions and runbook |

---

## Syncing Queries to Metabase

Queries can be synced automatically via API using the sync script.

### Prerequisites

1. Set `METABASE_API_KEY` in `.env.local` (requires admin permissions)
2. Ensure you have the latest query files

### Commands

```bash
# Preview what would be created/updated (dry run)
npx tsx scripts/metabase-sync.ts --dry-run

# Sync all queries to Metabase
npx tsx scripts/metabase-sync.ts --sync

# List existing Metabase saved questions
npx tsx scripts/metabase-sync.ts --list
```

### How the Sync Works

1. Parses all `### QueryName` + ` ```sql` blocks from the markdown files
2. Creates saved questions in Metabase using section names as titles
3. Updates existing questions if names match exactly
4. Auto-configures `{{days_back}}` variable with default `28`

### After Syncing

- Add questions to dashboards manually in Metabase UI
- Navigate to: **+** → **Saved Questions** → search by query name

---

## Manual Card Creation

If the sync script doesn't work or you prefer manual setup:

### 1. Create a New Question

1. Go to Metabase → **New** → **SQL Query**
2. Copy the SQL from the relevant `.md` file
3. Click **Save** → name it exactly as the `### Header` in the file
4. Set the variable default: click `{{days_back}}` → set default to `28`

### 2. Add to Dashboard

1. Open your dashboard → **Edit**
2. Click **+** → **Saved Questions**
3. Search for your query name → Add
4. Resize and position as needed

### 3. Configure Visualization

| Query Type | Recommended Viz |
|------------|-----------------|
| Single value (e.g., `D-Leads`) | Number/Gauge |
| Daily trend (e.g., `T-LeadsDaily`) | Line chart |
| Funnel (e.g., `F-CoreFunnel`) | Funnel or Table |
| Breakdown (e.g., `F-TrafficByEntry`) | Bar chart |
| List (e.g., `M-LowQualityPatients`) | Table |

---

## Dashboard Layout Recommendations

### KPI Dashboard (Main)

```
┌─────────────────────────────────────────────────────────┐
│                    NS-Sessions (large)                  │
├──────────┬──────────┬──────────┬──────────┬────────────┤
│ D-Leads  │ D-CPL    │ D-Form   │ D-Lead   │ D-Intro    │
│          │          │ Compl%   │ ToIntro% │ ToSession% │
├──────────┴──────────┴──────────┼──────────┴────────────┤
│ D-IntrosThisWeek               │                       │
├────────────┬───────────────────┼───────────────────────┤
│ S-CalLive  │ S-Availability%   │ S-FallbackRate        │
├────────────┼───────────────────┼───────────────────────┤
│ U-CAC      │ U-AvgSessions     │ U-CLV                 │
└────────────┴───────────────────┴───────────────────────┘
```

### Funnel Dashboard

- F-TrafficByEntry → Horizontal bar
- F-ConversionByPath → Bar chart (side-by-side)
- F-CoreFunnel → Funnel chart
- F-StepByStep → Table with drop-off %

### Trends Dashboard

- T-LeadsDaily + T-SessionsDaily → Overlaid line charts
- T-FormCompletionDaily → Line chart (completion_rate_pct)

---

## Setting Up Alerts

1. Create a saved question for the alert query (e.g., `Alert-NoIntros3Days`)
2. Open the question → **Sharing** → **Alerts**
3. Set condition: "When results are 1"
4. Set recipients and frequency

### Recommended Alerts

| Alert | Condition | Check Frequency |
|-------|-----------|-----------------|
| `Alert-NoIntros3Days` | result = 1 | Daily |
| `Alert-LowAvailability` | result = 1 | Daily |
| `Alert-HighFallback` | result = 1 | Daily |

---

## Dashboard Filter Setup

1. Edit dashboard → **Add a filter**
2. Choose "Number"
3. Name it "Days Back"
4. Connect to all questions that use `{{days_back}}`
5. Set default value: 28
6. Add quick options: 7, 14, 28, 90

---

## Troubleshooting

### Query Returns No Data

- Check the `{{days_back}}` value – may need to increase for sparse data
- Verify test exclusions aren't filtering too aggressively
- Check if the underlying table has data (e.g., `cal_bookings` may be empty early on)

### Sync Script Fails

```bash
# Check API key is set
echo $METABASE_API_KEY

# Verify connectivity
curl -H "X-Metabase-Session: $METABASE_API_KEY" \
  https://metabase-production-c3d3.up.railway.app/api/user/current
```

### Variable Not Working

- Ensure query uses `{{days_back}}` (with double braces)
- In Metabase, click the variable pill and set a default value

---

## Data Model Reference

| Concept | Table/Filter |
|---------|--------------|
| Leads | `people` WHERE `type = 'patient'` |
| Confirmed leads | status NOT IN `('pre_confirmation', 'anonymous', 'email_confirmation_sent')` |
| Test exclusion (people) | `metadata->>'is_test' IS DISTINCT FROM 'true'` |
| Test exclusion (events) | `properties->>'is_test' IS DISTINCT FROM 'true'` |
| Test exclusion (bookings) | `is_test = false OR is_test IS NULL` |
| Intro booking | `booking_kind = 'intro'` |
| Paid session | `booking_kind = 'full_session'` |

---

## Known Data Gaps

1. **`cal_bookings`** may be sparse early on – Cal.com webhook integration populates this
2. **Session value** not tracked – using fixed €100 estimate for CLV
3. **`cal_auto_fallback_to_messaging`** event may have low volume initially
4. **Ad spend** synced nightly via `/api/admin/ads/sync-spend` cron

---

## Refresh Schedule

- **Ad spend**: Synced nightly at 4am UTC via Vercel cron
- **Cal slots cache**: Refreshed every 15 minutes
- **Metabase**: Default refresh is hourly; can be configured per dashboard
