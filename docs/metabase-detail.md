# Kaufmann Health – Detail & Funnel Queries

> **Purpose**: Trends, funnels, attribution, and operational drill-downs  
> **Data source**: Supabase (PostgreSQL)  
> **Filter**: All queries use `{{created_at}}` field filter (date range picker)

For KPI single-value cards, see `metabase-kpis.md`.

---

## Funnel Dashboard

### F-TrafficByEntry

```sql
-- Traffic distribution by entry point (campaign_source).
-- Shows where confirmed leads came from: /start, /fragebogen, directory, etc.
-- Use to identify highest-performing acquisition channels.
-- "(direct)" = no campaign_source tracked (organic or missing attribution).
SELECT 
  COALESCE(campaign_source, '(direct)') AS entry_point,
  COUNT(*) AS leads
FROM people
WHERE type = 'patient'
  AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND {{created_at}}
GROUP BY campaign_source
ORDER BY leads DESC;
```

### F-ConversionByPath

```sql
-- Compares conversion rates: Questionnaire flow vs Directory browsing.
-- Questionnaire = guided matching, Directory = self-service therapist browsing.
-- Higher questionnaire conversion expected (more intent). Low directory = UX issues.
-- Use to decide where to invest: guided flow optimization vs directory features.
WITH questionnaire_leads AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND metadata->>'form_session_id' IS NOT NULL
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND {{created_at}}
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
    AND {{created_at}}
),
directory_contacts AS (
  SELECT COUNT(DISTINCT m.patient_id) AS cnt
  FROM matches m
  WHERE m.metadata->>'patient_initiated' = 'true'
    AND {{created_at}}
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
    AND {{created_at}}
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
-- Core acquisition funnel: Started form → Submitted → Email verified.
-- Shows drop-off at each stage with % of initial users remaining.
-- Big drop Start→Submit = form UX issues. Big drop Submit→Verify = email issues.
-- Compare to D-FormCompletionRate and D-VerificationRate KPIs.
WITH funnel AS (
  SELECT '1. Started' AS stage, 1 AS ord,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS users
  FROM events
  WHERE type = 'screen_viewed' AND properties->>'step' = '1'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND {{created_at}}
  UNION ALL
  SELECT '2. Submitted' AS stage, 2 AS ord,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS users
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND {{created_at}}
  UNION ALL
  SELECT '3. Verified' AS stage, 3 AS ord, COUNT(*) AS users
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND {{created_at}}
)
SELECT stage, users,
  ROUND(100.0 * users / NULLIF(FIRST_VALUE(users) OVER (ORDER BY ord), 0), 1) AS pct_of_start
FROM funnel ORDER BY ord;
```

### F-DirectoryFunnel

```sql
-- Directory (/therapeuten) engagement funnel.
-- Tracks: page view → profile click → contact CTA → modal open → submit.
-- Low profile clicks = poor therapist cards. Low contact submit = friction in modal.
-- Use to identify UX bottlenecks in self-service therapist discovery.
SELECT 'directory_viewed' AS stage, 1 AS ord, COUNT(*) AS count
FROM events WHERE type = 'directory_viewed' AND {{created_at}}
UNION ALL
SELECT 'profile_modal_opened', 2, COUNT(*)
FROM events WHERE type = 'profile_modal_opened' AND {{created_at}}
UNION ALL
SELECT 'contact_cta_clicked', 3, COUNT(*)
FROM events WHERE type = 'contact_cta_clicked' AND {{created_at}}
UNION ALL
SELECT 'contact_modal_opened', 4, COUNT(*)
FROM events WHERE type = 'contact_modal_opened' AND {{created_at}}
UNION ALL
SELECT 'contact_submitted', 5, COUNT(*)
FROM events WHERE type = 'contact_submitted' AND {{created_at}}
ORDER BY ord;
```

### F-StepByStep

```sql
-- Step-by-step questionnaire funnel showing exact drop-off points.
-- Steps: Zeitrahmen → Schwerpunkte → Therapieform → Standort → Präferenzen → Kontakt.
-- Identifies which step causes most abandonment. High drop on step = redesign needed.
-- Compare across time periods to measure impact of UX changes.
WITH step_data AS (
  SELECT properties->>'step' AS step,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS users
  FROM events
  WHERE type = 'screen_viewed'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND {{created_at}}
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
-- Weekly trend of paid therapy sessions (North Star metric over time).
-- Use to spot growth trajectory and seasonal patterns.
-- Flat or declining = funnel issues. Spikes may correlate with campaigns.
-- Best viewed as line chart with 90-day window.
SELECT date_trunc('week', cb.created_at)::date AS week_start, COUNT(*) AS sessions
FROM cal_bookings cb
LEFT JOIN people p ON p.id = cb.patient_id
WHERE cb.booking_kind = 'full_session'
  AND LOWER(cb.status) != 'cancelled'
  AND (cb.is_test = false OR cb.is_test IS NULL)
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
  AND {{created_at}}
GROUP BY date_trunc('week', cb.created_at)
ORDER BY week_start DESC;
```

