# Kaufmann Health – KPI Dashboard Queries

> **Purpose**: Single-value cards for the main KPI dashboard  
> **Data source**: Supabase (PostgreSQL)  
> **Variable**: All queries use `{{days_back}}` (default: 28)

---

## Query Naming Convention

Format: `[Section]-[Metric]`  
Examples: `NS-Sessions`, `D-Leads`, `S-CalLive`, `U-CAC`

- **NS** = North Star
- **D** = Demand Side
- **S** = Supply Side  
- **U** = Unit Economics

---

## Data Model Notes

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

## North Star

### NS-Sessions

```sql
-- Total paid sessions booked (this period)
SELECT COUNT(*) AS sessions
FROM cal_bookings cb
LEFT JOIN people p ON p.id = cb.patient_id
WHERE cb.booking_kind = 'full_session'
  AND LOWER(cb.status) != 'cancelled'
  AND (cb.is_test = false OR cb.is_test IS NULL)
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
  AND cb.created_at >= NOW() - INTERVAL '{{days_back}}' DAY;
```

---

## Demand Side

### D-Leads

```sql
-- Confirmed leads count
SELECT COUNT(*) AS leads
FROM people
WHERE type = 'patient'
  AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY;
```

### D-CPL

```sql
-- Cost per Lead = Ad Spend ÷ Confirmed Leads
WITH spend AS (
  SELECT COALESCE(SUM(spend_eur), 0) AS total
  FROM ad_spend_log
  WHERE date >= (CURRENT_DATE - INTERVAL '{{days_back}}' DAY)::date
),
leads AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT ROUND(spend.total / NULLIF(leads.cnt, 0), 2) AS cpl_eur
FROM spend, leads;
```

### D-VerificationRate

```sql
-- Verification Rate (%) = Verified Leads ÷ Form Completions
SELECT ROUND(
  100.0 *
  (SELECT COUNT(*) FROM people 
   WHERE type = 'patient'
     AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
     AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
     AND created_at > NOW() - INTERVAL '{{days_back}}' DAY)::numeric /
  NULLIF(
    (SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text))
     FROM events
     WHERE type IN ('form_completed', 'questionnaire_completed')
       AND properties->>'is_test' IS DISTINCT FROM 'true'
       AND created_at > NOW() - INTERVAL '{{days_back}}' DAY),
    0
  ),
  1
) AS verification_rate_pct;
```

### D-FormCompletionRate

```sql
-- Form Completion Rate (%) = Completions ÷ Starts
SELECT COALESCE(ROUND(
  100.0 * 
  (SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text))
   FROM events
   WHERE type IN ('form_completed', 'questionnaire_completed')
     AND properties->>'is_test' IS DISTINCT FROM 'true'
     AND created_at > NOW() - INTERVAL '{{days_back}}' DAY)::numeric /
  NULLIF(
    (SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text))
     FROM events
     WHERE type = 'screen_viewed' 
       AND properties->>'step' = '1'
       AND properties->>'is_test' IS DISTINCT FROM 'true'
       AND created_at > NOW() - INTERVAL '{{days_back}}' DAY),
    0
  ),
  1
), 0) AS form_completion_rate_pct;
```

### D-LeadToIntro

```sql
-- Lead → Intro Call (%) = Intro Bookings ÷ Confirmed Leads
WITH leads AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
intros AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'intro'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT ROUND(100.0 * intros.cnt / NULLIF(leads.cnt, 0), 1) AS lead_to_intro_pct
FROM leads, intros;
```

### D-IntroToSession

```sql
-- Intro → Paid Session (%) = Session Customers ÷ Intro Customers
WITH intros AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'intro'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
sessions AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'full_session'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT ROUND(100.0 * sessions.cnt / NULLIF(intros.cnt, 0), 1) AS intro_to_session_pct
FROM intros, sessions;
```

### D-IntrosThisWeek

```sql
-- Intro calls booked this week
SELECT COUNT(*) AS intros_this_week
FROM cal_bookings cb
LEFT JOIN people p ON p.id = cb.patient_id
WHERE cb.booking_kind = 'intro'
  AND LOWER(cb.status) != 'cancelled'
  AND (cb.is_test = false OR cb.is_test IS NULL)
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
  AND cb.created_at >= date_trunc('week', NOW());
```

---

## Supply Side

### S-CalLive

```sql
-- Therapists with Cal.com live
SELECT COUNT(*) AS cal_live_count
FROM therapists
WHERE status = 'verified'
  AND cal_bookings_live = true;
```

