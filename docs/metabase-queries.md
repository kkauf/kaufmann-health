# Metabase Product Metrics Queries

SQL queries for critical product metrics in Metabase. Connect to Supabase PostgreSQL.

---

## 1. Core Funnel Metrics

### Patient Acquisition Funnel (Last 30 Days)

```sql
-- Full funnel: Quiz → Verified → Contacted Therapist → Booking
WITH patient_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE type = 'patient') as total_patients,
    COUNT(*) FILTER (WHERE type = 'patient' AND status IN ('new', 'email_confirmed', 'matched')) as verified,
    COUNT(*) FILTER (WHERE type = 'patient' AND status = 'matched') as matched
  FROM people
  WHERE created_at >= NOW() - INTERVAL '30 days'
),
contacted AS (
  SELECT COUNT(DISTINCT patient_id) as contacted_count
  FROM matches
  WHERE status IN ('contacted', 'accepted', 'declined', 'patient_selected', 'completed')
    AND created_at >= NOW() - INTERVAL '30 days'
),
bookings AS (
  SELECT COUNT(DISTINCT patient_id) as booking_count
  FROM bookings
  WHERE created_at >= NOW() - INTERVAL '30 days'
)
SELECT
  p.total_patients as "Quiz Submitted",
  p.verified as "Email Verified",
  c.contacted_count as "Contacted Therapist",
  b.booking_count as "Booked Session",
  ROUND(p.verified::numeric / NULLIF(p.total_patients, 0) * 100, 1) as "Quiz→Verified %",
  ROUND(c.contacted_count::numeric / NULLIF(p.verified, 0) * 100, 1) as "Verified→Contact %",
  ROUND(b.booking_count::numeric / NULLIF(c.contacted_count, 0) * 100, 1) as "Contact→Booking %"
FROM patient_stats p, contacted c, bookings b;
```

### Daily Patient Registrations (Trend)

```sql
SELECT 
  DATE_TRUNC('day', created_at)::date as day,
  COUNT(*) as new_patients,
  COUNT(*) FILTER (WHERE status IN ('new', 'email_confirmed', 'matched')) as verified
FROM people
WHERE type = 'patient'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1;
```

---

## 2. Verification Metrics

### Email Verification Rate

```sql
SELECT
  COUNT(*) as total_patients,
  COUNT(*) FILTER (WHERE status IN ('new', 'email_confirmed', 'matched')) as verified,
  COUNT(*) FILTER (WHERE status = 'pre_confirmation') as pending_verification,
  ROUND(
    COUNT(*) FILTER (WHERE status IN ('new', 'email_confirmed', 'matched'))::numeric / 
    NULLIF(COUNT(*), 0) * 100, 1
  ) as verification_rate_pct
FROM people
WHERE type = 'patient'
  AND created_at >= NOW() - INTERVAL '30 days';
```

### Verification by Contact Method (Email vs Phone)

```sql
SELECT
  COALESCE(metadata->>'contact_method', 'email') as contact_method,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status IN ('new', 'email_confirmed', 'matched')) as verified,
  ROUND(
    COUNT(*) FILTER (WHERE status IN ('new', 'email_confirmed', 'matched'))::numeric / 
    NULLIF(COUNT(*), 0) * 100, 1
  ) as verification_rate_pct
FROM people
WHERE type = 'patient'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY total DESC;
```

---

## 3. Match & Booking Metrics

### Match Status Distribution

```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1) as pct
FROM matches
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY status
ORDER BY count DESC;
```

### Time to First Contact (After Verification)

```sql
WITH verified_patients AS (
  SELECT 
    id,
    (metadata->>'email_confirmed_at')::timestamptz as verified_at
  FROM people
  WHERE type = 'patient'
    AND status IN ('new', 'email_confirmed', 'matched')
    AND metadata->>'email_confirmed_at' IS NOT NULL
    AND created_at >= NOW() - INTERVAL '30 days'
),
first_contact AS (
  SELECT 
    patient_id,
    MIN(created_at) as first_contact_at
  FROM matches
  WHERE status IN ('contacted', 'accepted', 'patient_selected', 'completed')
    AND metadata->>'patient_initiated' = 'true'
  GROUP BY patient_id
)
SELECT
  COUNT(*) as patients_verified,
  COUNT(fc.first_contact_at) as contacted_therapist,
  ROUND(AVG(EXTRACT(EPOCH FROM (fc.first_contact_at - vp.verified_at)) / 3600), 1) as avg_hours_to_contact,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (fc.first_contact_at - vp.verified_at)) / 3600) as median_hours
FROM verified_patients vp
LEFT JOIN first_contact fc ON vp.id = fc.patient_id;
```

