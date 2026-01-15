# Kaufmann Health – Detail & Funnel Queries

> **Purpose**: Trends, funnels, attribution, and operational drill-downs  
> **Data source**: Supabase (PostgreSQL)  
> **Variable**: All queries use `{{days_back}}` (default: 28)

For KPI single-value cards, see `metabase-kpis.md`.

---

## Funnel Dashboard

### F-TrafficByEntry

```sql
-- Panel 1: Traffic distribution by entry point
SELECT 
  COALESCE(campaign_source, '(direct)') AS entry_point,
  COUNT(*) AS leads
FROM people
WHERE type = 'patient'
  AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
GROUP BY campaign_source
ORDER BY leads DESC;
```

### F-ConversionByPath

```sql
-- Panel 2: Questionnaire vs Directory path performance
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
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
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
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'intro'
    AND cb.source = 'directory'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT 'Questionnaire' AS path, questionnaire_leads.cnt AS entries, 
       questionnaire_intros.cnt AS intros,
       ROUND(100.0 * questionnaire_intros.cnt / NULLIF(questionnaire_leads.cnt, 0), 1) AS conversion_pct
FROM questionnaire_leads, questionnaire_intros
UNION ALL
SELECT 'Directory' AS path, directory_contacts.cnt AS entries,
       directory_intros.cnt AS intros,
       ROUND(100.0 * directory_intros.cnt / NULLIF(directory_contacts.cnt, 0), 1) AS conversion_pct
FROM directory_contacts, directory_intros;
```

### F-CoreFunnel

```sql
-- Panel 4b: Core funnel (Start → Submit → Verify)
WITH funnel AS (
  SELECT '1. Started' AS stage, 1 AS ord,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS users
  FROM events
  WHERE type = 'screen_viewed' AND properties->>'step' = '1'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
  UNION ALL
  SELECT '2. Submitted' AS stage, 2 AS ord,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS users
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
  UNION ALL
  SELECT '3. Verified' AS stage, 3 AS ord, COUNT(*) AS users
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT stage, users,
  ROUND(100.0 * users / NULLIF(FIRST_VALUE(users) OVER (ORDER BY ord), 0), 1) AS pct_of_start
FROM funnel ORDER BY ord;
```

### F-DirectoryFunnel

```sql
-- Directory engagement funnel
SELECT 'directory_viewed' AS stage, 1 AS ord, COUNT(*) AS count
FROM events WHERE type = 'directory_viewed' AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
UNION ALL
SELECT 'profile_modal_opened', 2, COUNT(*)
FROM events WHERE type = 'profile_modal_opened' AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
UNION ALL
SELECT 'contact_cta_clicked', 3, COUNT(*)
FROM events WHERE type = 'contact_cta_clicked' AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
UNION ALL
SELECT 'contact_modal_opened', 4, COUNT(*)
FROM events WHERE type = 'contact_modal_opened' AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
UNION ALL
SELECT 'contact_submitted', 5, COUNT(*)
FROM events WHERE type = 'contact_submitted' AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
ORDER BY ord;
```

### F-StepByStep

```sql
-- Detailed questionnaire step funnel
WITH step_data AS (
  SELECT properties->>'step' AS step,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS users
  FROM events
  WHERE type = 'screen_viewed'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
  GROUP BY properties->>'step'
),
labeled AS (
  SELECT step,
    CASE step
      WHEN '1' THEN '1. Zeitrahmen'
      WHEN '2' THEN '2. Schwerpunkte'
      WHEN '3' THEN '3. Therapieform'
      WHEN '4' THEN '4. Standort'
      WHEN '5' THEN '5. Präferenzen'
      WHEN '6' THEN '6. Kontakt'
      WHEN '7' THEN '7. Zusammenfassung'
      ELSE step
    END AS label,
    users,
    CASE step WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 
              WHEN '4' THEN 4 WHEN '5' THEN 5 WHEN '6' THEN 6 WHEN '7' THEN 7 ELSE 99 END AS ord
  FROM step_data
)
SELECT label, users,
  ROUND(100.0 * users / NULLIF(FIRST_VALUE(users) OVER (ORDER BY ord), 0), 1) AS pct_of_start
FROM labeled WHERE ord < 99 ORDER BY ord;
```

