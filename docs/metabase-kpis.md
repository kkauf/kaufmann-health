# Kaufmann Health – KPI Dashboard Queries

> **Purpose**: Single-value cards for the main KPI dashboard  
> **Data source**: Supabase (PostgreSQL)  
> **Filter**: All queries use `{{start_date}}` and `{{end_date}}` parameters (date range picker)

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
-- NORTH STAR: Total paid therapy sessions booked in this period.
-- This is the ultimate success metric - actual revenue-generating sessions.
-- Target: Growing week-over-week. Compare to previous periods using date filter.
-- Low values indicate funnel issues upstream (leads, intros, or conversions).
SELECT COUNT(*) AS sessions
FROM cal_bookings cb
LEFT JOIN people p ON p.id = cb.patient_id
WHERE cb.booking_kind = 'full_session'
  AND LOWER(cb.status) != 'cancelled'
  AND (cb.is_test = false OR cb.is_test IS NULL)
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
  AND cb.created_at >= {{start_date}} AND cb.created_at < {{end_date}};
```

---

## Demand Side

### D-Leads

```sql
-- Total confirmed leads (email-verified patients) in this period.
-- "Confirmed" = completed form AND verified email. Excludes anonymous/pre-confirmation.
-- This is top-of-funnel demand. Target: Steady growth aligned with ad spend.
-- Sudden drops may indicate ad issues, form problems, or email deliverability.
SELECT COUNT(*) AS leads
FROM people
WHERE type = 'patient'
  AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND created_at >= {{start_date}} AND created_at < {{end_date}};
```

### D-CPL

```sql
-- Cost per Lead (€) = Total ad spend ÷ confirmed leads.
-- Measures acquisition efficiency at top of funnel.
-- Target: €15-30 depending on campaign. Rising CPL may indicate ad fatigue or competition.
-- Compare across campaigns using A-SpendByCampaign for optimization.
WITH spend AS (
  SELECT COALESCE(SUM(spend_eur), 0) AS total
  FROM ad_spend_log
  WHERE date >= {{start_date}} AND date < {{end_date}}
),
leads AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at < {{end_date}}
)
SELECT ROUND(spend.total / NULLIF(leads.cnt, 0), 2) AS cpl_eur
FROM spend, leads;
```

### D-VerificationRate

```sql
-- Verification Rate (%) = Verified leads ÷ Form completions.
-- Measures email confirmation success AFTER form submission.
-- If Form Completion is 80% but Verification is 35%, it means 65% of people who
-- finished the form never clicked the email confirmation link.
-- Causes: spam folder, typos in email, cold feet, slow email delivery.
-- Target: >60%. Below 40% = check email deliverability and confirmation UX.
SELECT ROUND(
  100.0 *
  (SELECT COUNT(*) FROM people 
   WHERE type = 'patient'
     AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
     AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
     AND created_at >= {{start_date}} AND created_at < {{end_date}})::numeric /
  NULLIF(
    (SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text))
     FROM events
     WHERE type IN ('form_completed', 'questionnaire_completed')
       AND properties->>'is_test' IS DISTINCT FROM 'true'
       AND created_at >= {{start_date}} AND created_at < {{end_date}}),
    0
  ),
  1
) AS verification_rate_pct;
```

### D-FormCompletionRate

```sql
-- Form Completion Rate (%) = Users who finished questionnaire ÷ users who started step 1.
-- Measures questionnaire UX and intent quality.
-- This is BEFORE email verification - just form submission.
-- Target: >70%. Below 50% = review questionnaire length, mobile UX, or step complexity.
-- Use F-StepByStep to identify which step has highest drop-off.
SELECT COALESCE(ROUND(
  100.0 * 
  (SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text))
   FROM events
   WHERE type IN ('form_completed', 'questionnaire_completed')
     AND properties->>'is_test' IS DISTINCT FROM 'true'
     AND created_at >= {{start_date}} AND created_at < {{end_date}})::numeric /
  NULLIF(
    (SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text))
     FROM events
     WHERE type = 'screen_viewed' 
       AND properties->>'step' = '1'
       AND properties->>'is_test' IS DISTINCT FROM 'true'
       AND created_at >= {{start_date}} AND created_at < {{end_date}}),
    0
  ),
  1
), 0) AS form_completion_rate_pct;
```

### D-LeadToIntro

```sql
-- Lead to Intro Rate (%) = Patients who booked intro ÷ confirmed leads.
-- Measures how well we convert verified leads into intro call bookings.
-- Low rate may indicate: poor matches, therapist availability issues, or email nurture gaps.
-- Target: >20%. Below 10% = check match quality, supply gaps, or follow-up emails.
WITH leads AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at < {{end_date}}
),
intros AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'intro'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at >= {{start_date}} AND cb.created_at < {{end_date}}
)
SELECT ROUND(100.0 * intros.cnt / NULLIF(leads.cnt, 0), 1) AS lead_to_intro_pct
FROM leads, intros;
```

### D-IntroToSession

```sql
-- Intro to Session Rate (%) = Patients who booked paid session ÷ patients who had intro.
-- Measures therapist-patient fit and intro call effectiveness.
-- Low rate may indicate: wrong matches, pricing concerns, or therapist no-shows.
-- Target: >40%. This is therapist-dependent - check individual therapist conversion.
WITH intros AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'intro'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at >= {{start_date}} AND cb.created_at < {{end_date}}
),
sessions AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'full_session'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at >= {{start_date}} AND cb.created_at < {{end_date}}
)
SELECT ROUND(100.0 * sessions.cnt / NULLIF(intros.cnt, 0), 1) AS intro_to_session_pct
FROM intros, sessions;
```

### D-IntrosThisWeek

```sql
-- Intro calls booked this calendar week (Monday-Sunday).
-- Real-time pulse check on booking activity.
-- Compare to previous weeks. Zero for 3+ days triggers Alert-NoIntros3Days.
-- Useful for weekly standups and spotting sudden drops.
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
-- Total verified therapists with Cal.com booking enabled.
-- This is our active supply - therapists who can receive bookings.
-- Target: Growing. If stagnant, focus on therapist onboarding or Cal activation.
-- Low numbers relative to demand = supply constraint, check G-TopGaps.
SELECT COUNT(*) AS cal_live_count
FROM therapists
WHERE status = 'verified'
  AND cal_bookings_live = true;