### T-LeadsDaily

```sql
-- Daily confirmed leads trend (email-verified patients).
-- Use to correlate with ad spend, campaigns, or external events.
-- Sudden drops = check ads, email deliverability. Spikes = campaign success.
-- Excludes current day (incomplete data).
SELECT DATE(created_at) AS day, COUNT(*) AS leads
FROM people
WHERE type = 'patient'
  AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND {{created_at}}
  AND DATE(created_at) < CURRENT_DATE
GROUP BY DATE(created_at) ORDER BY day DESC;
```

### T-SessionsDaily

```sql
-- Daily paid session bookings trend.
-- Lagging indicator - reflects earlier funnel activity.
-- Low volume is expected early; becomes meaningful with scale.
-- Compare to T-LeadsDaily to see funnel lag (leads → sessions delay).
SELECT DATE(cb.created_at) AS day, COUNT(*) AS sessions
FROM cal_bookings cb
LEFT JOIN people p ON p.id = cb.patient_id
WHERE cb.booking_kind = 'full_session'
  AND LOWER(cb.status) != 'cancelled'
  AND (cb.is_test = false OR cb.is_test IS NULL)
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
  AND {{created_at}}
  AND DATE(cb.created_at) < CURRENT_DATE
GROUP BY DATE(cb.created_at) ORDER BY day DESC;
```

### T-FormCompletionDaily

```sql
-- Daily form completion rate trend (% who finished vs started).
-- Helps identify days with UX issues, slow load times, or broken steps.
-- Consistent rate = stable UX. Sudden drops = investigate that day's changes.
-- Target: >70% daily. Below 50% consistently = major UX problem.
WITH starts AS (
  SELECT DATE(created_at) AS day,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS cnt
  FROM events
  WHERE type = 'screen_viewed' AND properties->>'step' = '1'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND {{created_at}}
    AND DATE(created_at) < CURRENT_DATE
  GROUP BY DATE(created_at)
),
completions AS (
  SELECT DATE(created_at) AS day,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS cnt
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND {{created_at}}
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
-- Daily contact messages (fallback when Cal booking unavailable).
-- High volume = therapist availability issues or Cal.com problems.
-- Should trend DOWN as more therapists enable Cal.com booking.
-- Spikes may indicate Cal API outages or therapist calendar issues.
SELECT DATE(created_at) AS day, COUNT(*) AS messages
FROM events
WHERE type = 'contact_message_sent'
  AND {{created_at}}
  AND DATE(created_at) < CURRENT_DATE
GROUP BY DATE(created_at) ORDER BY day DESC;
```

### T-VerificationDaily

```sql
-- Daily email verification rate (% of form submitters who verified).
-- Helps spot email deliverability issues on specific days.
-- Low days: check spam complaints, email provider issues, or confirmation UX.
-- Target: >60% daily. Consistent <40% = systematic email problem.
WITH completions AS (
  SELECT DATE(created_at) AS day,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS cnt
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND {{created_at}}
    AND DATE(created_at) < CURRENT_DATE
  GROUP BY DATE(created_at)
),
verified AS (
  SELECT DATE(created_at) AS day, COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND {{created_at}}
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
-- Breakdown of leads by campaign source and A/B variant.
-- Source = landing page or channel. Variant = A/B test variant (C, B, etc.).
-- Use to compare campaign performance and identify winning variants.
-- "confirmed" column shows verified leads (excludes drop-offs before email verification).
SELECT 
  COALESCE(campaign_source, '(unknown)') AS source,
  COALESCE(campaign_variant, '-') AS variant,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE status NOT IN ('pre_confirmation', 'email_confirmation_sent')) AS confirmed
FROM people
WHERE type = 'patient' AND status != 'anonymous'
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND {{created_at}}
GROUP BY campaign_source, campaign_variant
ORDER BY leads DESC;
```

### A-DailyBySource

```sql
-- Daily lead trend broken down by campaign source.
-- Helps identify which campaigns are driving volume on specific days.
-- Use to correlate with ad spend changes or campaign launches.
-- Best viewed as stacked area chart or grouped bar chart.
SELECT DATE(created_at) AS day,
  COALESCE(campaign_source, '(unknown)') AS source,
  COUNT(*) AS leads
FROM people
WHERE type = 'patient'
  AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
  AND {{created_at}}
  AND DATE(created_at) < CURRENT_DATE
GROUP BY DATE(created_at), campaign_source
ORDER BY day DESC, leads DESC;
```