---

## Trends

### T-SessionsWeekly

```sql
-- North Star: Paid sessions per week (weekly trend)
SELECT date_trunc('week', cb.created_at)::date AS week_start, COUNT(*) AS sessions
FROM cal_bookings cb
LEFT JOIN people p ON p.id = cb.patient_id
WHERE cb.booking_kind = 'full_session'
  AND LOWER(cb.status) != 'cancelled'
  AND (cb.is_test = false OR cb.is_test IS NULL)
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
  AND cb.created_at >= NOW() - INTERVAL '{{days_back}}' DAY
GROUP BY date_trunc('week', cb.created_at)
ORDER BY week_start DESC;
```

### T-LeadsDaily

```sql
-- Confirmed leads per day
SELECT DATE(created_at) AS day, COUNT(*) AS leads
FROM people
WHERE type = 'patient'
  AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
  AND DATE(created_at) < CURRENT_DATE
GROUP BY DATE(created_at) ORDER BY day DESC;
```

### T-SessionsDaily

```sql
-- Paid sessions per day
SELECT DATE(cb.created_at) AS day, COUNT(*) AS sessions
FROM cal_bookings cb
LEFT JOIN people p ON p.id = cb.patient_id
WHERE cb.booking_kind = 'full_session'
  AND LOWER(cb.status) != 'cancelled'
  AND (cb.is_test = false OR cb.is_test IS NULL)
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
  AND cb.created_at >= NOW() - INTERVAL '{{days_back}}' DAY
  AND DATE(cb.created_at) < CURRENT_DATE
GROUP BY DATE(cb.created_at) ORDER BY day DESC;
```

### T-FormCompletionDaily

```sql
-- Daily form completion rate trend
WITH starts AS (
  SELECT DATE(created_at) AS day,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS cnt
  FROM events
  WHERE type = 'screen_viewed' AND properties->>'step' = '1'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
    AND DATE(created_at) < CURRENT_DATE
  GROUP BY DATE(created_at)
),
completions AS (
  SELECT DATE(created_at) AS day,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS cnt
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
    AND DATE(created_at) < CURRENT_DATE
  GROUP BY DATE(created_at)
)
SELECT s.day, s.cnt AS starts, COALESCE(c.cnt, 0) AS completions,
  ROUND(100.0 * COALESCE(c.cnt, 0) / NULLIF(s.cnt, 0), 1) AS completion_rate_pct
FROM starts s LEFT JOIN completions c ON s.day = c.day
ORDER BY s.day DESC;
```

### T-MessagesDaily

```sql
-- Contact messages sent per day (fallback/messaging volume)
SELECT DATE(created_at) AS day, COUNT(*) AS messages
FROM events
WHERE type = 'contact_message_sent'
  AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
  AND DATE(created_at) < CURRENT_DATE
GROUP BY DATE(created_at) ORDER BY day DESC;
```

### T-VerificationDaily

```sql
-- Daily verification rate trend
WITH completions AS (
  SELECT DATE(created_at) AS day,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS cnt
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
    AND DATE(created_at) < CURRENT_DATE
  GROUP BY DATE(created_at)
),
verified AS (
  SELECT DATE(created_at) AS day, COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= NOW() - INTERVAL '{{days_back}}' DAY
    AND DATE(created_at) < CURRENT_DATE
  GROUP BY DATE(created_at)
)
SELECT c.day, c.cnt AS completions, COALESCE(v.cnt, 0) AS verified,
  ROUND(100.0 * COALESCE(v.cnt, 0) / NULLIF(c.cnt, 0), 1) AS verification_rate_pct
FROM completions c LEFT JOIN verified v ON c.day = v.day
ORDER BY c.day DESC;
```

---

## Campaign Attribution

### A-BySourceVariant