```

### S-AvailabilityThreshold

```sql
-- % of Cal-live therapists with 3+ available intro slots in next 14 days.
-- Measures booking capacity. Low availability = patients can't book = lost conversions.
-- Target: >80%. Below 60% = therapists need to open more slots or we need more supply.
-- Triggers Alert-LowAvailability if below 80%.
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
-- Contact form messages sent this week (fallback when Cal booking unavailable).
-- High volume = Cal.com issues, therapist availability gaps, or API failures.
-- These require manual therapist follow-up, which is slower than direct booking.
-- Target: Low (ideally <10% of total contacts). Rising = check S-FallbackRate.
SELECT COUNT(*) AS messages_this_week
FROM events
WHERE type = 'contact_message_sent'
  AND created_at >= date_trunc('week', NOW());
```

### S-FallbackRate

```sql
-- % of contact attempts that fell back to messaging (vs direct Cal booking).
-- Fallback happens when: no slots available, Cal API fails, or therapist not Cal-enabled.
-- Target: <15%. Above 30% = poor patient experience, triggers Alert-HighFallback.
-- Check S-AvailabilityThreshold and therapist Cal status if high.
WITH total AS (
  SELECT COUNT(*) AS cnt
  FROM events
  WHERE type IN ('cal_slots_viewed', 'cal_auto_fallback_to_messaging', 'cal_slots_fetch_failed')
    AND created_at >= {{start_date}} AND created_at < {{end_date}}
),
fallbacks AS (
  SELECT COUNT(*) AS cnt
  FROM events
  WHERE type IN ('cal_auto_fallback_to_messaging', 'cal_slots_fetch_failed')
    AND created_at >= {{start_date}} AND created_at < {{end_date}}
)
SELECT ROUND(100.0 * fallbacks.cnt / NULLIF(total.cnt, 0), 1) AS fallback_pct
FROM fallbacks, total;
```

---

## Unit Economics

### U-CAC

```sql
-- Customer Acquisition Cost (€) = Total ad spend ÷ paying customers.
-- "Paying customer" = booked at least one paid session (not just intro).
-- This is the true cost to acquire revenue. Compare to CLV for unit economics.
-- Target: CAC < CLV (ideally CAC < 0.3 × CLV). High CAC = optimize funnel or ads.
WITH spend AS (
  SELECT COALESCE(SUM(spend_eur), 0) AS total
  FROM ad_spend_log
  WHERE date >= {{start_date}} AND date < {{end_date}}
),
customers AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'full_session'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at >= {{start_date}} AND cb.created_at < {{end_date}}
)
SELECT ROUND(spend.total / NULLIF(customers.cnt, 0), 2) AS cac_eur
FROM spend, customers;
```

### U-AvgSessions

```sql
-- Average number of paid sessions per paying customer (all-time).
-- Measures retention and therapy continuity.
-- Higher = better patient outcomes and revenue per customer.
-- Target: >3 sessions. Below 2 = patients not returning, check therapist quality.
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
-- Customer Lifetime Value (€) = Avg sessions × €100 (assumed session price).
-- Represents expected revenue per acquired customer.
-- Compare to CAC: healthy ratio is CLV > 3× CAC.
-- Note: Uses fixed €100 estimate. Actual varies by therapist pricing.
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
2. **Dashboard filter**: Add a Date Range filter, map to `start_date` and `end_date` on all cards
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