### Booking Completion Rate

```sql
SELECT
  COUNT(*) as total_bookings,
  COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'confirmed')::numeric / 
    NULLIF(COUNT(*), 0) * 100, 1
  ) as confirmation_rate_pct
FROM bookings
WHERE created_at >= NOW() - INTERVAL '30 days';
```

---

## 4. Therapist Metrics

### Active Therapists (With Availability)

```sql
SELECT
  COUNT(DISTINCT t.id) as total_verified_therapists,
  COUNT(DISTINCT ts.therapist_id) as with_active_slots,
  ROUND(
    COUNT(DISTINCT ts.therapist_id)::numeric / 
    NULLIF(COUNT(DISTINCT t.id), 0) * 100, 1
  ) as slot_availability_pct
FROM therapists t
LEFT JOIN therapist_slots ts ON t.id = ts.therapist_id AND ts.active = true
WHERE t.status = 'verified';
```

### Therapist Response Rate

```sql
SELECT
  COUNT(*) as total_contacts,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
  COUNT(*) FILTER (WHERE status = 'declined') as declined,
  COUNT(*) FILTER (WHERE status = 'contacted') as no_response,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'accepted')::numeric / 
    NULLIF(COUNT(*) FILTER (WHERE status IN ('accepted', 'declined')), 0) * 100, 1
  ) as acceptance_rate_pct
FROM matches
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND status IN ('contacted', 'accepted', 'declined');
```

---

## 5. Email Cadence Performance

### Post-Verification Email Engagement

```sql
WITH email_stats AS (
  SELECT
    properties->>'kind' as email_type,
    COUNT(*) as sent
  FROM events
  WHERE type = 'email_sent'
    AND properties->>'kind' IN ('rich_therapist_d1', 'selection_nudge_d5', 'feedback_request_d10')
    AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY 1
),
click_stats AS (
  SELECT
    properties->>'utm_campaign' as campaign,
    COUNT(DISTINCT COALESCE(properties->>'patient_id', properties->>'session_id')) as unique_clicks
  FROM events
  WHERE type IN ('match_page_view', 'page_view')
    AND properties->>'utm_source' = 'email'
    AND properties->>'utm_campaign' IN ('rich_therapist_d1', 'selection_nudge_d5', 'feedback_request_d10')
    AND created_at >= NOW() - INTERVAL '30 days'
  GROUP BY 1
)
SELECT
  CASE e.email_type
    WHEN 'rich_therapist_d1' THEN 'Day 1: Rich Therapist'
    WHEN 'selection_nudge_d5' THEN 'Day 5: Selection Nudge'
    WHEN 'feedback_request_d10' THEN 'Day 10: Feedback Request'
  END as email,
  e.sent,
  COALESCE(c.unique_clicks, 0) as clicks,
  ROUND(COALESCE(c.unique_clicks, 0)::numeric / NULLIF(e.sent, 0) * 100, 1) as click_rate_pct
FROM email_stats e
LEFT JOIN click_stats c ON e.email_type = c.campaign
ORDER BY e.email_type;
```

### Email Confirmation Reminder Performance

```sql
SELECT
  properties->>'stage' as reminder_stage,
  COUNT(*) as sent
FROM events
WHERE type = 'email_sent'
  AND properties->>'template' = 'email_confirmation'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 
  CASE properties->>'stage'
    WHEN 'email_confirmation' THEN 1
    WHEN 'patient_confirmation_reminder_24h' THEN 2
    WHEN 'patient_confirmation_reminder_72h' THEN 3
  END;
```

---

## 6. Campaign/Variant Comparison

### A/B Test Results (Test4: Concierge vs Marketplace)

```sql
SELECT
  campaign_variant as variant,
  COUNT(*) as quiz_submitted,
  COUNT(*) FILTER (WHERE status IN ('new', 'email_confirmed', 'matched')) as verified,
  ROUND(
    COUNT(*) FILTER (WHERE status IN ('new', 'email_confirmed', 'matched'))::numeric / 
    NULLIF(COUNT(*), 0) * 100, 1
  ) as verification_rate_pct
FROM people
WHERE type = 'patient'
  AND campaign_variant IN ('concierge', 'marketplace')
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY quiz_submitted DESC;
```

