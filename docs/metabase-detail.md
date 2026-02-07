# Kaufmann Health – Detail & Funnel Queries

> **Purpose**: Trends, funnels, attribution, and operational drill-downs  
> **Data source**: Supabase (PostgreSQL)  
> **Filter**: All queries use `{{start_date}}` parameter (single date picker, ends at NOW())

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
  AND created_at >= {{start_date}} AND created_at <= NOW()
GROUP BY campaign_source
ORDER BY leads DESC;
```

### F-ConversionByPath

```sql
-- Compares conversion rates: Questionnaire flow vs Directory browsing.
-- Questionnaire = guided matching, Directory = self-service therapist browsing.
-- Full sessions = primary conversion. Intros = leading indicator.
-- Higher questionnaire conversion expected (more intent). Low directory = UX issues.
-- NOTE: Directory "entries" uses cal_bookings source='directory' rather than matches,
-- since users can book directly without creating a match record.
WITH questionnaire_leads AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND metadata->>'form_session_id' IS NOT NULL
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at <= NOW()
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
    AND cb.created_at >= {{start_date}} AND cb.created_at <= NOW()
),
questionnaire_sessions AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'full_session'
    AND cb.source = 'questionnaire'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at >= {{start_date}} AND cb.created_at <= NOW()
),
-- Directory entries: count unique patients who booked from directory (any booking type)
directory_entries AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.source = 'directory'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at >= {{start_date}} AND cb.created_at <= NOW()
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
    AND cb.created_at >= {{start_date}} AND cb.created_at <= NOW()
),
directory_sessions AS (
  SELECT COUNT(DISTINCT cb.patient_id) AS cnt
  FROM cal_bookings cb
  LEFT JOIN people p ON p.id = cb.patient_id
  WHERE cb.booking_kind = 'full_session'
    AND cb.source = 'directory'
    AND LOWER(cb.status) != 'cancelled'
    AND (cb.is_test = false OR cb.is_test IS NULL)
    AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
    AND cb.created_at >= {{start_date}} AND cb.created_at <= NOW()
)
SELECT 'Questionnaire' AS path,
       questionnaire_leads.cnt AS entries,
       questionnaire_intros.cnt AS intros,
       questionnaire_sessions.cnt AS sessions,
       ROUND(100.0 * questionnaire_intros.cnt / NULLIF(questionnaire_leads.cnt, 0), 1) AS intro_pct,
       ROUND(100.0 * questionnaire_sessions.cnt / NULLIF(questionnaire_leads.cnt, 0), 1) AS session_pct
FROM questionnaire_leads, questionnaire_intros, questionnaire_sessions
UNION ALL
SELECT 'Directory' AS path,
       directory_entries.cnt AS entries,
       directory_intros.cnt AS intros,
       directory_sessions.cnt AS sessions,
       ROUND(100.0 * directory_intros.cnt / NULLIF(directory_entries.cnt, 0), 1) AS intro_pct,
       ROUND(100.0 * directory_sessions.cnt / NULLIF(directory_entries.cnt, 0), 1) AS session_pct
FROM directory_entries, directory_intros, directory_sessions;
```

### F-CoreFunnel

```sql
-- Core acquisition funnel: Started form → Submitted (with contact) → Verified.
-- IMPORTANT: Uses submit_succeeded (not form_completed) to count real submissions.
-- form_completed fires from multiple sources and includes anonymous flow - unreliable.
-- Excludes anonymous patients who browsed without providing contact info.
-- Big drop Start→Submit = form UX issues. Big drop Submit→Verify = email/SMS issues.
-- NOTE: Step 1 (Timeline) was removed. Wizard now starts at step 2.5 (Schwerpunkte).
WITH funnel AS (
  SELECT '1. Started' AS stage, 1 AS ord,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS users
  FROM events
  WHERE type = 'screen_viewed' AND properties->>'step' = '2.5'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
  UNION ALL
  SELECT '2. Submitted (contact provided)' AS stage, 2 AS ord,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS users
  FROM events
  WHERE type = 'submit_succeeded'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
  UNION ALL
  SELECT '3. Verified' AS stage, 3 AS ord, COUNT(*) AS users
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at <= NOW()
)
SELECT stage, users,
  ROUND(100.0 * users / NULLIF(FIRST_VALUE(users) OVER (ORDER BY ord), 0), 1) AS pct_of_start
