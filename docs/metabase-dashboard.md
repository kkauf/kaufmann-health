# Kaufmann Health Metabase Dashboard Queries

> Generated: January 2026  
> Data source: Supabase (PostgreSQL)

## Metabase Date Filters

**Option 1: Rolling window with variable (recommended)**
```sql
-- Set days_back variable in Metabase (default: 28)
WHERE created_at >= NOW() - INTERVAL '{{days_back}}' DAY
```

**Option 2: User-selectable date**
```sql
-- Creates date picker widget (requires manual selection)
WHERE created_at >= {{start_date}}
```

**Recommended Dashboard Layout:**
- **Top row**: Gauges (current 7-day rates)
- **Middle**: Weekly trend line charts (4+ weeks)
- **Bottom**: Funnels and breakdowns

---

## Notes on Data Model

- **Leads** = `people` table where `type = 'patient'`
- **Confirmed leads** = status NOT IN `('pre_confirmation', 'anonymous', 'email_confirmation_sent')`
- **Cal.com bookings** = `cal_bookings` table (currently empty - needs investigation)
- **Analytics events** = `events` table
- **Test data exclusion (people)** = `metadata->>'is_test' IS DISTINCT FROM 'true'`
- **Test data exclusion (events)** = `properties->>'is_test' IS DISTINCT FROM 'true'`

---

## North Star Metric

### # Therapy Sessions on KH (Daily Trend)

```sql
-- Total paid sessions booked through Cal.com
-- NOTE: cal_bookings is currently empty - this will populate once Cal.com integration is live
SELECT 
  DATE(created_at) AS day,
  COUNT(*) AS sessions
FROM cal_bookings
WHERE booking_kind = 'full_session'
  AND last_trigger_event = 'BOOKING_CREATED'
  AND (is_test = false OR is_test IS NULL)
  AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
  AND DATE(created_at) < CURRENT_DATE
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

---

## KPI Dashboard - Demand Side

### 1. Leads per Day (Confirmed)

```sql
-- Confirmed leads per day (excludes pre_confirmation, anonymous, email_confirmation_sent)
SELECT 
  DATE(created_at) AS day,
  COUNT(*) AS confirmed_leads
FROM people
WHERE type = 'patient'
  AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
  AND DATE(created_at) < CURRENT_DATE
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

### 2. Form Completion Rate (Daily Trend)

```sql
-- Daily form submission rate trend
-- Excludes today only to avoid partial-day artifacts
-- Use Metabase date range picker to focus on specific windows (last 7d, 14d, 30d)
WITH daily_starts AS (
  SELECT 
    DATE(created_at) AS day,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS starts
  FROM events
  WHERE type = 'screen_viewed'
    AND properties->>'step' = '1'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
    AND DATE(created_at) < CURRENT_DATE  -- Exclude today only
  GROUP BY DATE(created_at)
),
daily_submissions AS (
  SELECT 
    DATE(created_at) AS day,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS submissions
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')  -- Track both flows
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
    AND DATE(created_at) < CURRENT_DATE  -- Exclude today only
  GROUP BY DATE(created_at)
)
SELECT 
  s.day,
  s.starts AS form_starts,
  COALESCE(sub.submissions, 0) AS form_submissions,
  ROUND(100.0 * COALESCE(sub.submissions, 0) / NULLIF(s.starts, 0), 1) AS submission_rate_pct
FROM daily_starts s
LEFT JOIN daily_submissions sub ON s.day = sub.day
ORDER BY s.day DESC;
```

### 2b. Verification Conversion Rate (Daily Trend)

```sql
-- Daily verification rate trend
WITH daily_submissions AS (
  SELECT 
    DATE(created_at) AS day,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS submissions
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
    AND DATE(created_at) < CURRENT_DATE
  GROUP BY DATE(created_at)
),
daily_verified AS (
  SELECT 
    DATE(created_at) AS day,
    COUNT(*) AS verified
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
    AND DATE(created_at) < CURRENT_DATE
  GROUP BY DATE(created_at)
)
SELECT 
  s.day,
  s.submissions AS form_submissions,
  COALESCE(v.verified, 0) AS verified_leads,
  ROUND(100.0 * COALESCE(v.verified, 0) / NULLIF(s.submissions, 0), 1) AS verification_rate_pct
FROM daily_submissions s
LEFT JOIN daily_verified v ON s.day = v.day
ORDER BY s.day DESC;
```