### S-AvailabilityThreshold

```sql
-- % Therapists with ≥3 intro slots (next 14 days)
SELECT ROUND(
  100.0 * COUNT(*) FILTER (WHERE c.slots_count >= 3) / NULLIF(COUNT(*), 0), 
  1
) AS pct_with_3plus_slots
FROM therapists t
JOIN cal_slots_cache c ON c.therapist_id = t.id
WHERE t.status = 'verified'
  AND t.cal_bookings_live = true;
```

### S-MessagesThisWeek

```sql
-- Contact messages sent this week (fallback volume indicator)
SELECT COUNT(*) AS messages_this_week
FROM events
WHERE type = 'contact_message_sent'
  AND created_at >= date_trunc('week', NOW());
```

### S-FallbackRate

```sql
-- % Contacts sent to messaging fallback
WITH total AS (
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
SELECT ROUND(100.0 * fallbacks.cnt / NULLIF(total.cnt, 0), 1) AS fallback_pct
FROM fallbacks, total;
```

---

## Unit Economics

### U-CAC

```sql
-- Customer Acquisition Cost = Ad Spend ÷ Paying Customers
WITH spend AS (
  SELECT COALESCE(SUM(spend_eur), 0) AS total
  FROM ad_spend_log
  WHERE date >= (CURRENT_DATE - INTERVAL '{{days_back}}' DAY)::date
),
customers AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'full_session'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT ROUND(spend.total / NULLIF(customers.cnt, 0), 2) AS cac_eur
FROM spend, customers;
```

### U-AvgSessions

```sql
-- Avg sessions per paying customer
WITH customer_sessions AS (
  SELECT cb.patient_id, COUNT(*) AS sessions
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'full_session'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
  GROUP BY cb.patient_id
)
SELECT ROUND(AVG(sessions), 2) AS avg_sessions_per_customer
FROM customer_sessions;
```

### U-CLV

```sql
-- Customer Lifetime Value = Avg Sessions × €100 (assumed session price)
WITH customer_sessions AS (
  SELECT cb.patient_id, COUNT(*) AS sessions
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'full_session'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
  GROUP BY cb.patient_id
)
SELECT ROUND(AVG(sessions) * 100, 2) AS clv_eur
FROM customer_sessions;
```

---

## Metabase Setup

1. **Create one card per query** above
2. **Dashboard filter**: `{{days_back}}` with default 28, options: 7, 14, 28, 90
3. **Layout**:
   - Row 1: North Star (large card)
   - Row 2: Demand metrics (6 cards)
   - Row 3: Supply metrics (3 cards)
   - Row 4: Unit Economics (3 cards)

---

## Alerts (Optional)

Create these as separate saved questions with Metabase alerts:

### Alert-NoIntros3Days

```sql
-- Returns 1 if no intro bookings in last 3 days
SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END AS alert
FROM cal_bookings cb
LEFT JOIN people p ON p.id = cb.patient_id
WHERE cb.booking_kind = 'intro'
  AND LOWER(cb.status) != 'cancelled'
  AND (cb.is_test = false OR cb.is_test IS NULL)
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
  AND cb.created_at > NOW() - INTERVAL '3 days';
```

### Alert-LowAvailability

```sql
-- Returns 1 if <80% of therapists have ≥3 slots
SELECT CASE WHEN pct < 80 THEN 1 ELSE 0 END AS alert
FROM (
  SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE c.slots_count >= 3) / NULLIF(COUNT(*), 0), 1) AS pct
  FROM therapists t
  JOIN cal_slots_cache c ON c.therapist_id = t.id
  WHERE t.status = 'verified' AND t.cal_bookings_live = true
) sub;
```

### Alert-HighFallback

```sql
-- Returns 1 if fallback rate > 30%
WITH stats AS (
  SELECT 
    COUNT(*) FILTER (WHERE type IN ('cal_auto_fallback_to_messaging', 'cal_slots_fetch_failed')) AS fallbacks,
    COUNT(*) AS total
  FROM events
  WHERE type IN ('cal_slots_viewed', 'cal_auto_fallback_to_messaging', 'cal_slots_fetch_failed')
    AND created_at > NOW() - INTERVAL '7 days'
)
SELECT CASE WHEN 100.0 * fallbacks / NULLIF(total, 0) > 30 THEN 1 ELSE 0 END AS alert
FROM stats;
```