```sql
-- Leads by source and variant
SELECT 
  COALESCE(campaign_source, '(unknown)') AS source,
  COALESCE(campaign_variant, '-') AS variant,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE status NOT IN ('pre_confirmation', 'email_confirmation_sent')) AS confirmed
FROM people
WHERE type = 'patient' AND status != 'anonymous'
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
GROUP BY campaign_source, campaign_variant
ORDER BY leads DESC;
```

### A-DailyBySource

```sql
-- Daily lead trend by source
SELECT DATE(created_at) AS day,
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

## Ad Spend Detail

### A-SpendByCampaign

```sql
-- Daily spend breakdown by campaign
SELECT date, campaign_name, spend_eur, clicks, impressions, conversions,
  ROUND(spend_eur / NULLIF(clicks, 0), 2) AS cpc_eur
FROM ad_spend_log
WHERE date >= (CURRENT_DATE - INTERVAL '{{days_back}}' DAY)::date
ORDER BY date DESC, spend_eur DESC;
```

### A-SpendDaily

```sql
-- Total daily spend
SELECT date, SUM(spend_eur) AS spend_eur, SUM(clicks) AS clicks, SUM(impressions) AS impressions
FROM ad_spend_log
WHERE date >= (CURRENT_DATE - INTERVAL '{{days_back}}' DAY)::date
GROUP BY date ORDER BY date DESC;
```

---

## Supply Gap Analysis

### G-TopGaps

```sql
-- Top supply gaps (unmet demand)
SELECT 
  COALESCE(
    CASE WHEN gender = 'female' THEN 'Weibliche ' WHEN gender = 'male' THEN 'Männlicher ' ELSE '' END ||
    COALESCE(modality || '-Therapeut:in', '') ||
    COALESCE('Spezialist:in für ' || schwerpunkt, '') ||
    CASE WHEN modality IS NULL AND schwerpunkt IS NULL THEN 'Therapeut:in' ELSE '' END ||
    COALESCE(' in ' || city, '') ||
    CASE WHEN session_type = 'in_person' THEN ' (vor Ort)' ELSE '' END,
    'Unbekannt'
  ) AS gap_description,
  COUNT(*) AS requests, COUNT(DISTINCT patient_id) AS patients
FROM supply_gaps
WHERE created_at >= NOW() - INTERVAL '{{days_back}}' DAY
GROUP BY gender, modality, schwerpunkt, city, session_type
ORDER BY requests DESC LIMIT 25;
```

### G-BySchwerpunkt

```sql
-- Supply gaps by focus area
SELECT COALESCE(schwerpunkt, '(Kein Schwerpunkt)') AS schwerpunkt,
  COUNT(*) AS requests, COUNT(DISTINCT patient_id) AS patients,
  STRING_AGG(DISTINCT city, ', ' ORDER BY city) AS cities
FROM supply_gaps
WHERE created_at >= NOW() - INTERVAL '{{days_back}}' DAY AND schwerpunkt IS NOT NULL
GROUP BY schwerpunkt ORDER BY requests DESC LIMIT 15;
```

### G-ByCity

```sql
-- Supply gaps by city (in-person only)
SELECT city, COUNT(*) AS requests, COUNT(DISTINCT patient_id) AS patients,
  STRING_AGG(DISTINCT COALESCE(schwerpunkt, modality), ', ') AS topics_needed
FROM supply_gaps
WHERE created_at >= NOW() - INTERVAL '{{days_back}}' DAY
  AND session_type = 'in_person' AND city IS NOT NULL
GROUP BY city ORDER BY requests DESC LIMIT 15;
```

### G-ByModality

```sql
-- Supply gaps by therapy modality
SELECT COALESCE(modality, '(Keine Modalität)') AS modality,
  COUNT(*) AS requests, COUNT(DISTINCT patient_id) AS patients,
  COUNT(*) FILTER (WHERE session_type = 'in_person') AS in_person,
  COUNT(*) FILTER (WHERE session_type = 'online') AS online