### 2c. Current Period Gauges (for dashboard cards)

```sql
-- Single values for gauge display (last 7 days)
-- Form Completion Rate
WITH starts AS (
  SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS cnt
  FROM events
  WHERE type = 'screen_viewed'
    AND properties->>'step' = '1'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
submissions AS (
  SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS cnt
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT ROUND(100.0 * submissions.cnt / NULLIF(starts.cnt, 0), 1) AS form_completion_rate_pct
FROM starts, submissions;

-- Verification Rate (separate query for gauge)
WITH submissions AS (
  SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS cnt
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
confirmed AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT ROUND(100.0 * confirmed.cnt / NULLIF(submissions.cnt, 0), 1) AS verification_rate_pct
FROM submissions, confirmed;
```

### 3. Lead → Intro Call % 

```sql
-- Intro bookings ÷ total confirmed leads (last 90 days)
-- NOTE: Requires cal_bookings to be populated
WITH leads AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
intro_bookings AS (
  SELECT COUNT(DISTINCT patient_id) AS cnt
  FROM cal_bookings
  WHERE booking_kind = 'intro'
    AND last_trigger_event = 'BOOKING_CREATED'
    AND (is_test = false OR is_test IS NULL)
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT 
  leads.cnt AS total_leads,
  intro_bookings.cnt AS intro_bookings,
  ROUND(100.0 * intro_bookings.cnt / NULLIF(leads.cnt, 0), 1) AS lead_to_intro_pct
FROM leads, intro_bookings;
```

### 4. Intro Call → Paid Session %

```sql
-- Paid session bookings ÷ intro bookings (last 90 days)
-- NOTE: Requires cal_bookings to be populated
WITH intros AS (
  SELECT COUNT(DISTINCT patient_id) AS cnt
  FROM cal_bookings
  WHERE booking_kind = 'intro'
    AND last_trigger_event = 'BOOKING_CREATED'
    AND (is_test = false OR is_test IS NULL)
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
sessions AS (
  SELECT COUNT(DISTINCT patient_id) AS cnt
  FROM cal_bookings
  WHERE booking_kind = 'full_session'
    AND last_trigger_event = 'BOOKING_CREATED'
    AND (is_test = false OR is_test IS NULL)
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT 
  intros.cnt AS intro_bookings,
  sessions.cnt AS session_bookings,
  ROUND(100.0 * sessions.cnt / NULLIF(intros.cnt, 0), 1) AS intro_to_session_pct
FROM intros, sessions;
```

### 5. Intro Calls Booked (This Week)

```sql
-- Count of intro call bookings in current week
SELECT COUNT(*) AS intro_calls_this_week
FROM cal_bookings
WHERE booking_kind = 'intro'
  AND last_trigger_event = 'BOOKING_CREATED'
  AND (is_test = false OR is_test IS NULL)
  AND created_at >= date_trunc('week', NOW());
```

---

## KPI Dashboard - Supply Side

### 1. # Therapists with Cal.com Live

```sql
-- Therapists with active Cal.com integration (cal_bookings_live = true)
SELECT 
  COUNT(*) FILTER (WHERE cal_bookings_live = true) AS cal_live,
  COUNT(*) FILTER (WHERE status = 'verified') AS total_verified,
  ROUND(100.0 * COUNT(*) FILTER (WHERE cal_bookings_live = true) / 
    NULLIF(COUNT(*) FILTER (WHERE status = 'verified'), 0), 1) AS pct_cal_live
FROM therapists
WHERE status = 'verified';
```

### 2. % Therapists with ≥3 Intro Slots (Next 14 Days)

```sql
-- Therapists meeting availability threshold (≥3 slots in 14-day window)
-- Uses cal_slots_cache which is refreshed periodically
SELECT 
  COUNT(*) FILTER (WHERE c.slots_count >= 3) AS meets_threshold,
  COUNT(*) AS total_with_cache,
  ROUND(100.0 * COUNT(*) FILTER (WHERE c.slots_count >= 3) / 
    NULLIF(COUNT(*), 0), 1) AS pct_available
FROM therapists t
JOIN cal_slots_cache c ON c.therapist_id = t.id
WHERE t.status = 'verified'
  AND t.cal_bookings_live = true;
```