FROM funnel ORDER BY ord;
```

### F-TrueLeadFunnel

```sql
-- Ground-truth funnel using actual people records (not events).
-- Joins form_sessions to people via form_session_id for accurate attribution.
-- Shows the real conversion from questionnaire start to verified lead.
-- Use this to validate event-based funnels and identify tracking gaps.
WITH form_sessions_started AS (
  -- Form sessions that have step data (user interacted with questionnaire)
  SELECT COUNT(DISTINCT id) AS cnt
  FROM form_sessions
  WHERE data->>'step' IS NOT NULL
    AND created_at >= {{start_date}} AND created_at <= NOW()
),
patients_created AS (
  -- Non-anonymous patients created (provided contact info)
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status != 'anonymous'
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at <= NOW()
),
patients_verified AS (
  -- Verified patients (email confirmed or phone verified)
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at <= NOW()
)
SELECT '1. Form Sessions Started' AS stage, fs.cnt AS users, 100.0 AS pct
FROM form_sessions_started fs
UNION ALL
SELECT '2. Leads Created (contact provided)', pc.cnt,
  ROUND(100.0 * pc.cnt / NULLIF((SELECT cnt FROM form_sessions_started), 0), 1)
FROM patients_created pc
UNION ALL
SELECT '3. Leads Verified', pv.cnt,
  ROUND(100.0 * pv.cnt / NULLIF((SELECT cnt FROM form_sessions_started), 0), 1)
FROM patients_verified pv;
```

### F-DirectoryFunnel

```sql
-- Directory (/therapeuten) engagement funnel.
-- Tracks: page view → profile click → contact CTA → modal open → submit.
-- Low profile clicks = poor therapist cards. Low contact submit = friction in modal.
-- Use to identify UX bottlenecks in self-service therapist discovery.
SELECT 'directory_viewed' AS stage, 1 AS ord, COUNT(*) AS count
FROM events WHERE type = 'directory_viewed' AND properties->>'is_test' IS DISTINCT FROM 'true' AND created_at >= {{start_date}} AND created_at <= NOW()
UNION ALL
SELECT 'profile_modal_opened', 2, COUNT(*)
FROM events WHERE type = 'profile_modal_opened' AND properties->>'is_test' IS DISTINCT FROM 'true' AND created_at >= {{start_date}} AND created_at <= NOW()
UNION ALL
SELECT 'contact_cta_clicked', 3, COUNT(*)
FROM events WHERE type = 'contact_cta_clicked' AND properties->>'is_test' IS DISTINCT FROM 'true' AND created_at >= {{start_date}} AND created_at <= NOW()
UNION ALL
SELECT 'contact_modal_opened', 4, COUNT(*)
FROM events WHERE type = 'contact_modal_opened' AND properties->>'is_test' IS DISTINCT FROM 'true' AND created_at >= {{start_date}} AND created_at <= NOW()
UNION ALL
SELECT 'contact_submitted', 5, COUNT(*)
FROM events WHERE type = 'contact_submitted' AND properties->>'is_test' IS DISTINCT FROM 'true' AND created_at >= {{start_date}} AND created_at <= NOW()
ORDER BY ord;
```

### F-StepByStep

```sql
-- Step-by-step questionnaire funnel showing exact drop-off points.
-- Steps map to SignupWizard.tsx (as of Jan 2026):
--   2.5: Schwerpunkte (ALL users start here now), 2: Anliegen (concierge only, after 2.5),
--   3: Therapieform, 4: Standort, 5: Präferenzen, 6: Kontakt, 6.5: SMS, 7: Bestätigung, 9: Abschluss
-- NOTE: Step 1 (Zeitrahmen) was removed. Funnel now starts at step 2.5.
-- Step 2 only appears for Concierge variant (after step 2.5).
-- Identifies which step causes most abandonment. High drop on step = redesign needed.
WITH step_data AS (
  SELECT properties->>'step' AS step,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS users
  FROM events
  WHERE type = 'screen_viewed'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
  GROUP BY properties->>'step'
),
-- Get the starting step count (step 2.5) for percentage calculation
start_users AS (
  SELECT COALESCE(MAX(users) FILTER (WHERE step = '2.5'), 0) AS cnt FROM step_data
),
labeled AS (
  SELECT step,
    CASE step
      WHEN '2.5' THEN '1. Schwerpunkte (Start)'
      WHEN '2' THEN '2. Anliegen (Concierge only)'
      WHEN '3' THEN '3. Therapieform'
      WHEN '4' THEN '4. Standort'
      WHEN '5' THEN '5. Präferenzen'
      WHEN '6' THEN '6. Kontakt'
      WHEN '6.5' THEN '6.5 SMS-Verifizierung'
      WHEN '7' THEN '7. Bestätigung'
      WHEN '9' THEN '9. Abschluss'
      ELSE step
    END AS label,
    users,
    CASE step
      WHEN '2.5' THEN 1.0 WHEN '2' THEN 1.5 WHEN '3' THEN 3.0
      WHEN '4' THEN 4.0 WHEN '5' THEN 5.0 WHEN '6' THEN 6.0 WHEN '6.5' THEN 6.5
      WHEN '7' THEN 7.0 WHEN '9' THEN 9.0 ELSE 99.0
    END AS ord
  FROM step_data
)
SELECT label, users,
  ROUND(100.0 * users / NULLIF((SELECT cnt FROM start_users), 0), 1) AS pct_of_start