---

## Ad Spend Detail

### A-SpendByCampaign

```sql
-- Daily Google Ads spend breakdown by campaign.
-- Shows spend, clicks, impressions, conversions, and CPC per campaign per day.
-- Use to identify high-spend low-conversion campaigns for optimization.
-- Data synced nightly from Google Ads API via /api/admin/ads/sync-spend.
SELECT date, campaign_name, spend_eur, clicks, impressions, conversions,
  ROUND(spend_eur / NULLIF(clicks, 0), 2) AS cpc_eur
FROM ad_spend_log
WHERE {{date}}
ORDER BY date DESC, spend_eur DESC;
```

### A-SpendDaily

```sql
-- Total daily ad spend across all campaigns.
-- Use to correlate with lead volume (T-LeadsDaily) for efficiency analysis.
-- Spikes without corresponding lead increases = wasted spend.
-- Best viewed as line chart overlaid with leads trend.
SELECT date, SUM(spend_eur) AS spend_eur, SUM(clicks) AS clicks, SUM(impressions) AS impressions
FROM ad_spend_log
WHERE {{date}}
GROUP BY date ORDER BY date DESC;
```

---

## Supply Gap Analysis

### G-TopGaps

```sql
-- Top unmet demand: patient requests we couldn't fully match.
-- Shows combinations of gender, modality, schwerpunkt, city, session type.
-- High counts = recruit therapists with these attributes.
-- Use to prioritize therapist outreach and geographic expansion.
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
WHERE {{created_at}}
GROUP BY gender, modality, schwerpunkt, city, session_type
ORDER BY requests DESC LIMIT 25;
```

### G-BySchwerpunkt

```sql
-- Supply gaps grouped by schwerpunkt (focus area/specialty).
-- Shows which specialties patients want but we lack supply for.
-- Use to guide therapist recruitment: prioritize high-request specialties.
-- "cities" column shows where demand is concentrated.
SELECT COALESCE(schwerpunkt, '(Kein Schwerpunkt)') AS schwerpunkt,
  COUNT(*) AS requests, COUNT(DISTINCT patient_id) AS patients,
  STRING_AGG(DISTINCT city, ', ' ORDER BY city) AS cities
FROM supply_gaps
WHERE {{created_at}} AND schwerpunkt IS NOT NULL
GROUP BY schwerpunkt ORDER BY requests DESC LIMIT 15;
```

### G-ByCity

```sql
-- Supply gaps by city for in-person therapy requests.
-- Shows cities where patients want in-person but we lack therapists.
-- Online requests excluded (can be served by any location).
-- Use to prioritize geographic expansion and local therapist recruitment.
SELECT city, COUNT(*) AS requests, COUNT(DISTINCT patient_id) AS patients,
  STRING_AGG(DISTINCT COALESCE(schwerpunkt, modality), ', ') AS topics_needed
FROM supply_gaps
WHERE {{created_at}}
  AND session_type = 'in_person' AND city IS NOT NULL
GROUP BY city ORDER BY requests DESC LIMIT 15;
```

### G-ByModality

```sql
-- Supply gaps by therapy modality (NARM, Hakomi, SE, Core Energetics).
-- Shows which modalities patients request but we can't match.
-- in_person vs online columns show session type preference.
-- Use to identify modality training needs or recruitment priorities.
SELECT COALESCE(modality, '(Keine Modalität)') AS modality,
  COUNT(*) AS requests, COUNT(DISTINCT patient_id) AS patients,
  COUNT(*) FILTER (WHERE session_type = 'in_person') AS in_person,
  COUNT(*) FILTER (WHERE session_type = 'online') AS online
FROM supply_gaps
WHERE {{created_at}} AND modality IS NOT NULL
GROUP BY modality ORDER BY requests DESC LIMIT 15;
```

### G-DailyTrend

```sql
-- Daily supply gap trend - are we closing gaps over time?
-- Decreasing trend = better supply coverage. Increasing = growing unmet demand.
-- Breakdown by gap type helps identify which dimensions need attention.
-- Best viewed as stacked area chart over 90 days.
SELECT DATE(created_at) AS day,
  COUNT(*) AS total_gaps,
  COUNT(DISTINCT patient_id) AS patients_affected,
  COUNT(*) FILTER (WHERE schwerpunkt IS NOT NULL) AS schwerpunkt_gaps,
  COUNT(*) FILTER (WHERE modality IS NOT NULL) AS modality_gaps,
  COUNT(*) FILTER (WHERE gender IS NOT NULL) AS gender_gaps
FROM supply_gaps
WHERE {{created_at}}
  AND DATE(created_at) < CURRENT_DATE
GROUP BY DATE(created_at) ORDER BY day DESC;
```

---

## Match Quality

### M-QualityDaily