### 3. % Contacts Sent to Messaging Fallback

```sql
-- Fallback = Cal.com slots unavailable or empty, user shown message compose
-- Events: cal_auto_fallback_to_messaging (no slots) + cal_slots_fetch_failed (API error)
WITH total_booking_attempts AS (
  SELECT COUNT(*) AS cnt
  FROM events
  WHERE type IN ('cal_slots_viewed', 'cal_auto_fallback_to_messaging', 'cal_slots_fetch_failed')
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
fallbacks AS (
  SELECT COUNT(*) AS cnt
  FROM events
  WHERE type IN ('cal_auto_fallback_to_messaging', 'cal_slots_fetch_failed')
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT 
  fallbacks.cnt AS fallback_count,
  total_booking_attempts.cnt AS total_attempts,
  ROUND(100.0 * fallbacks.cnt / NULLIF(total_booking_attempts.cnt, 0), 1) AS fallback_pct
FROM fallbacks, total_booking_attempts;
```

---

## KPI Dashboard - Unit Economics

### 1. CAC (Customer Acquisition Cost)

```sql
-- Customers with ≥1 paid session
-- NOTE: Ad spend must be manually input; this query provides the denominator
-- CAC = Total Spend ÷ this count
SELECT COUNT(DISTINCT patient_id) AS paying_customers
FROM cal_bookings
WHERE booking_kind = 'full_session'
  AND last_trigger_event = 'BOOKING_CREATED'
  AND (is_test = false OR is_test IS NULL)
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY;
```

### 2. Avg Sessions per Customer

```sql
-- Total paid sessions ÷ unique paying customers
SELECT 
  COUNT(*) AS total_sessions,
  COUNT(DISTINCT patient_id) AS unique_customers,
  ROUND(1.0 * COUNT(*) / NULLIF(COUNT(DISTINCT patient_id), 0), 2) AS avg_sessions_per_customer
FROM cal_bookings
WHERE booking_kind = 'full_session'
  AND last_trigger_event = 'BOOKING_CREATED'
  AND (is_test = false OR is_test IS NULL)
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY;
```

---

## Funnel Dashboard

### Panel 1: Traffic Distribution by Entry Point (Last 30 Days)

```sql
-- Leads by campaign_source (entry point)
SELECT 
  COALESCE(campaign_source, '(direct/unknown)') AS entry_point,
  COUNT(*) AS leads
FROM people
WHERE type = 'patient'
  AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
GROUP BY campaign_source
ORDER BY leads DESC;
```

### Panel 2: Conversion Rate by Path

```sql
-- Questionnaire vs Directory path performance
-- Questionnaire: has form_session_id in metadata
-- Directory: patient_initiated matches
WITH questionnaire_leads AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND metadata->>'form_session_id' IS NOT NULL
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
questionnaire_intros AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'intro'
    AND cb.source = 'questionnaire'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND cb.created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
directory_contacts AS (
  SELECT COUNT(DISTINCT m.patient_id) AS cnt
  FROM matches m
  WHERE m.metadata->>'patient_initiated' = 'true'
    AND m.created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
directory_intros AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  WHERE cb.booking_kind = 'intro'
    AND cb.source = 'directory'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND cb.created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT 
  'Questionnaire' AS path,
  questionnaire_leads.cnt AS entries,
  questionnaire_intros.cnt AS intro_bookings,
  ROUND(100.0 * questionnaire_intros.cnt / NULLIF(questionnaire_leads.cnt, 0), 1) AS conversion_pct
FROM questionnaire_leads, questionnaire_intros
UNION ALL
SELECT 
  'Directory' AS path,
  directory_contacts.cnt AS entries,
  directory_intros.cnt AS intro_bookings,
  ROUND(100.0 * directory_intros.cnt / NULLIF(directory_contacts.cnt, 0), 1) AS conversion_pct
FROM directory_contacts, directory_intros;
```

### Panel 3: Core Conversion Metrics (This Week)