FROM labeled WHERE ord < 99 ORDER BY ord;
```

### F-EmailConfirmationFunnel

```sql
-- Email confirmation funnel: tracks email sent → confirmed for patient verification.
-- Use this to monitor email deliverability and verification friction.
-- High send count with low confirmation = email deliverability or UX issues.
-- Includes reminder effectiveness (24h and 72h follow-ups).
WITH email_stages AS (
  SELECT
    properties->>'stage' AS stage,
    COUNT(*) AS emails_sent,
    COUNT(DISTINCT COALESCE(properties->>'lead_id', properties->>'patient_id')) AS unique_leads
  FROM events
  WHERE type = 'email_sent'
    AND properties->>'template' = 'email_confirmation'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
  GROUP BY properties->>'stage'
),
confirmed AS (
  SELECT COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND (metadata->>'contact_method' = 'email' OR metadata->>'contact_method' IS NULL)
    AND created_at >= {{start_date}} AND created_at <= NOW()
)
SELECT
  CASE stage
    WHEN 'email_confirmation' THEN '1. Initial Confirmation'
    WHEN 'patient_confirmation_reminder_24h' THEN '2. 24h Reminder'
    WHEN 'patient_confirmation_reminder_72h' THEN '3. 72h Reminder'
    ELSE stage
  END AS stage,
  emails_sent,
  unique_leads,
  CASE stage WHEN 'email_confirmation' THEN 1 WHEN 'patient_confirmation_reminder_24h' THEN 2
             WHEN 'patient_confirmation_reminder_72h' THEN 3 ELSE 4 END AS ord
FROM email_stages
UNION ALL
SELECT '4. Confirmed (email users)' AS stage, confirmed.cnt, confirmed.cnt, 5 AS ord FROM confirmed
ORDER BY ord;
```

### F-VerificationByMethod

```sql
-- Verification funnel split by contact method (email vs phone).
-- Shows which verification path has better conversion.
-- Phone users verify via SMS code; email users click confirmation link.
WITH patients AS (
  SELECT
    id,
    COALESCE(metadata->>'contact_method', 'email') AS contact_method,
    status
  FROM people
  WHERE type = 'patient'
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at <= NOW()
)
SELECT
  contact_method,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')) AS verified,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent'))
    / NULLIF(COUNT(*), 0), 1) AS verification_rate_pct
FROM patients
WHERE contact_method IN ('email', 'phone')
GROUP BY contact_method
ORDER BY total DESC;
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
  AND created_at >= {{start_date}} AND created_at <= NOW()
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
  AND created_at >= {{start_date}} AND created_at <= NOW()
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
  AND created_at >= {{start_date}} AND created_at <= NOW()
  AND DATE(cb.created_at) < CURRENT_DATE