FROM supply_gaps
WHERE created_at >= NOW() - INTERVAL '{{days_back}}' DAY AND modality IS NOT NULL
GROUP BY modality ORDER BY requests DESC LIMIT 15;
```

### G-DailyTrend

```sql
-- Daily trend of supply gaps (are we improving?)
SELECT DATE(created_at) AS day,
  COUNT(*) AS total_gaps,
  COUNT(DISTINCT patient_id) AS patients_affected,
  COUNT(*) FILTER (WHERE schwerpunkt IS NOT NULL) AS schwerpunkt_gaps,
  COUNT(*) FILTER (WHERE modality IS NOT NULL) AS modality_gaps,
  COUNT(*) FILTER (WHERE gender IS NOT NULL) AS gender_gaps
FROM supply_gaps
WHERE created_at >= NOW() - INTERVAL '{{days_back}}' DAY
  AND DATE(created_at) < CURRENT_DATE
GROUP BY DATE(created_at) ORDER BY day DESC;
```

---

## Match Quality

### M-QualityDaily

```sql
-- Daily match quality index (0-100)
SELECT DATE(created_at) AS day, COUNT(*) AS matches,
  ROUND(AVG(CASE 
    WHEN metadata->>'match_quality' = 'exact' THEN 100
    WHEN metadata->>'match_quality' = 'partial' THEN 70
    WHEN therapist_id IS NOT NULL THEN 40 ELSE 0
  END), 1) AS quality_index,
  COUNT(*) FILTER (WHERE metadata->>'match_quality' = 'exact') AS exact,
  COUNT(*) FILTER (WHERE metadata->>'match_quality' = 'partial') AS partial,
  COUNT(*) FILTER (WHERE therapist_id IS NULL) AS empty
FROM matches
WHERE created_at >= NOW() - INTERVAL '{{days_back}}' DAY
  AND DATE(created_at) < CURRENT_DATE
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
GROUP BY DATE(created_at) ORDER BY day DESC;
```

### M-QualitySummary

```sql
-- Match quality breakdown (current period)
SELECT COUNT(*) AS total,
  ROUND(AVG(CASE 
    WHEN metadata->>'match_quality' = 'exact' THEN 100
    WHEN metadata->>'match_quality' = 'partial' THEN 70
    WHEN therapist_id IS NOT NULL THEN 40 ELSE 0
  END), 1) AS quality_index,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'match_quality' = 'exact') / NULLIF(COUNT(*), 0), 1) AS exact_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'match_quality' = 'partial') / NULLIF(COUNT(*), 0), 1) AS partial_pct
FROM matches
WHERE created_at >= NOW() - INTERVAL '{{days_back}}' DAY
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true');
```

### M-LowQualityPatients

```sql
-- Patients with low-quality matches (may need manual intervention)
SELECT m.created_at, p.name, p.email, p.metadata->>'city' AS city,
  COALESCE(m.metadata->>'match_quality', 'none') AS quality,
  CASE WHEN m.therapist_id IS NULL THEN 'Kein Therapeut' ELSE 'Hat Therapeut' END AS status
FROM matches m JOIN people p ON p.id = m.patient_id
WHERE m.created_at >= NOW() - INTERVAL '{{days_back}}' DAY
  AND (m.metadata->>'is_test' IS NULL OR m.metadata->>'is_test' != 'true')
  AND m.metadata->>'match_quality' IS DISTINCT FROM 'exact'
  AND m.metadata->>'match_quality' IS DISTINCT FROM 'partial'