```sql
-- Weekly snapshot: intro bookings, session bookings, conversion rate
WITH intros AS (
  SELECT COUNT(*) AS cnt
  FROM cal_bookings
  WHERE booking_kind = 'intro'
    AND last_trigger_event = 'BOOKING_CREATED'
    AND (is_test = false OR is_test IS NULL)
    AND created_at >= date_trunc('week', NOW())
),
sessions AS (
  SELECT COUNT(*) AS cnt
  FROM cal_bookings
  WHERE booking_kind = 'full_session'
    AND last_trigger_event = 'BOOKING_CREATED'
    AND (is_test = false OR is_test IS NULL)
    AND created_at >= date_trunc('week', NOW())
)
SELECT 
  intros.cnt AS intro_bookings_this_week,
  sessions.cnt AS session_bookings_this_week,
  ROUND(100.0 * sessions.cnt / NULLIF(intros.cnt, 0), 1) AS intro_to_session_pct
FROM intros, sessions;
```

### Panel 4: Funnel Drop-off (Questionnaire Flow)

```sql
-- Step-by-step funnel with unique sessions and drop-off rates
-- Main flow: 1 → 2 → 3 → 4 → 5 → 6 → submitted → verified
WITH step_data AS (
  SELECT 
    properties->>'step' AS step,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS unique_sessions
  FROM events
  WHERE type = 'screen_viewed'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
  GROUP BY properties->>'step'
),
labeled AS (
  SELECT 
    step,
    CASE step
      WHEN '1' THEN '1. Zeitrahmen'
      WHEN '2' THEN '2. Schwerpunkte'
      WHEN '2.5' THEN '2.5. Symptome (optional)'
      WHEN '3' THEN '3. Therapieform'
      WHEN '4' THEN '4. Standort'
      WHEN '5' THEN '5. Präferenzen'
      WHEN '6' THEN '6. Kontakt (Email)'
      WHEN '6.5' THEN '6.5. Kontakt (SMS)'
      WHEN '7' THEN '7. Zusammenfassung'
      WHEN '9' THEN '9. Bestätigung ausstehend'
      ELSE step
    END AS step_label,
    unique_sessions,
    CASE step
      WHEN '1' THEN 1
      WHEN '2' THEN 2
      WHEN '2.5' THEN 2.5
      WHEN '3' THEN 3
      WHEN '4' THEN 4
      WHEN '5' THEN 5
      WHEN '6' THEN 6
      WHEN '6.5' THEN 6.5
      WHEN '7' THEN 7
      WHEN '9' THEN 9
      ELSE 99
    END AS step_order
  FROM step_data
)
SELECT 
  step_label,
  unique_sessions,
  ROUND(100.0 * unique_sessions / NULLIF(FIRST_VALUE(unique_sessions) OVER (ORDER BY step_order), 0), 1) AS pct_of_start
FROM labeled
WHERE step_order < 99
ORDER BY step_order;
```

### Panel 4b: Core Funnel Summary (Reliable Metrics)

```sql
-- Simplified funnel using reliable metrics only
-- NOTE: Step 6/6.5 tracking is incomplete, so using Start → Submit → Verify
WITH funnel AS (
  SELECT 
    '1. Started Questionnaire' AS stage,
    1 AS stage_order,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS users
  FROM events
  WHERE type = 'screen_viewed'
    AND properties->>'step' = '1'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
  
  UNION ALL
  
  SELECT 
    '2. Submitted Form' AS stage,
    2 AS stage_order,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS users
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
  
  UNION ALL
  
  SELECT 
    '3. Verified Lead' AS stage,
    3 AS stage_order,
    COUNT(*) AS users
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT 
  stage,
  users,
  LAG(users) OVER (ORDER BY stage_order) AS prev_stage,
  ROUND(100.0 * users / NULLIF(LAG(users) OVER (ORDER BY stage_order), 0), 1) AS step_conversion_pct,
  ROUND(100.0 * users / NULLIF(FIRST_VALUE(users) OVER (ORDER BY stage_order), 0), 1) AS pct_of_start
FROM funnel
ORDER BY stage_order;
-- Example output (last 30 days):
-- | stage                  | users | step_conversion_pct | pct_of_start |
-- |------------------------|-------|---------------------|--------------|
-- | 1. Started             | 671   | -                   | 100.0%       |
-- | 2. Submitted Form      | 274   | 40.8%               | 40.8%        |
-- | 3. Verified Lead       | 33    | 12.0%               | 4.9%         |
```

### Panel 5: Directory Funnel