GROUP BY DATE(cb.created_at) ORDER BY day DESC;
```

### T-FormCompletionDaily

```sql
-- Daily form completion rate trend (% who finished vs started).
-- Helps identify days with UX issues, slow load times, or broken steps.
-- Consistent rate = stable UX. Sudden drops = investigate that day's changes.
-- Target: >70% daily. Below 50% consistently = major UX problem.
-- NOTE: Step 1 (Zeitrahmen) was removed. Wizard now starts at step 2.5 (Schwerpunkte).
WITH starts AS (
  SELECT DATE(created_at) AS day,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS cnt
  FROM events
  WHERE type = 'screen_viewed' AND properties->>'step' = '2.5'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
    AND DATE(created_at) < CURRENT_DATE
  GROUP BY DATE(created_at)
),
completions AS (
  SELECT DATE(created_at) AS day,
    COUNT(DISTINCT COALESCE(properties->>'session_id', id::text)) AS cnt
  FROM events
  WHERE type IN ('form_completed', 'questionnaire_completed')
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
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
  AND properties->>'is_test' IS DISTINCT FROM 'true'
  AND created_at >= {{start_date}} AND created_at <= NOW()
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
    AND created_at >= {{start_date}} AND created_at <= NOW()
    AND DATE(created_at) < CURRENT_DATE
  GROUP BY DATE(created_at)
),
verified AS (
  SELECT DATE(created_at) AS day, COUNT(*) AS cnt
  FROM people
  WHERE type = 'patient'
    AND status NOT IN ('pre_confirmation', 'anonymous', 'email_confirmation_sent')
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at <= NOW()
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
  AND created_at >= {{start_date}} AND created_at <= NOW()
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
  AND created_at >= {{start_date}} AND created_at <= NOW()
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
WHERE date >= {{start_date}} AND date <= NOW()
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
WHERE date >= {{start_date}} AND date <= NOW()
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
    CASE WHEN sg.gender = 'female' THEN 'Weibliche ' WHEN sg.gender = 'male' THEN 'Männlicher ' ELSE '' END ||
    COALESCE(sg.modality || '-Therapeut:in', '') ||
    COALESCE('Spezialist:in für ' || sg.schwerpunkt, '') ||
    CASE WHEN sg.modality IS NULL AND sg.schwerpunkt IS NULL THEN 'Therapeut:in' ELSE '' END ||
    COALESCE(' in ' || sg.city, '') ||
    CASE WHEN sg.session_type = 'in_person' THEN ' (vor Ort)' ELSE '' END,
    'Unbekannt'
  ) AS gap_description,
  COUNT(*) AS requests, COUNT(DISTINCT sg.patient_id) AS patients
FROM supply_gaps sg
LEFT JOIN people p ON p.id = sg.patient_id
WHERE sg.created_at >= {{start_date}} AND sg.created_at <= NOW()
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
GROUP BY sg.gender, sg.modality, sg.schwerpunkt, sg.city, sg.session_type
ORDER BY requests DESC LIMIT 25;
```

### G-BySchwerpunkt

```sql
-- Supply gaps grouped by schwerpunkt (focus area/specialty).
-- Shows which specialties patients want but we lack supply for.
-- Use to guide therapist recruitment: prioritize high-request specialties.
-- "cities" column shows where demand is concentrated.
SELECT COALESCE(sg.schwerpunkt, '(Kein Schwerpunkt)') AS schwerpunkt,
  COUNT(*) AS requests, COUNT(DISTINCT sg.patient_id) AS patients,
  STRING_AGG(DISTINCT sg.city, ', ' ORDER BY sg.city) AS cities
FROM supply_gaps sg
LEFT JOIN people p ON p.id = sg.patient_id
WHERE sg.created_at >= {{start_date}} AND sg.created_at <= NOW()
  AND sg.schwerpunkt IS NOT NULL
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
GROUP BY sg.schwerpunkt ORDER BY requests DESC LIMIT 15;
```

### G-ByCity

```sql
-- Supply gaps by city for in-person therapy requests.
-- Shows cities where patients want in-person but we lack therapists.
-- Online requests excluded (can be served by any location).
-- Use to prioritize geographic expansion and local therapist recruitment.
SELECT sg.city, COUNT(*) AS requests, COUNT(DISTINCT sg.patient_id) AS patients,
  STRING_AGG(DISTINCT COALESCE(sg.schwerpunkt, sg.modality), ', ') AS topics_needed
FROM supply_gaps sg
LEFT JOIN people p ON p.id = sg.patient_id
WHERE sg.created_at >= {{start_date}} AND sg.created_at <= NOW()
  AND sg.session_type = 'in_person' AND sg.city IS NOT NULL
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
GROUP BY sg.city ORDER BY requests DESC LIMIT 15;
```

### G-ByModality

```sql
-- Supply gaps by therapy modality (NARM, Hakomi, SE, Core Energetics).
-- Shows which modalities patients request but we can't match.
-- in_person vs online columns show session type preference.
-- Use to identify modality training needs or recruitment priorities.
SELECT COALESCE(sg.modality, '(Keine Modalität)') AS modality,
  COUNT(*) AS requests, COUNT(DISTINCT sg.patient_id) AS patients,
  COUNT(*) FILTER (WHERE sg.session_type = 'in_person') AS in_person,
  COUNT(*) FILTER (WHERE sg.session_type = 'online') AS online