```sql
-- Daily match quality index (0-100 scale) with breakdown.
-- 100 = exact match, 70 = partial, 40 = has therapist but weak fit, 0 = empty.
-- Trend should be stable or improving. Drops = check matching algorithm or supply.
-- "empty" column = patients who got no therapist matches at all.
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
WHERE {{created_at}}
  AND DATE(created_at) < CURRENT_DATE
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
GROUP BY DATE(created_at) ORDER BY day DESC;
```

### M-QualitySummary

```sql
-- Summary of match quality for the selected period.
-- quality_index = weighted average (100=exact, 70=partial, 40=weak, 0=empty).
-- Target: quality_index >70, exact_pct >50%. Low = supply or algorithm issues.
-- Use as headline metric for matching health.
SELECT COUNT(*) AS total,
  ROUND(AVG(CASE 
    WHEN metadata->>'match_quality' = 'exact' THEN 100
    WHEN metadata->>'match_quality' = 'partial' THEN 70
    WHEN therapist_id IS NOT NULL THEN 40 ELSE 0
  END), 1) AS quality_index,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'match_quality' = 'exact') / NULLIF(COUNT(*), 0), 1) AS exact_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'match_quality' = 'partial') / NULLIF(COUNT(*), 0), 1) AS partial_pct
FROM matches
WHERE {{created_at}}
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true');
```

### M-LowQualityPatients

```sql
-- Patients with poor matches who may need manual concierge help.
-- Shows patients without "exact" or "partial" match quality.
-- Use for proactive outreach: call these patients to help manually.
-- "Kein Therapeut" = no match at all, highest priority for follow-up.
SELECT m.created_at, p.name, p.email, p.metadata->>'city' AS city,
  COALESCE(m.metadata->>'match_quality', 'none') AS quality,
  CASE WHEN m.therapist_id IS NULL THEN 'Kein Therapeut' ELSE 'Hat Therapeut' END AS status
FROM matches m JOIN people p ON p.id = m.patient_id
WHERE {{created_at}}
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
-- Feedback email response rate (day-10 email campaign).
-- Measures engagement with "What's holding you back?" email.
-- Good response rate = email is reaching people, content resonates.
-- Target: >10%. Low = check email deliverability or timing.
WITH emails_sent AS (
  SELECT COUNT(*) AS cnt
  FROM events
  WHERE type = 'email_sent'
    AND properties->>'template' = 'feedbackRequest'
    AND {{created_at}}
),
responses AS (
  SELECT COUNT(DISTINCT properties->>'patient_id') AS cnt
  FROM events
  WHERE type = 'feedback_response'
    AND {{created_at}}
)
SELECT 
  emails_sent.cnt AS emails_sent,
  responses.cnt AS responses,
  ROUND(100.0 * responses.cnt / NULLIF(emails_sent.cnt, 0), 1) AS response_rate_pct
FROM emails_sent, responses;
```

### FB-ByReason

```sql
-- Why patients aren't booking - breakdown by reason.
-- Top reasons inform product and pricing strategy.
-- "Preis zu hoch" = consider payment plans. "Unsicher" = improve matching/profiles.
-- Use to prioritize product improvements and messaging.
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
  AND {{created_at}}
GROUP BY properties->>'reason'
ORDER BY count DESC;
```

### FB-InterviewInterest

```sql
-- Interview signup rate from feedback responders (€25 voucher offer).
-- Shows willingness to do paid user research interviews.
-- High rate = engaged users who want to help improve the product.
-- Schedule these interviews for deep qualitative insights.
WITH responses AS (
  SELECT COUNT(DISTINCT properties->>'patient_id') AS cnt
  FROM events
  WHERE type = 'feedback_response'
    AND {{created_at}}
),
interviews AS (
  SELECT COUNT(DISTINCT properties->>'patient_id') AS cnt
  FROM events
  WHERE type = 'interview_interest'
    AND {{created_at}}
)
SELECT
  responses.cnt AS feedback_responses,
  interviews.cnt AS interview_signups,
  ROUND(100.0 * interviews.cnt / NULLIF(responses.cnt, 0), 1) AS interview_rate_pct
FROM responses, interviews;
```

### FB-Details

```sql
-- Free-text feedback details for qualitative analysis.
-- Shows patients who took time to write additional comments.
-- Read these regularly for product insights and pain points.
-- High-value qualitative data - consider following up personally.
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
  AND {{created_at}}
ORDER BY e.created_at DESC
LIMIT 50;
```

### FB-WeeklyTrend

```sql
-- Weekly feedback trend with reason breakdown.
-- Shows if feedback patterns are changing over time.
-- Rising "price" = market sensitivity. Rising "alternative" = competition.
-- Use to track impact of product changes on user sentiment.
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
  AND {{created_at}}
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