```sql
-- Directory engagement funnel
SELECT 
  'directory_viewed' AS stage,
  1 AS stage_order,
  COUNT(*) AS count
FROM events
WHERE type = 'directory_viewed'
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY

UNION ALL

SELECT 
  'profile_modal_opened' AS stage,
  2 AS stage_order,
  COUNT(*) AS count
FROM events
WHERE type = 'profile_modal_opened'
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY

UNION ALL

SELECT 
  'contact_cta_clicked' AS stage,
  3 AS stage_order,
  COUNT(*) AS count
FROM events
WHERE type = 'contact_cta_clicked'
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY

UNION ALL

SELECT 
  'contact_modal_opened' AS stage,
  4 AS stage_order,
  COUNT(*) AS count
FROM events
WHERE type = 'contact_modal_opened'
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY

UNION ALL

SELECT 
  'contact_submitted' AS stage,
  5 AS stage_order,
  COUNT(*) AS count
FROM events
WHERE type = 'contact_submitted'
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY

ORDER BY stage_order;
```

---

## Campaign Attribution

### Leads by Source and Variant

```sql
-- Campaign performance breakdown
SELECT 
  COALESCE(campaign_source, '(unknown)') AS source,
  COALESCE(campaign_variant, '(unknown)') AS variant,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE status NOT IN ('pre_confirmation', 'email_confirmation_sent')) AS confirmed
FROM people
WHERE type = 'patient'
  AND status != 'anonymous'
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
GROUP BY campaign_source, campaign_variant
ORDER BY leads DESC;
```

### Daily Trend by Campaign Source

```sql
-- Daily lead trend by entry point
SELECT 
  DATE(created_at) AS day,
  COALESCE(campaign_source, '(unknown)') AS source,
  COUNT(*) AS leads
FROM people
WHERE type = 'patient'
  AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
  AND DATE(created_at) < CURRENT_DATE
GROUP BY DATE(created_at), campaign_source
ORDER BY day DESC, leads DESC;
```

---

## Alerts (for Metabase Alerts)

### Alert: No Intro Bookings in 3+ Days

```sql
-- Returns 1 if no intro bookings in last 3 days (use for alert trigger)
SELECT CASE 
  WHEN COUNT(*) = 0 THEN 1 
  ELSE 0 
END AS alert_no_bookings
FROM cal_bookings
WHERE booking_kind = 'intro'
  AND last_trigger_event = 'BOOKING_CREATED'
  AND (is_test = false OR is_test IS NULL)
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY;
```

### Alert: Therapist Availability Below Threshold

```sql
-- Returns 1 if <80% of therapists have ≥3 slots
SELECT CASE 
  WHEN pct_available < 80 THEN 1 
  ELSE 0 
END AS alert_low_availability
FROM (
  SELECT 
    ROUND(100.0 * COUNT(*) FILTER (WHERE c.slots_count >= 3) / 
      NULLIF(COUNT(*), 0), 1) AS pct_available
  FROM therapists t
  JOIN cal_slots_cache c ON c.therapist_id = t.id
  WHERE t.status = 'verified'
    AND t.cal_bookings_live = true
) sub;
```

### Alert: High Fallback Rate

```sql
-- Returns 1 if fallback rate exceeds 30%
WITH stats AS (
  SELECT 
    COUNT(*) FILTER (WHERE type IN ('cal_auto_fallback_to_messaging', 'cal_slots_fetch_failed')) AS fallbacks,
    COUNT(*) AS total
  FROM events
  WHERE type IN ('cal_slots_viewed', 'cal_auto_fallback_to_messaging', 'cal_slots_fetch_failed')
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT CASE 
  WHEN 100.0 * fallbacks / NULLIF(total, 0) > 30 THEN 1 
  ELSE 0 
END AS alert_high_fallback
FROM stats;
```

---

## Known Data Gaps

1. **`cal_bookings` is empty** - Cal.com webhook integration needs investigation
2. **CPL/CAC** - Google Ads spend not in database; manually input in Metabase
3. **`cal_auto_fallback_to_messaging`** - Event exists in code but 0 occurrences so far
4. **Session value** - Not tracked; use fixed estimate (€100/session) for CLV calculations

---

## Metabase Setup Recommendations

1. Create a single **"KH Overview"** dashboard with all metrics
2. Add **date range filter** (default: last 7 days, options: 14d, 30d, 90d)
3. Set up **alerts** for the three alert queries above
4. **Refresh frequency**: Daily is sufficient at current volume