FROM supply_gaps sg
LEFT JOIN people p ON p.id = sg.patient_id
WHERE sg.created_at >= {{start_date}} AND sg.created_at <= NOW()
  AND sg.modality IS NOT NULL
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
GROUP BY sg.modality ORDER BY requests DESC LIMIT 15;
```

### G-DailyTrend

```sql
-- Daily supply gap trend - are we closing gaps over time?
-- Decreasing trend = better supply coverage. Increasing = growing unmet demand.
-- Breakdown by gap type helps identify which dimensions need attention.
-- Best viewed as stacked area chart over 90 days.
SELECT DATE(sg.created_at) AS day,
  COUNT(*) AS total_gaps,
  COUNT(DISTINCT sg.patient_id) AS patients_affected,
  COUNT(*) FILTER (WHERE sg.schwerpunkt IS NOT NULL) AS schwerpunkt_gaps,
  COUNT(*) FILTER (WHERE sg.modality IS NOT NULL) AS modality_gaps,
  COUNT(*) FILTER (WHERE sg.gender IS NOT NULL) AS gender_gaps
FROM supply_gaps sg
LEFT JOIN people p ON p.id = sg.patient_id
WHERE sg.created_at >= {{start_date}} AND sg.created_at <= NOW()
  AND DATE(sg.created_at) < CURRENT_DATE
  AND (p.metadata->>'is_test' IS NULL OR p.metadata->>'is_test' != 'true')
GROUP BY DATE(sg.created_at) ORDER BY day DESC;
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
WHERE created_at >= {{start_date}} AND created_at <= NOW()
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
WHERE created_at >= {{start_date}} AND created_at <= NOW()
  AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true');
```

### M-ScoreDaily

```sql
-- Daily match score trend: best match per patient vs all matches average.
-- "best" = the #1 recommendation per patient (highest total_score).
-- Compare best vs all to see how much #2/#3 picks drag down the average.
-- Best viewed as dual-line chart. Target: best_match_score > 70.
WITH scored AS (
  SELECT
    DATE(created_at) AS day,
    patient_id,
    (metadata->>'match_score')::numeric AS match_score,
    (metadata->>'platform_score')::numeric AS platform_score,
    (metadata->>'total_score')::numeric AS total_score,
    ROW_NUMBER() OVER (PARTITION BY patient_id, DATE(created_at) ORDER BY (metadata->>'total_score')::numeric DESC) AS rn
  FROM matches
  WHERE therapist_id IS NOT NULL
    AND metadata->>'match_score' IS NOT NULL
    AND metadata->>'total_score' IS NOT NULL
    AND (metadata->>'is_test' IS NULL OR metadata->>'is_test' != 'true')
    AND created_at >= {{start_date}} AND created_at <= NOW()
    AND DATE(created_at) < CURRENT_DATE
)
SELECT
  day,
  COUNT(*) FILTER (WHERE rn = 1) AS patients,
  ROUND(AVG(match_score) FILTER (WHERE rn = 1)) AS best_match_score,
  ROUND(AVG(match_score)) AS all_match_score,
  ROUND(AVG(platform_score) FILTER (WHERE rn = 1)) AS best_platform_score,
  ROUND(AVG(platform_score)) AS all_platform_score
FROM scored
GROUP BY day
ORDER BY day DESC;
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
WHERE created_at >= {{start_date}} AND created_at <= NOW()
  AND (m.metadata->>'is_test' IS NULL OR m.metadata->>'is_test' != 'true')
  AND m.metadata->>'match_quality' IS DISTINCT FROM 'exact'
  AND m.metadata->>'match_quality' IS DISTINCT FROM 'partial'
ORDER BY m.created_at DESC LIMIT 50;
```

---

## Feedback Analysis

Two feedback sources:
1. **Day 10 email** → `/feedback/quick` → `feedback_response` events
   - Generic template (`feedback_request`) or behavior-aware variants (`feedback_behavioral`)
   - Behavioral variants: `almost_booked`, `never_visited`, `visited_no_action`, `rejected`
   - Both templates share `kind = 'feedback_request_d10'`; variant tracked in `properties->>'variant'`
2. **Matches page** "Not a fit?" button → `match_rejected` events

### FB-ResponseRate

```sql
-- Feedback email response rate (day-10 email campaign).
-- Includes both generic (feedback_request) and behavioral (feedback_behavioral) templates.
-- Both share kind = 'feedback_request_d10'.
-- Good response rate = email is reaching people, content resonates.
-- Target: >10%. Low = check email deliverability or timing.
WITH emails_sent AS (
  SELECT COUNT(*) AS cnt
  FROM events
  WHERE type = 'email_sent'
    AND properties->>'kind' = 'feedback_request_d10'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
),
responses AS (
  SELECT COUNT(DISTINCT properties->>'patient_id') AS cnt
  FROM events
  WHERE type = 'feedback_response'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
)
SELECT
  emails_sent.cnt AS emails_sent,
  responses.cnt AS responses,
  ROUND(100.0 * responses.cnt / NULLIF(emails_sent.cnt, 0), 1) AS response_rate_pct
