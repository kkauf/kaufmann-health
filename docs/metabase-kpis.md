# Kaufmann Health – KPI Dashboard Queries

> **Purpose**: Single-value cards for the main KPI dashboard  
> **Data source**: Supabase (PostgreSQL)  
> **Filter**: All queries use `{{start_date}}` parameter (single date picker, ends at NOW())

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
-- NORTH STAR: Completed paid therapy sessions in this period.
-- Only counts sessions that have ACTUALLY OCCURRED (start_time in the past).
-- This is the ultimate success metric - actual revenue-generating sessions.
-- Booked future sessions don't count because they can be cancelled/rescheduled.
-- Target: Growing week-over-week. Compare to previous periods using date filter.
-- Low values indicate funnel issues upstream (leads, intros, or conversions).
SELECT COUNT(*) AS sessions
FROM cal_bookings cb
LEFT JOIN people p ON p.id = cb.patient_id
WHERE cb.booking_kind = 'full_session'
  AND LOWER(cb.status) != 'cancelled'
  AND cb.start_time < NOW()  -- Only completed sessions
  AND (cb.is_test = false OR cb.is_test IS NULL)
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
  AND cb.start_time >= {{start_date}} AND cb.start_time <= NOW();
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
  AND created_at >= {{start_date}} AND created_at <= NOW();
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
  WHERE date >= {{start_date}} AND date <= NOW()
),
leads AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at <= NOW()
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
     AND created_at >= {{start_date}} AND created_at <= NOW())::numeric /
  NULLIF(
    (SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text))
     FROM events
     WHERE type IN ('form_completed', 'questionnaire_completed')
       AND properties->>'is_test' IS DISTINCT FROM 'true'
       AND created_at >= {{start_date}} AND created_at <= NOW()),
    0
  ),
  1
) AS verification_rate_pct;
```

### D-FormCompletionRate

```sql
-- Form Completion Rate (%) = Users who finished questionnaire ÷ users who started.
-- Measures questionnaire UX and intent quality.
-- This is BEFORE email verification - just form submission.
-- Target: >70%. Below 50% = review questionnaire length, mobile UX, or step complexity.
-- Use F-StepByStep to identify which step has highest drop-off.
-- NOTE: Step 1 (Zeitrahmen) was removed. Wizard now starts at step 2.5 (Schwerpunkte).
SELECT COALESCE(ROUND(
  100.0 *
  (SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text))
   FROM events
   WHERE type IN ('form_completed', 'questionnaire_completed')
     AND properties->>'is_test' IS DISTINCT FROM 'true'
     AND created_at >= {{start_date}} AND created_at <= NOW())::numeric /
  NULLIF(
    (SELECT COUNT(DISTINCT COALESCE(properties->>'session_id', id::text))
     FROM events
     WHERE type = 'screen_viewed'
       AND properties->>'step' = '2.5'
       AND properties->>'is_test' IS DISTINCT FROM 'true'
       AND created_at >= {{start_date}} AND created_at <= NOW()),
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
    AND created_at >= {{start_date}} AND created_at <= NOW()
),
intros AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'intro'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at >= {{start_date}} AND cb.created_at <= NOW()
)
SELECT ROUND(100.0 * intros.cnt / NULLIF(leads.cnt, 0), 1) AS lead_to_intro_pct
FROM leads, intros;
```

### D-LeadToSession

```sql
-- Lead to Session Rate (%) = Patients who booked paid session ÷ confirmed leads.
-- Measures overall funnel effectiveness from lead to paying customer (any path).
-- Includes both intro→session and direct session bookings.
-- Counts BOOKED sessions (leading indicator). NS-Sessions uses completed only.
-- Target: >10%. This is the key revenue conversion metric.
WITH leads AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at <= NOW()
),
paid_customers AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'full_session'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at >= {{start_date}} AND cb.created_at <= NOW()
)
SELECT COALESCE(ROUND(100.0 * paid_customers.cnt / NULLIF(leads.cnt, 0), 1), 0) AS lead_to_session_pct
FROM leads, paid_customers;
```

### D-IntroToSession

```sql
-- Intro to Session Rate (%) = Patients who booked BOTH intro AND session ÷ patients who booked intro.
-- Measures intro call effectiveness: of those who had an intro, how many converted?
-- Counts BOOKED (not just completed) to serve as leading indicator.
-- Unlike D-LeadToSession, this excludes direct session bookings.
-- Target: >40%. Low rate = intro quality issues or therapist-patient mismatch.
WITH booked_intros AS (
  SELECT DISTINCT cb.patient_id
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'intro'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at >= {{start_date}} AND cb.created_at <= NOW()
),
intro_to_session AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  WHERE cb.booking_kind = 'full_session'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND cb.patient_id IN (SELECT patient_id FROM booked_intros)  -- Must have had intro
)
SELECT COALESCE(
  ROUND(100.0 * intro_to_session.cnt / NULLIF((SELECT COUNT(*) FROM booked_intros), 0), 1),
  0
) AS intro_to_session_pct
FROM intro_to_session;
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
-- Verified therapists eligible for directory (can receive bookings).
-- Filters: verified, cal-enabled, accepting new, not hidden/test.
-- May slightly overcount vs /therapeuten (directory also checks profile completeness:
-- photo, rate, schwerpunkte, session_preferences, 3 text fields ≥50 chars).
-- Gap between this count and directory = therapists needing profile completion nudge.
-- Target: Growing. If stagnant, focus on therapist onboarding or profile completion.
SELECT COUNT(*) AS cal_live_count
FROM therapists
WHERE status = 'verified'
  AND cal_enabled = true
  AND cal_username IS NOT NULL
  AND accepting_new = true
  AND (metadata->>'hidden' IS NULL OR metadata->>'hidden' != 'true')
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true');
```

### S-AvailabilityThreshold

```sql
-- % of Cal-enabled therapists with 3+ available intro slots in next 14 days.
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
  AND t.cal_enabled = true
  AND t.cal_username IS NOT NULL;
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
  AND properties->>'is_test' IS DISTINCT FROM 'true'
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
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
),
fallbacks AS (
  SELECT COUNT(*) AS cnt
  FROM events
  WHERE type IN ('cal_auto_fallback_to_messaging', 'cal_slots_fetch_failed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
)
SELECT ROUND(100.0 * fallbacks.cnt / NULLIF(total.cnt, 0), 1) AS fallback_pct
FROM fallbacks, total;
```

---

## Unit Economics

### U-CAC

```sql
-- Customer Acquisition Cost (€) = Total ad spend ÷ paying customers.
-- "Paying customer" = completed at least one paid session (not just booked).
-- Only counts COMPLETED sessions (start_time in the past) to match NS-Sessions.
-- This is the true cost to acquire revenue. Compare to CLV for unit economics.
-- Target: CAC < CLV (ideally CAC < 0.3 × CLV). High CAC = optimize funnel or ads.
WITH spend AS (
  SELECT COALESCE(SUM(spend_eur), 0) AS total
  FROM ad_spend_log
  WHERE date >= {{start_date}} AND date <= NOW()
),
customers AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'full_session'
    AND LOWER(cb.status) != 'cancelled'
    AND cb.start_time < NOW()  -- Only completed sessions
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.start_time >= {{start_date}} AND cb.start_time <= NOW()
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

## Match Quality

### M-BestMatchScore

```sql
-- Average match score of the BEST match per patient (highest total_score).
-- This is what patients actually experience - their #1 recommendation.
-- Each patient gets ~3 matches; averaging all 3 drags the score down.
-- Target: >70. Below 50 = matching algorithm or supply issues.
WITH scored AS (
  SELECT
    patient_id,
    (metadata->>'match_score')::numeric AS match_score,
    (metadata->>'total_score')::numeric AS total_score,
    ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY (metadata->>'total_score')::numeric DESC) AS rn
  FROM matches
  WHERE therapist_id IS NOT NULL
    AND metadata->>'match_score' IS NOT NULL
    AND metadata->>'total_score' IS NOT NULL
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at <= NOW()
)
SELECT ROUND(AVG(match_score)) AS best_match_score_avg
FROM scored
WHERE rn = 1;
```

### M-BestPlatformScore

```sql
-- Average platform score of the BEST match per patient (highest total_score).
-- Platform score = therapist quality (availability, profile completeness, experience).
-- Target: >45. Below 30 = therapist quality or onboarding issues.
WITH scored AS (
  SELECT
    patient_id,
    (metadata->>'platform_score')::numeric AS platform_score,
    (metadata->>'total_score')::numeric AS total_score,
    ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY (metadata->>'total_score')::numeric DESC) AS rn
  FROM matches
  WHERE therapist_id IS NOT NULL
    AND metadata->>'platform_score' IS NOT NULL
    AND metadata->>'total_score' IS NOT NULL
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at <= NOW()
)
SELECT ROUND(AVG(platform_score)) AS best_platform_score_avg
FROM scored
WHERE rn = 1;
```

---

## Metabase Setup

1. **Create one card per query** above
2. **Dashboard filter**: Add a Date filter, map to `start_date` on all cards (queries end at NOW())
3. **Layout**:
   - Row 1: North Star (large card)
   - Row 2: Demand metrics (6 cards)
   - Row 3: Supply metrics (3 cards)
   - Row 4: Unit Economics (3 cards)
   - Row 5: Match Quality (2 cards)

---

## A/B Test: Progressive vs Classic

### AB-FunnelByVariant

```sql
-- A/B Test: Progressive vs Classic — Funnel comparison
-- Segments leads by campaign_variant to compare progressive disclosure vs classic contact form.
-- Key metrics: form completion rate, verification rate.
-- Run weekly minimum; need ~150-200 leads per variant for significance (~3-4 weeks at 10-15/day).
WITH leads AS (
  SELECT id, campaign_variant, status, created_at
  FROM people
  WHERE type = 'patient'
    AND created_at >= {{start_date}} AND created_at <= NOW()
    AND campaign_variant IN ('progressive', 'classic')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
)
SELECT
  campaign_variant,
  COUNT(*) AS total_leads,
  COUNT(*) FILTER (WHERE status NOT IN ('anonymous', 'pre_confirmation')) AS completed_form,
  COUNT(*) FILTER (WHERE status IN ('email_confirmed', 'new', 'matched', 'active')) AS verified,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status NOT IN ('anonymous', 'pre_confirmation')) / NULLIF(COUNT(*), 0), 1) AS completion_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('email_confirmed', 'new', 'matched', 'active')) / NULLIF(COUNT(*), 0), 1) AS verification_rate
FROM leads
GROUP BY campaign_variant
ORDER BY campaign_variant;
```

### AB-BookingsByVariant

```sql
-- A/B Test: Lead-to-booking rate by variant
-- Compares how well each variant converts verified leads into intro bookings.
WITH variant_leads AS (
  SELECT id, campaign_variant
  FROM people
  WHERE type = 'patient'
    AND created_at >= {{start_date}} AND created_at <= NOW()
    AND campaign_variant IN ('progressive', 'classic')
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
),
bookings AS (
  SELECT DISTINCT cb.patient_id
  FROM cal_bookings cb
  WHERE cb.booking_kind = 'intro'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND cb.created_at >= {{start_date}} AND cb.created_at <= NOW()
)
SELECT
  vl.campaign_variant,
  COUNT(*) AS verified_leads,
  COUNT(*) FILTER (WHERE b.patient_id IS NOT NULL) AS booked_intro,
  ROUND(100.0 * COUNT(*) FILTER (WHERE b.patient_id IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS lead_to_intro_pct
FROM variant_leads vl
LEFT JOIN bookings b ON b.patient_id = vl.id
GROUP BY vl.campaign_variant
ORDER BY vl.campaign_variant;
```

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
  WHERE t.status = 'verified' AND t.cal_enabled = true AND t.cal_username IS NOT NULL
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
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at > NOW() - INTERVAL '7 days'
)
SELECT CASE WHEN 100.0 * fallbacks / NULLIF(total, 0) > 30 THEN 1 ELSE 0 END AS alert
FROM stats;
```