### Variant to Contact Rate

```sql
WITH variant_patients AS (
  SELECT id, campaign_variant
  FROM people
  WHERE type = 'patient'
    AND campaign_variant IN ('concierge', 'marketplace')
    AND status IN ('new', 'email_confirmed', 'matched')
    AND created_at >= NOW() - INTERVAL '30 days'
)
SELECT
  vp.campaign_variant as variant,
  COUNT(DISTINCT vp.id) as verified_patients,
  COUNT(DISTINCT m.patient_id) as contacted_therapist,
  ROUND(
    COUNT(DISTINCT m.patient_id)::numeric / 
    NULLIF(COUNT(DISTINCT vp.id), 0) * 100, 1
  ) as contact_rate_pct
FROM variant_patients vp
LEFT JOIN matches m ON vp.id = m.patient_id 
  AND m.status IN ('contacted', 'accepted', 'patient_selected', 'completed')
GROUP BY 1
ORDER BY verified_patients DESC;
```

---

## 7. Operational Health

### Error Rate (Last 24h)

```sql
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) FILTER (WHERE level = 'error') as errors,
  COUNT(*) as total_events,
  ROUND(
    COUNT(*) FILTER (WHERE level = 'error')::numeric / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as error_rate_pct
FROM events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1;
```

### Top Errors by Source

```sql
SELECT
  properties->>'source' as source,
  properties->>'message' as error_message,
  COUNT(*) as count
FROM events
WHERE type = 'error'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY count DESC
LIMIT 20;
```

---

## 8. Weekly KPI Dashboard

### Executive Summary (Copy-Paste for Weekly Report)

```sql
WITH period AS (
  SELECT 
    NOW() - INTERVAL '7 days' as start_date,
    NOW() - INTERVAL '14 days' as prev_start_date
),
current_week AS (
  SELECT
    COUNT(*) as new_patients,
    COUNT(*) FILTER (WHERE status IN ('new', 'email_confirmed', 'matched')) as verified
  FROM people, period
  WHERE type = 'patient' AND created_at >= period.start_date
),
prev_week AS (
  SELECT
    COUNT(*) as new_patients,
    COUNT(*) FILTER (WHERE status IN ('new', 'email_confirmed', 'matched')) as verified
  FROM people, period
  WHERE type = 'patient' 
    AND created_at >= period.prev_start_date 
    AND created_at < period.start_date
),
current_contacts AS (
  SELECT COUNT(DISTINCT patient_id) as contacted
  FROM matches, period
  WHERE status IN ('contacted', 'accepted', 'patient_selected', 'completed')
    AND created_at >= period.start_date
),
prev_contacts AS (
  SELECT COUNT(DISTINCT patient_id) as contacted
  FROM matches, period
  WHERE status IN ('contacted', 'accepted', 'patient_selected', 'completed')
    AND created_at >= period.prev_start_date
    AND created_at < period.start_date
),
current_bookings AS (
  SELECT COUNT(*) as bookings
  FROM bookings, period
  WHERE created_at >= period.start_date
),
prev_bookings AS (
  SELECT COUNT(*) as bookings
  FROM bookings, period
  WHERE created_at >= period.prev_start_date
    AND created_at < period.start_date
)
SELECT
  'This Week' as period,
  cw.new_patients as "New Patients",
  cw.verified as "Verified",
  cc.contacted as "Contacted Therapist",
  cb.bookings as "Bookings"
FROM current_week cw, current_contacts cc, current_bookings cb
UNION ALL
SELECT
  'Last Week',
  pw.new_patients,
  pw.verified,
  pc.contacted,
  pb.bookings
FROM prev_week pw, prev_contacts pc, prev_bookings pb;
```

---

## Notes

- **Time ranges**: Most queries default to 30 days. Adjust `INTERVAL` as needed.
- **Test data**: Queries don't filter `is_test` - add filter if needed: `AND (properties->>'is_test')::boolean IS NOT TRUE`
- **Campaign variants**: Current A/B test uses `concierge` and `marketplace` in `campaign_variant` column.
- **Contact method**: `metadata->>'contact_method'` is `email` or `phone` for patient verification type.

Last updated: 2024-12-09