FROM emails_sent, responses;
```

### FB-BehavioralVariants

```sql
-- Day 10 behavioral email performance by variant.
-- Compares send volume and response rates across behavioral segments:
--   almost_booked (D), never_visited (A), visited_no_action (B), rejected (C).
-- Generic = no segment data available (fallback to old template).
-- Use to identify which variant drives most engagement.
WITH sends AS (
  SELECT
    COALESCE(properties->>'variant', 'generic') AS variant,
    properties->>'template' AS template,
    COUNT(*) AS sent,
    COUNT(DISTINCT properties->>'patient_id') AS unique_patients
  FROM events
  WHERE type = 'email_sent'
    AND properties->>'kind' = 'feedback_request_d10'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
  GROUP BY properties->>'variant', properties->>'template'
),
responses AS (
  SELECT
    properties->>'patient_id' AS patient_id
  FROM events
  WHERE type = 'feedback_response'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
),
-- Join back to sends to attribute responses to variants
send_events AS (
  SELECT
    COALESCE(properties->>'variant', 'generic') AS variant,
    properties->>'patient_id' AS patient_id
  FROM events
  WHERE type = 'email_sent'
    AND properties->>'kind' = 'feedback_request_d10'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
),
variant_responses AS (
  SELECT
    se.variant,
    COUNT(DISTINCT r.patient_id) AS responses
  FROM send_events se
  JOIN responses r ON se.patient_id = r.patient_id
  GROUP BY se.variant
)
SELECT
  s.variant,
  s.template,
  s.sent,
  s.unique_patients,
  COALESCE(vr.responses, 0) AS responses,
  ROUND(100.0 * COALESCE(vr.responses, 0) / NULLIF(s.unique_patients, 0), 1) AS response_rate_pct
FROM sends s
LEFT JOIN variant_responses vr ON s.variant = vr.variant
ORDER BY s.sent DESC;
```

### FB-RejectedSubVariants

```sql
-- Breakdown of rejected-segment emails by rejection reason.
-- Shows which match rejection reasons triggered behavioral emails.
-- Use to understand why patients reject matches and whether targeted copy helps.
SELECT
  properties->>'rejection_reason' AS rejection_reason,
  COUNT(*) AS sent
FROM events
WHERE type = 'email_sent'
  AND properties->>'kind' = 'feedback_request_d10'
  AND properties->>'variant' = 'rejected'
  AND properties->>'is_test' IS DISTINCT FROM 'true'
  AND created_at >= {{start_date}} AND created_at <= NOW()
GROUP BY properties->>'rejection_reason'
ORDER BY sent DESC;
```

### FB-ByReason

```sql
-- Combined feedback from both sources: Day 10 email and matches page rejections.
-- Shows why patients aren't booking, across all feedback channels.
-- Uses unified reason labels for cross-source analysis.
-- Handles both old (pre-2026-01) and new reason codes for backwards compatibility.
WITH combined AS (
  -- Day 10 email feedback (feedback_response)
  SELECT
    CASE properties->>'reason'
      WHEN 'price_too_high' THEN 'Preis/Kosten'
      WHEN 'unsure_which_therapist' THEN 'Unsicher welcher Therapeut'
      WHEN 'need_more_time' THEN 'Brauche mehr Zeit'
      WHEN 'found_alternative' THEN 'Alternative gefunden'
      WHEN 'match_dissatisfied' THEN 'Empfehlung passt nicht'
      WHEN 'other' THEN 'Sonstiges'
      -- Behavioral email reasons (Jan 2026+)
      WHEN 'method_preference' THEN 'Methodenpräferenz'
      WHEN 'price_feedback' THEN 'Preis-Feedback'
      WHEN 'insurance_preference' THEN 'Kassentherapie-Präferenz'
      WHEN 'almost_booked_feedback' THEN 'Fast gebucht — Feedback'
      WHEN 'profile_feedback' THEN 'Profil-Feedback'
      ELSE properties->>'reason'
    END AS reason,
    'day10_email' AS source
  FROM events
  WHERE type = 'feedback_response'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
  UNION ALL
  -- Matches page rejections (match_rejected) — old + new reason codes
  SELECT
    CASE properties->>'reason'
      -- New codes (Jan 2026+)
      WHEN 'method_wrong' THEN 'Andere Methode gewünscht'
      WHEN 'profile_not_convincing' THEN 'Profil überzeugt nicht'
      WHEN 'too_expensive' THEN 'Zu teuer'
      WHEN 'wants_insurance' THEN 'Suche Kassentherapie'
      -- Old codes (pre Jan 2026) — kept for historical data
      WHEN 'vibe_method' THEN 'Passt nicht (Gefühl/Methode)'
      WHEN 'price_insurance' THEN 'Preis/Kosten'
      -- Unchanged codes
      WHEN 'location_mismatch' THEN 'Standort passt nicht'
      WHEN 'availability_issue' THEN 'Keine passenden Termine'
      WHEN 'gender_mismatch' THEN 'Geschlecht passt nicht'
      ELSE properties->>'reason'
    END AS reason,
    'matches_page' AS source
  FROM events
  WHERE type = 'match_rejected'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
)
SELECT
  reason,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM combined