ORDER BY m.created_at DESC LIMIT 50;
```

---

## Feedback Analysis

Feedback emails are sent 10 days after signup to patients who haven't booked.

### FB-ResponseRate

```sql
-- Feedback response rate (% of emails that got a click)
WITH emails_sent AS (
  SELECT COUNT(*) AS cnt
  FROM events
  WHERE type = 'email_sent'
    AND properties->>'template' = 'feedbackRequest'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
responses AS (
  SELECT COUNT(DISTINCT properties->>'patient_id') AS cnt
  FROM events
  WHERE type = 'feedback_response'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT 
  emails_sent.cnt AS emails_sent,
  responses.cnt AS responses,
  ROUND(100.0 * responses.cnt / NULLIF(emails_sent.cnt, 0), 1) AS response_rate_pct
FROM emails_sent, responses;
```

### FB-ByReason

```sql
-- Feedback breakdown by reason
SELECT 
  CASE properties->>'reason'
    WHEN 'price_too_high' THEN 'Preis zu hoch'
    WHEN 'unsure_which_therapist' THEN 'Unsicher welcher Therapeut'
    WHEN 'need_more_time' THEN 'Brauche mehr Zeit'
    WHEN 'found_alternative' THEN 'Alternative gefunden'
    WHEN 'match_dissatisfied' THEN 'Empfehlung passt nicht'
    WHEN 'other' THEN 'Sonstiges'
    ELSE properties->>'reason'
  END AS reason,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM events
WHERE type = 'feedback_response'
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
GROUP BY properties->>'reason'
ORDER BY count DESC;
```

### FB-InterviewInterest

```sql
-- Interview interest (€25 voucher offer)
WITH responses AS (
  SELECT COUNT(DISTINCT properties->>'patient_id') AS cnt
  FROM events
  WHERE type = 'feedback_response'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
),
interviews AS (
  SELECT COUNT(DISTINCT properties->>'patient_id') AS cnt
  FROM events
  WHERE type = 'interview_interest'
    AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
)
SELECT
  responses.cnt AS feedback_responses,
  interviews.cnt AS interview_signups,
  ROUND(100.0 * interviews.cnt / NULLIF(responses.cnt, 0), 1) AS interview_rate_pct
FROM responses, interviews;
```

### FB-Details

```sql
-- Feedback with free-text details (for qualitative review)
SELECT 
  e.created_at,
  p.name,
  p.email,
  CASE e.properties->>'reason'
    WHEN 'price_too_high' THEN 'Preis zu hoch'
    WHEN 'unsure_which_therapist' THEN 'Unsicher welcher Therapeut'
    WHEN 'need_more_time' THEN 'Brauche mehr Zeit'
    WHEN 'found_alternative' THEN 'Alternative gefunden'
    WHEN 'match_dissatisfied' THEN 'Empfehlung passt nicht'
    WHEN 'other' THEN 'Sonstiges'
    ELSE e.properties->>'reason'
  END AS reason,
  e.properties->>'details' AS details
FROM events e
LEFT JOIN people p ON p.id::text = e.properties->>'patient_id'
WHERE e.type = 'feedback_details'
  AND e.created_at > NOW() - INTERVAL '{{days_back}}' DAY
ORDER BY e.created_at DESC
LIMIT 50;
```

### FB-WeeklyTrend

```sql
-- Weekly feedback trend
SELECT 
  date_trunc('week', created_at)::date AS week,
  COUNT(*) AS responses,
  COUNT(*) FILTER (WHERE properties->>'reason' = 'price_too_high') AS price,
  COUNT(*) FILTER (WHERE properties->>'reason' = 'unsure_which_therapist') AS unsure,
  COUNT(*) FILTER (WHERE properties->>'reason' = 'need_more_time') AS need_time,
  COUNT(*) FILTER (WHERE properties->>'reason' = 'found_alternative') AS alternative,
  COUNT(*) FILTER (WHERE properties->>'reason' = 'other') AS other
FROM events
WHERE type = 'feedback_response'
  AND created_at > NOW() - INTERVAL '{{days_back}}' DAY
GROUP BY date_trunc('week', created_at)
ORDER BY week DESC;
```

---

## Metabase Setup

**Recommended dashboard structure:**

1. **KPI Dashboard** (use `metabase-kpis.md`)
   - Single-value cards in grid layout

2. **Funnel Dashboard** (this file, F-* queries)
   - F-TrafficByEntry → Horizontal bar chart
   - F-ConversionByPath → Bar chart (2 bars)
   - F-CoreFunnel → Funnel chart or table
   - F-DirectoryFunnel → Funnel chart

3. **Trends Dashboard** (this file, T-* queries)
   - T-LeadsDaily → Line chart
   - T-SessionsDaily → Line chart
   - T-FormCompletionDaily → Line chart (completion_rate_pct)

4. **Operations Dashboard** (this file, G-*, M-* queries)
   - Supply gaps tables
   - Match quality charts