GROUP BY reason
ORDER BY count DESC;
```

### FB-MatchRejections

```sql
-- Match page rejection reasons ("Not a fit?" button on /matches page).
-- High-signal feedback from users actively evaluating therapists.
-- Use to improve matching algorithm and therapist supply gaps.
-- Handles both old (pre-2026-01) and new reason codes for backwards compatibility.
SELECT
  CASE properties->>'reason'
    -- New codes (Jan 2026+)
    WHEN 'method_wrong' THEN 'Andere Methode gewünscht'
    WHEN 'profile_not_convincing' THEN 'Profil überzeugt nicht'
    WHEN 'too_expensive' THEN 'Zu teuer'
    WHEN 'wants_insurance' THEN 'Suche Kassentherapie'
    -- Old codes (pre Jan 2026) — kept for historical data
    WHEN 'vibe_method' THEN 'Passt nicht (Gefühl/Methode)'
    WHEN 'price_insurance' THEN 'Preis/Krankenkasse'
    -- Unchanged codes
    WHEN 'location_mismatch' THEN 'Standort passt nicht'
    WHEN 'availability_issue' THEN 'Keine passenden Termine'
    WHEN 'gender_mismatch' THEN 'Geschlecht passt nicht'
    ELSE properties->>'reason'
  END AS reason,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct
FROM events
WHERE type = 'match_rejected'
  AND properties->>'is_test' IS DISTINCT FROM 'true'
  AND created_at >= {{start_date}} AND created_at <= NOW()
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
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
),
interviews AS (
  SELECT COUNT(DISTINCT properties->>'patient_id') AS cnt
  FROM events
  WHERE type = 'interview_interest'
    AND properties->>'is_test' IS DISTINCT FROM 'true'
    AND created_at >= {{start_date}} AND created_at <= NOW()
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
    -- Behavioral email reasons (Jan 2026+)
    WHEN 'method_preference' THEN 'Methodenpräferenz'
    WHEN 'price_feedback' THEN 'Preis-Feedback'
    WHEN 'insurance_preference' THEN 'Kassentherapie-Präferenz'
    WHEN 'almost_booked_feedback' THEN 'Fast gebucht — Feedback'
    WHEN 'profile_feedback' THEN 'Profil-Feedback'
    ELSE e.properties->>'reason'
  END AS reason,
  e.properties->>'details' AS details
FROM events e
LEFT JOIN people p ON p.id::text = e.properties->>'patient_id'
WHERE e.type = 'feedback_details'
  AND e.properties->>'is_test' IS DISTINCT FROM 'true'
  AND e.created_at >= {{start_date}} AND e.created_at <= NOW()
ORDER BY e.created_at DESC
LIMIT 50;
```

### FB-WeeklyTrend

```sql
-- Weekly match rejection trend (primary feedback source from matches page).
-- Shows rejection patterns over time. Rising "price" = pricing concerns.
-- Use to track impact of product changes on user sentiment.
-- Includes both old and new reason codes. Old codes will stop appearing after deploy.
SELECT
  date_trunc('week', created_at)::date AS week,
  COUNT(*) AS rejections,
  -- New codes (Jan 2026+)
  COUNT(*) FILTER (WHERE properties->>'reason' = 'method_wrong') AS method_wrong,
  COUNT(*) FILTER (WHERE properties->>'reason' = 'profile_not_convincing') AS profile_unconvincing,
  COUNT(*) FILTER (WHERE properties->>'reason' = 'too_expensive') AS too_expensive,
  COUNT(*) FILTER (WHERE properties->>'reason' = 'wants_insurance') AS wants_insurance,
  -- Unchanged codes
  COUNT(*) FILTER (WHERE properties->>'reason' = 'location_mismatch') AS location,
  COUNT(*) FILTER (WHERE properties->>'reason' = 'availability_issue') AS availability,
  COUNT(*) FILTER (WHERE properties->>'reason' = 'gender_mismatch') AS gender,
  -- Old codes (pre Jan 2026) — will show 0 for new weeks
  COUNT(*) FILTER (WHERE properties->>'reason' = 'vibe_method') AS vibe_method_legacy,
  COUNT(*) FILTER (WHERE properties->>'reason' = 'price_insurance') AS price_legacy
FROM events
WHERE type = 'match_rejected'
  AND properties->>'is_test' IS DISTINCT FROM 'true'
  AND created_at >= {{start_date}} AND created_at <= NOW()
GROUP BY date_trunc('week', created_at)
ORDER BY week DESC;
```

### FB-RejectionContext

```sql
-- Cross-reference rejection reasons with patient/therapist context.
-- Uses enriched context payload added Jan 2026 (events before that lack context).
-- Answer: "Are 'method_wrong' rejections all NARM seekers shown SE therapists?"
-- Use to diagnose whether rejections are supply problems or product problems.
SELECT
  properties->>'reason' AS reason,
  COUNT(*) AS count,
  -- Therapist context
  properties->'context'->>'therapist_city' AS therapist_city,
  properties->'context'->>'therapist_gender' AS therapist_gender,
  properties->'context'->'therapist_modalities' AS therapist_modalities,
  -- Patient context
  properties->'context'->>'patient_city' AS patient_city,
  properties->'context'->>'patient_gender_pref' AS patient_gender_pref,
  properties->'context'->'patient_modalities' AS patient_modalities,
  properties->'context'->'patient_session_prefs' AS patient_session_prefs
FROM events
WHERE type = 'match_rejected'
  AND properties->>'is_test' IS DISTINCT FROM 'true'
  AND properties->'context' IS NOT NULL
  AND created_at >= {{start_date}} AND created_at <= NOW()
GROUP BY
  properties->>'reason',
  properties->'context'->>'therapist_city',
  properties->'context'->>'therapist_gender',
  properties->'context'->'therapist_modalities',
  properties->'context'->>'patient_city',
  properties->'context'->>'patient_gender_pref',
  properties->'context'->'patient_modalities',
  properties->'context'->'patient_session_prefs'
ORDER BY count DESC
LIMIT 50;
```

### FB-RejectionDetails

```sql
-- Free-text details from match page rejections (optional field added Jan 2026).
-- High-value qualitative data - read regularly for product insights.
-- Only events with non-empty details field are shown.
SELECT
  e.created_at,
  CASE e.properties->>'reason'
    WHEN 'method_wrong' THEN 'Andere Methode gewünscht'
    WHEN 'profile_not_convincing' THEN 'Profil überzeugt nicht'
    WHEN 'too_expensive' THEN 'Zu teuer'
    WHEN 'wants_insurance' THEN 'Suche Kassentherapie'
    WHEN 'location_mismatch' THEN 'Standort passt nicht'
    WHEN 'availability_issue' THEN 'Keine passenden Termine'
    WHEN 'gender_mismatch' THEN 'Geschlecht passt nicht'
    ELSE e.properties->>'reason'
  END AS reason,
  e.properties->>'details' AS details,
  e.properties->>'therapist_id' AS therapist_id
FROM events e
WHERE e.type = 'match_rejected'
  AND e.properties->>'details' IS NOT NULL
  AND e.properties->>'is_test' IS DISTINCT FROM 'true'
  AND e.created_at >= {{start_date}} AND e.created_at <= NOW()
ORDER BY e.created_at DESC
LIMIT 50;
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

5. **Feedback Dashboard** (this file, FB-* queries)
   - FB-ResponseRate → Single value card
   - FB-BehavioralVariants → Table (variant performance)
   - FB-ByReason → Horizontal bar chart
   - FB-MatchRejections → Horizontal bar chart
   - FB-WeeklyTrend → Stacked area chart
   - FB-RejectedSubVariants → Horizontal bar chart
   - FB-Details, FB-RejectionDetails → Tables
