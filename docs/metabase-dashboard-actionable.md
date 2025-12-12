# Metabase Dashboard — Actionable Matching (Lead-Level)

This is a **playbook for rebuilding the existing Metabase dashboard** so it drives business decisions.

Key shift: **measure success per lead**, not per match.

- A lead typically gets **up to 3 proposed therapists**.
- The lead is a “success” if **at least one** therapist accepts (and ideally a booking happens).
- Match-level distributions hide whether you are:
  - creating enough proposals,
  - sending selection effectively,
  - getting therapists to accept,
  - converting accepts into bookings.

---

## Definitions (business)

### Entities
- **Lead**: `public.people` where `type = 'patient'` and `status IS DISTINCT FROM 'anonymous'`
- **Match**: `public.matches` (one patient ↔ one therapist)
- **Booking**: `public.bookings` (primary conversion proxy)

### Match statuses (current)
`proposed → patient_selected → accepted | declined → session_booked → completed | failed`

Note:
- `suggested` exists in production data (mostly tied to `people.status='anonymous'`), and should be treated like `proposed` for browse-only analysis.

(There are also admin/outreach statuses like `therapist_contacted`, `therapist_responded`.)

### Flow types
- **Manual curated matching (concierge)**: admin creates several `matches` and sends a selection email.
- **Instant matches (self-serve matching page)**: the system creates matches for browsing (often identifiable via `matches.metadata.match_quality`).
- **Patient-initiated contact (directory / self-serve contact)**: created via directory contact; stored on `matches.metadata.patient_initiated = true`.

### Success (lead-level)
- **Accepted lead**: lead has **≥ 1** match in `('accepted','session_booked','completed')`
- **Booked lead**: lead has **≥ 1** booking

### Lead cohorts (critical for correct metrics)
- **Anonymous patient**: `people.status = 'anonymous'` (questionnaire-only; no direct revenue signal yet)
- **Qualified lead (recommended dashboard default)**: `people.status IS DISTINCT FROM 'anonymous'`

---

## Metabase setup rules

### Global filters
- **Date range**: filter on `people.created_at` (cohorting by lead creation date)
- **Exclude tests** (use in every query)

```sql
lower(coalesce(people.metadata->>'is_test','false')) <> 'true'
```

For matches:

```sql
lower(coalesce(matches.metadata->>'is_test','false')) <> 'true'
```

For business/ops funnel (recommended default):

```sql
people.status IS DISTINCT FROM 'anonymous'
```

### Segmentation knobs (high leverage)
Add these as group-bys or dashboard filters:
- `people.campaign_source`
- `people.campaign_variant`
- `matches.metadata->>'patient_initiated'` (curated vs directory)

Recommended normalization (because `campaign_variant` is free-form and may include query strings):

```sql
split_part(lower(coalesce(people.campaign_variant, '')), '?', 1)
```

Recommended additional segment:

```sql
matches.metadata ? 'match_quality'
```

---

## Data sanity checks (run first in Metabase)

These catch the two most common early-stage problems: **messy attribution values** and **status drift/legacy data**.

### A) Campaign variants present (last 30d)

```sql
select
  coalesce(split_part(lower(campaign_variant), '?', 1), '(null)') as campaign_variant_norm,
  count(*) as leads
from people
where type = 'patient'
  and created_at >= now() - interval '30 days'
  and lower(coalesce(metadata->>'is_test','false')) <> 'true'
group by 1
order by leads desc;
```

### B) Match statuses present (all-time)

```sql
select status, count(*) as matches
from matches
where lower(coalesce(metadata->>'is_test','false')) <> 'true'
group by 1
order by matches desc;
```

### C) Is `patient_selected` tracking actually populated?

```sql
select
  count(*) as total,
  count(*) filter (where properties ? 'match_id') as with_match_id,
  count(*) filter (where properties ? 'patient_id') as with_patient_id,
  count(*) filter (where properties ? 'therapist_id') as with_therapist_id
from events
where type = 'patient_selected';
```

### D) Are response timestamps populated?

```sql
select
  count(*) as total_matches,
  count(*) filter (where responded_at is not null) as responded_at_set,
  count(*) filter (where therapist_responded_at is not null) as therapist_responded_at_set
from matches
where lower(coalesce(metadata->>'is_test','false')) <> 'true';
```

---

## Recommended Metabase dashboard layout (how to actually use this)

The dashboard is only actionable if it clearly answers:
- **Exec**: “Are we converting leads into bookings (and which variant is winning)?”
- **Ops**: “What do I need to do today?”
- **Supply**: “What do we need to recruit/build next?”

### Recommended structure (one dashboard with sections, or multiple dashboards)

#### Section A — Exec / Dec 20 decision (weekly view)
- **Card 1** — North Star KPIs (lead-level)
- **Card 2** — Lead stage distribution
- **Card 7** — Time-to-stage by `campaign_variant` (use the normalized variant expression above)
- **Card 13** — Revenue proxy (bookings-based)

#### Section B — Daily Ops (queues)
- **Card 11** — Concierge leads with no proposals after 24h
- **Card 6** — Waiting on patient selection (48h+)
- **Card 12** — Waiting on therapist response after selection (24h+)
- **Card 19** — Accepted but no booking after 7 days
- **Card 20** — All selected therapists declined

#### Section C — Therapist performance
- **Card 9** — Therapist leaderboard (selected → responded → accepted → booked)
- **Card 10** — Therapist response time (p50/p90)

#### Section D — Directory contact funnel (patient-initiated)
- **Card 14** — Directory contact funnel (lead-level)
- **Card 15** — Therapists contacted per lead (distribution)
- **Card 16** — Directory contacts waiting on therapist response (48h+)

#### Section E — Recruiting / supply
- **Card 17** — Supply gaps (top unmet demand)
- **Card 18** — Supply gaps vs booking (self-serve impact)

### Dashboard-level filters (recommended)

At minimum:
- **Date range**: cohort by `people.created_at`
- **Variant**: `people.campaign_variant` (normalize; expect values like `concierge`, `marketplace`, `quiz`, `direct`)
- **Campaign source**: `people.campaign_source`

Optional:
- **Flow type**:
  - curated: `matches.metadata->>'patient_initiated' <> 'true'`
  - directory: `people.metadata->>'source' = 'directory_contact'`

---

---

# Recommended dashboard cards (with SQL)

Each card includes the **decision it supports**.

---

## Card 1 — North Star KPIs (lead-level)

**Decision**: Is matching improving or getting worse week-over-week? If worse, which downstream stage is failing?

**Viz**: KPI table

```sql
WITH leads AS (
  SELECT
    p.id,
    p.created_at,
    p.campaign_source,
    p.campaign_variant,
    p.metadata
  FROM people p
  WHERE p.type = 'patient'
    AND p.status IS DISTINCT FROM 'anonymous'
    AND p.created_at >= NOW() - INTERVAL '30 days'
    AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
),
match_agg AS (
  SELECT
    m.patient_id,
    COUNT(*) AS matches_total,
    COUNT(*) FILTER (
      WHERE m.status IN ('accepted','session_booked','completed')
    ) AS accepted_matches
  FROM matches m
  JOIN leads l ON l.id = m.patient_id
  WHERE lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
  GROUP BY 1
),
booking_agg AS (
  SELECT
    b.patient_id,
    COUNT(*) AS bookings
  FROM bookings b
  JOIN leads l ON l.id = b.patient_id
  GROUP BY 1
)
SELECT
  COUNT(*) AS leads_created,
  COUNT(*) FILTER (WHERE COALESCE(ma.matches_total, 0) > 0) AS leads_with_any_match,
  COUNT(*) FILTER (WHERE COALESCE(ma.accepted_matches, 0) > 0) AS leads_with_acceptance,
  COUNT(*) FILTER (WHERE COALESCE(ba.bookings, 0) > 0) AS leads_with_booking,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE COALESCE(ma.accepted_matches, 0) > 0)
    / NULLIF(COUNT(*), 0),
    1
  ) AS lead_accept_rate_pct,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE COALESCE(ba.bookings, 0) > 0)
    / NULLIF(COUNT(*), 0),
    1
  ) AS lead_booking_rate_pct
FROM leads l
LEFT JOIN match_agg ma ON ma.patient_id = l.id
LEFT JOIN booking_agg ba ON ba.patient_id = l.id;
```

---

## Card 2 — Lead stage distribution (actionable)

**Decision**: Where are leads getting stuck (ops backlog vs patient selection vs therapist acceptance vs booking friction)?

**Viz**: bar chart of `stage` vs `leads`

```sql
WITH leads AS (
  SELECT p.id, p.created_at, p.metadata
  FROM people p
  WHERE p.type = 'patient'
    AND p.status IS DISTINCT FROM 'anonymous'
    AND p.created_at >= NOW() - INTERVAL '30 days'
    AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
),
match_agg AS (
  SELECT
    m.patient_id,
    COUNT(*) FILTER (
      WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
    ) AS proposals_total,
    COUNT(*) FILTER (
      WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
        AND m.status IN ('patient_selected','accepted','declined','session_booked','completed','failed')
    ) AS contacted_count,
    COUNT(*) FILTER (
      WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
        AND m.status IN ('accepted','session_booked','completed')
    ) AS accepted_count,
    COUNT(*) FILTER (
      WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
        AND m.status = 'declined'
    ) AS declined_count
  FROM matches m
  JOIN leads l ON l.id = m.patient_id
  WHERE lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
  GROUP BY 1
),
booking_agg AS (
  SELECT b.patient_id, COUNT(*) AS bookings
  FROM bookings b
  JOIN leads l ON l.id = b.patient_id
  GROUP BY 1
),
per_lead AS (
  SELECT
    l.id AS patient_id,
    COALESCE(ma.proposals_total, 0) AS proposals_total,
    COALESCE(ma.contacted_count, 0) AS contacted_count,
    COALESCE(ma.accepted_count, 0) AS accepted_count,
    COALESCE(ma.declined_count, 0) AS declined_count,
    COALESCE(ba.bookings, 0) AS bookings
  FROM leads l
  LEFT JOIN match_agg ma ON ma.patient_id = l.id
  LEFT JOIN booking_agg ba ON ba.patient_id = l.id
)
SELECT
  CASE
    WHEN bookings > 0 THEN '5_booked'
    WHEN accepted_count > 0 THEN '4_accepted_not_booked'
    WHEN contacted_count > 0 AND accepted_count = 0 AND declined_count = contacted_count THEN '3_all_declined_needs_more_options'
    WHEN contacted_count > 0 AND accepted_count = 0 THEN '2_waiting_therapist_response'
    WHEN proposals_total > 0 AND contacted_count = 0 THEN '1_waiting_patient_selection'
    ELSE '0_no_proposals_yet'
  END AS stage,
  COUNT(*) AS leads,
  ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
FROM per_lead
GROUP BY 1
ORDER BY 1;
```

---

## Card 3 — Proposals per lead (distribution + mean)

**Decision**: Are we needing more “waves” of proposals? If yes: supply gaps or matching quality issue.

**Viz**: histogram

```sql
WITH leads AS (
  SELECT p.id, p.metadata
  FROM people p
  WHERE p.type = 'patient'
    AND p.status IS DISTINCT FROM 'anonymous'
    AND p.created_at >= NOW() - INTERVAL '30 days'
    AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
),
counts AS (
  SELECT
    l.id AS patient_id,
    COUNT(m.id) FILTER (
      WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
    ) AS proposals_total
  FROM leads l
  LEFT JOIN matches m
    ON m.patient_id = l.id
   AND lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
  GROUP BY 1
),
with_mean AS (
  SELECT
    patient_id,
    proposals_total,
    AVG(proposals_total) OVER () AS mean_proposals_per_lead
  FROM counts
),
bucketed AS (
  SELECT
    CASE
      WHEN proposals_total >= 6 THEN '6+'
      ELSE proposals_total::text
    END AS proposals_bucket,
    mean_proposals_per_lead
  FROM with_mean
)
SELECT
  proposals_bucket,
  COUNT(*) AS leads,
  ROUND(MAX(mean_proposals_per_lead)::numeric, 2) AS mean_proposals_per_lead
FROM bucketed
GROUP BY 1
ORDER BY
  CASE
    WHEN proposals_bucket = '6+' THEN 999
    ELSE proposals_bucket::int
  END;
```

---

## Card 4 — Therapists contacted per lead (distribution + mean)

Interpretation (curated flow): a therapist is “contacted” when a match is **selected** by the patient (status is `patient_selected` or later).

**Decision**: If many leads need 2–3+ contacts, first-choice matching quality or therapist acceptance is the bottleneck.

**Viz**: histogram

```sql
WITH leads AS (
  SELECT p.id, p.metadata
  FROM people p
  WHERE p.type = 'patient'
    AND p.status IS DISTINCT FROM 'anonymous'
    AND p.created_at >= NOW() - INTERVAL '30 days'
    AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
),
per_lead AS (
  SELECT
    l.id AS patient_id,
    COUNT(m.id) FILTER (
      WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
        AND m.status IN ('patient_selected','accepted','declined','session_booked','completed','failed')
    ) AS contacted_count
  FROM leads l
  LEFT JOIN matches m
    ON m.patient_id = l.id
   AND lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
  GROUP BY 1
),
with_mean AS (
  SELECT
    patient_id,
    contacted_count,
    AVG(contacted_count) OVER () AS mean_contacted_per_lead
  FROM per_lead
),
bucketed AS (
  SELECT
    CASE
      WHEN contacted_count >= 5 THEN '5+'
      ELSE contacted_count::text
    END AS contacted_bucket,
    mean_contacted_per_lead
  FROM with_mean
)
SELECT
  contacted_bucket,
  COUNT(*) AS leads,
  ROUND(MAX(mean_contacted_per_lead)::numeric, 2) AS mean_contacted_per_lead
FROM bucketed
GROUP BY 1
ORDER BY
  CASE
    WHEN contacted_bucket = '5+' THEN 999
    ELSE contacted_bucket::int
  END;
```

---

## Card 5 — Conversion by campaign (accept/book + effort)

**Decision**: Which campaign variants bring leads that convert, and which ones create heavy ops workload (high contacted/proposals)?

**Viz**: table (sortable)

```sql
WITH leads AS (
  SELECT
    p.id,
    p.campaign_source,
    p.campaign_variant,
    p.metadata
  FROM people p
  WHERE p.type = 'patient'
    AND p.status IS DISTINCT FROM 'anonymous'
    AND p.created_at >= NOW() - INTERVAL '30 days'
    AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
),
match_agg AS (
  SELECT
    m.patient_id,
    COUNT(*) FILTER (
      WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
    ) AS proposals_total,
    COUNT(*) FILTER (
      WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
        AND m.status IN ('patient_selected','accepted','declined','session_booked','completed','failed')
    ) AS contacted_count,
    COUNT(*) FILTER (
      WHERE m.status IN ('accepted','session_booked','completed')
    ) AS accepted_matches
  FROM matches m
  JOIN leads l ON l.id = m.patient_id
  WHERE lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
  GROUP BY 1
),
booking_agg AS (
  SELECT b.patient_id, COUNT(*) AS bookings
  FROM bookings b
  JOIN leads l ON l.id = b.patient_id
  GROUP BY 1
),
per_lead AS (
  SELECT
    l.campaign_source,
    l.campaign_variant,
    (COALESCE(ma.accepted_matches, 0) > 0) AS has_accept,
    (COALESCE(ba.bookings, 0) > 0) AS has_booking,
    COALESCE(ma.proposals_total, 0) AS proposals_total,
    COALESCE(ma.contacted_count, 0) AS contacted_count
  FROM leads l
  LEFT JOIN match_agg ma ON ma.patient_id = l.id
  LEFT JOIN booking_agg ba ON ba.patient_id = l.id
)
SELECT
  COALESCE(campaign_source, '(unknown)') AS campaign_source,
  COALESCE(campaign_variant, '(none)') AS campaign_variant,
  COUNT(*) AS leads,
  ROUND(100.0 * AVG((has_accept)::int), 1) AS accept_rate_pct,
  ROUND(100.0 * AVG((has_booking)::int), 1) AS booking_rate_pct,
  ROUND(AVG(proposals_total), 2) AS mean_proposals,
  ROUND(AVG(contacted_count), 2) AS mean_contacted
FROM per_lead
GROUP BY 1, 2
ORDER BY leads DESC;
```

---

## Card 6 — Ops queue: waiting on patient selection (48h+)

**Decision**: Who needs a resend / follow-up today?

**Viz**: table

```sql
WITH leads AS (
  SELECT p.id, p.created_at, p.campaign_source, p.campaign_variant, p.metadata
  FROM people p
  WHERE p.type = 'patient'
    AND p.status IS DISTINCT FROM 'anonymous'
    AND p.created_at >= NOW() - INTERVAL '30 days'
    AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
),
match_agg AS (
  SELECT
    m.patient_id,
    MIN(m.created_at) FILTER (
      WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
    ) AS first_proposed_at,
    COUNT(*) FILTER (
      WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
    ) AS proposals_total,
    COUNT(*) FILTER (
      WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
        AND m.status IN ('patient_selected','accepted','declined','session_booked','completed','failed')
    ) AS contacted_count
  FROM matches m
  JOIN leads l ON l.id = m.patient_id
  WHERE lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
  GROUP BY 1
)
SELECT
  l.id AS patient_id,
  l.created_at AS lead_created_at,
  l.campaign_source,
  l.campaign_variant,
  ma.first_proposed_at,
  ma.proposals_total,
  NOW() - ma.first_proposed_at AS age_since_first_proposal
FROM leads l
JOIN match_agg ma ON ma.patient_id = l.id
WHERE ma.proposals_total > 0
  AND ma.contacted_count = 0
  AND ma.first_proposed_at < NOW() - INTERVAL '48 hours'
ORDER BY ma.first_proposed_at ASC;
```

---

## Card 7 — Time-to-stage (hours, p50) by Test 4 variant

**Decision**: Where do delays kill conversions (proposal latency vs selection vs therapist response vs booking)?

Notes:
- “Selection” uses `events.type='patient_selected'` (there is no `patient_selected_at` column on `matches`).

**Viz**: table

```sql
WITH leads AS (
  SELECT
    p.id,
    p.created_at,
    p.campaign_variant,
    p.metadata
  FROM people p
  WHERE p.type = 'patient'
    AND p.status IS DISTINCT FROM 'anonymous'
    AND p.created_at >= NOW() - INTERVAL '30 days'
    AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
),
curated_matches AS (
  SELECT m.*
  FROM matches m
  JOIN leads l ON l.id = m.patient_id
  WHERE lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
    AND lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
),
first_proposal AS (
  SELECT patient_id, MIN(created_at) AS first_proposed_at
  FROM curated_matches
  GROUP BY 1
),
first_selection AS (
  SELECT
    patient_id,
    MIN(created_at) AS first_selected_at
  FROM (
    SELECT
      CASE
        WHEN (properties->>'patient_id') ~* '^[0-9a-f-]{36}$' THEN (properties->>'patient_id')::uuid
        ELSE NULL
      END AS patient_id,
      created_at
    FROM events
    WHERE type = 'patient_selected'
      AND created_at >= NOW() - INTERVAL '30 days'
  ) s
  WHERE s.patient_id IS NOT NULL
  GROUP BY 1
),
first_accept AS (
  SELECT
    patient_id,
    MIN(COALESCE(responded_at, therapist_responded_at)) AS first_accepted_at
  FROM curated_matches
  WHERE status IN ('accepted','session_booked','completed')
    AND COALESCE(responded_at, therapist_responded_at) IS NOT NULL
  GROUP BY 1
),
first_booking AS (
  SELECT b.patient_id, MIN(b.created_at) AS first_booking_at
  FROM bookings b
  JOIN leads l ON l.id = b.patient_id
  GROUP BY 1
),
per_lead AS (
  SELECT
    l.id AS patient_id,
    l.campaign_variant,
    l.created_at AS lead_created_at,
    fp.first_proposed_at,
    fs.first_selected_at,
    fa.first_accepted_at,
    fb.first_booking_at,
    EXTRACT(EPOCH FROM (fp.first_proposed_at - l.created_at)) / 3600.0 AS h_lead_to_first_proposal,
    EXTRACT(EPOCH FROM (fs.first_selected_at - fp.first_proposed_at)) / 3600.0 AS h_proposal_to_selection,
    EXTRACT(EPOCH FROM (fa.first_accepted_at - fs.first_selected_at)) / 3600.0 AS h_selection_to_accept,
    EXTRACT(EPOCH FROM (fb.first_booking_at - fa.first_accepted_at)) / 3600.0 AS h_accept_to_booking,
    EXTRACT(EPOCH FROM (fb.first_booking_at - l.created_at)) / 3600.0 AS h_lead_to_booking
  FROM leads l
  LEFT JOIN first_proposal fp ON fp.patient_id = l.id
  LEFT JOIN first_selection fs ON fs.patient_id = l.id
  LEFT JOIN first_accept fa ON fa.patient_id = l.id
  LEFT JOIN first_booking fb ON fb.patient_id = l.id
)
SELECT
  COALESCE(campaign_variant, '(none)') AS campaign_variant,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE first_proposed_at IS NOT NULL) AS leads_with_proposal,
  COUNT(*) FILTER (WHERE first_selected_at IS NOT NULL) AS leads_with_selection,
  COUNT(*) FILTER (WHERE first_accepted_at IS NOT NULL) AS leads_with_accept,
  COUNT(*) FILTER (WHERE first_booking_at IS NOT NULL) AS leads_with_booking,
  ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY h_lead_to_first_proposal) FILTER (WHERE h_lead_to_first_proposal IS NOT NULL))::numeric, 1) AS p50_h_lead_to_first_proposal,
  ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY h_proposal_to_selection) FILTER (WHERE h_proposal_to_selection IS NOT NULL))::numeric, 1) AS p50_h_proposal_to_selection,
  ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY h_selection_to_accept) FILTER (WHERE h_selection_to_accept IS NOT NULL))::numeric, 1) AS p50_h_selection_to_accept,
  ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY h_accept_to_booking) FILTER (WHERE h_accept_to_booking IS NOT NULL))::numeric, 1) AS p50_h_accept_to_booking,
  ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY h_lead_to_booking) FILTER (WHERE h_lead_to_booking IS NOT NULL))::numeric, 1) AS p50_h_lead_to_booking
FROM per_lead
GROUP BY 1
ORDER BY leads DESC;
```

---

## Card 8 — Which proposal number produced the first acceptance?

**Decision**: Do we usually win on the 1st proposal, or do we need 2–3+ (supply or matching quality issue)?

**Viz**: bar chart

```sql
WITH leads AS (
  SELECT p.id, p.metadata
  FROM people p
  WHERE p.type = 'patient'
    AND p.status IS DISTINCT FROM 'anonymous'
    AND p.created_at >= NOW() - INTERVAL '30 days'
    AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
),
curated_matches AS (
  SELECT m.*
  FROM matches m
  JOIN leads l ON l.id = m.patient_id
  WHERE lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
    AND lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
),
ranked AS (
  SELECT
    m.patient_id,
    m.status,
    ROW_NUMBER() OVER (PARTITION BY m.patient_id ORDER BY m.created_at) AS proposal_n
  FROM curated_matches m
),
per_lead AS (
  SELECT
    l.id AS patient_id,
    COALESCE(MAX(r.proposal_n), 0) AS proposals_total,
    MIN(r.proposal_n) FILTER (WHERE r.status IN ('accepted','session_booked','completed')) AS first_accept_proposal_n
  FROM leads l
  LEFT JOIN ranked r ON r.patient_id = l.id
  GROUP BY 1
)
SELECT *
FROM (
  SELECT
    CASE
      WHEN proposals_total = 0 THEN '0_no_proposals'
      WHEN first_accept_proposal_n IS NULL THEN 'no_accept_yet'
      WHEN first_accept_proposal_n >= 4 THEN '4+'
      ELSE first_accept_proposal_n::text
    END AS bucket,
    COUNT(*) AS leads,
    ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
  FROM per_lead
  GROUP BY 1
) q
ORDER BY
  CASE
    WHEN bucket = '0_no_proposals' THEN -1
    WHEN bucket = 'no_accept_yet' THEN 999
    WHEN bucket = '4+' THEN 998
    ELSE bucket::int
  END;
```

 ---

 ## Card 9 — Therapist leaderboard (selected → responded → accepted → booked)

 **Decision**: Which therapists are bottlenecks (low response rate / low accept rate / low booking-after-selection rate)?

 Notes:
 - This uses `events.type='patient_selected'` as the denominator (actual patient choice), then looks at the match’s current status.
 - Filters out `matches.metadata.patient_initiated = true`.

 **Viz**: sortable table

 ```sql
 WITH selections AS (
   SELECT
     CASE
       WHEN (properties->>'match_id') ~* '^[0-9a-f-]{36}$' THEN (properties->>'match_id')::uuid
       ELSE NULL
     END AS match_id,
     CASE
       WHEN (properties->>'therapist_id') ~* '^[0-9a-f-]{36}$' THEN (properties->>'therapist_id')::uuid
       ELSE NULL
     END AS therapist_id,
     MIN(created_at) AS selected_at
   FROM events
   WHERE type = 'patient_selected'
     AND created_at >= NOW() - INTERVAL '30 days'
   GROUP BY 1, 2
 ),
 selected_matches AS (
   SELECT
     s.match_id,
     s.therapist_id,
     s.selected_at,
     m.patient_id,
     m.status
   FROM selections s
   JOIN matches m ON m.id = s.match_id
   JOIN people p ON p.id = m.patient_id
   WHERE s.match_id IS NOT NULL
     AND s.therapist_id IS NOT NULL
     AND p.type = 'patient'
     AND p.status IS DISTINCT FROM 'anonymous'
     AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
     AND lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
     AND lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
 ),
 bookings_14d AS (
   SELECT
     sm.match_id,
     COUNT(b.id) AS bookings_in_14d
   FROM selected_matches sm
   LEFT JOIN bookings b
     ON b.patient_id = sm.patient_id
    AND b.therapist_id = sm.therapist_id
    AND b.created_at >= sm.selected_at
    AND b.created_at < sm.selected_at + INTERVAL '14 days'
   GROUP BY 1
 )
 SELECT
   t.id AS therapist_id,
   TRIM(CONCAT(COALESCE(t.first_name,''), ' ', COALESCE(t.last_name,''))) AS therapist_name,
   COUNT(*) AS selected_matches,
   COUNT(*) FILTER (WHERE sm.status IN ('accepted','declined','therapist_responded','session_booked','completed','failed')) AS responded_matches,
   COUNT(*) FILTER (WHERE sm.status IN ('accepted','session_booked','completed')) AS accepted_matches,
   COUNT(*) FILTER (WHERE sm.status = 'declined') AS declined_matches,
   COUNT(*) FILTER (WHERE COALESCE(b14.bookings_in_14d, 0) > 0) AS booked_in_14d_matches,
   ROUND(
     100.0 * COUNT(*) FILTER (WHERE sm.status IN ('accepted','declined','therapist_responded','session_booked','completed','failed'))
     / NULLIF(COUNT(*), 0),
     1
   ) AS response_rate_pct,
   ROUND(
     100.0 * COUNT(*) FILTER (WHERE sm.status IN ('accepted','session_booked','completed'))
     / NULLIF(COUNT(*) FILTER (WHERE sm.status IN ('accepted','declined','therapist_responded','session_booked','completed','failed')), 0),
     1
   ) AS accept_rate_pct,
   ROUND(
     100.0 * COUNT(*) FILTER (WHERE COALESCE(b14.bookings_in_14d, 0) > 0)
     / NULLIF(COUNT(*), 0),
     1
   ) AS booking_rate_14d_after_selection_pct
 FROM selected_matches sm
 JOIN therapists t ON t.id = sm.therapist_id
 LEFT JOIN bookings_14d b14 ON b14.match_id = sm.match_id
 GROUP BY 1, 2
 ORDER BY selected_matches DESC;
 ```

 ---

 ## Card 10 — Therapist response time (hours, p50/p90)

 **Decision**: Who is slow to respond after being selected?

 **Viz**: table

 ```sql
 WITH selections AS (
   SELECT
     CASE
       WHEN (properties->>'match_id') ~* '^[0-9a-f-]{36}$' THEN (properties->>'match_id')::uuid
       ELSE NULL
     END AS match_id,
     CASE
       WHEN (properties->>'therapist_id') ~* '^[0-9a-f-]{36}$' THEN (properties->>'therapist_id')::uuid
       ELSE NULL
     END AS therapist_id,
     MIN(created_at) AS selected_at
   FROM events
   WHERE type = 'patient_selected'
     AND created_at >= NOW() - INTERVAL '30 days'
   GROUP BY 1, 2
 ),
 responded AS (
   SELECT
     s.therapist_id,
     s.selected_at,
     COALESCE(m.responded_at, m.therapist_responded_at) AS responded_at
   FROM selections s
   JOIN matches m ON m.id = s.match_id
   JOIN people p ON p.id = m.patient_id
   WHERE s.match_id IS NOT NULL
     AND s.therapist_id IS NOT NULL
     AND p.type = 'patient'
     AND p.status IS DISTINCT FROM 'anonymous'
     AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
     AND lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
     AND lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
     AND COALESCE(m.responded_at, m.therapist_responded_at) IS NOT NULL
 ),
 per_match AS (
   SELECT
     therapist_id,
     EXTRACT(EPOCH FROM (responded_at - selected_at)) / 3600.0 AS h_selection_to_response
   FROM responded
 )
 SELECT
   t.id AS therapist_id,
   TRIM(CONCAT(COALESCE(t.first_name,''), ' ', COALESCE(t.last_name,''))) AS therapist_name,
   COUNT(*) AS responded_matches,
   ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY h_selection_to_response))::numeric, 1) AS p50_h_selection_to_response,
   ROUND((percentile_cont(0.9) WITHIN GROUP (ORDER BY h_selection_to_response))::numeric, 1) AS p90_h_selection_to_response
 FROM per_match pm
 JOIN therapists t ON t.id = pm.therapist_id
 GROUP BY 1, 2
 ORDER BY responded_matches DESC;
 ```

 ---

 ## Card 11 — Ops queue: Concierge leads with no proposals after 24h

 **Decision**: Which concierge leads need manual matching right now?

 **Viz**: table

 ```sql
 WITH leads AS (
   SELECT
     p.id,
     p.created_at,
     p.campaign_source,
     p.campaign_variant,
     p.metadata
   FROM people p
   WHERE p.type = 'patient'
     AND p.status IS DISTINCT FROM 'anonymous'
     AND p.created_at >= NOW() - INTERVAL '30 days'
     AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
     AND split_part(lower(coalesce(p.campaign_variant, '')), '?', 1) = 'concierge'
 ),
 match_counts AS (
   SELECT
     m.patient_id,
     COUNT(*) FILTER (WHERE lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true') AS curated_matches
   FROM matches m
   JOIN leads l ON l.id = m.patient_id
   WHERE lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
   GROUP BY 1
 )
 SELECT
   l.id AS patient_id,
   l.created_at AS lead_created_at,
   NOW() - l.created_at AS age_since_lead,
   l.campaign_source,
   l.campaign_variant,
   l.metadata->>'city' AS city,
   l.metadata->>'issue' AS issue
 FROM leads l
 LEFT JOIN match_counts mc ON mc.patient_id = l.id
 WHERE COALESCE(mc.curated_matches, 0) = 0
   AND l.created_at < NOW() - INTERVAL '24 hours'
 ORDER BY l.created_at ASC;
 ```

 ---

 ## Card 12 — Ops queue: Waiting on therapist response (24h+ after selection)

 **Decision**: Which selected matches need therapist reminders / follow-up?

 **Viz**: table

 ```sql
 WITH selections AS (
   SELECT
     CASE
       WHEN (properties->>'match_id') ~* '^[0-9a-f-]{36}$' THEN (properties->>'match_id')::uuid
       ELSE NULL
     END AS match_id,
     CASE
       WHEN (properties->>'patient_id') ~* '^[0-9a-f-]{36}$' THEN (properties->>'patient_id')::uuid
       ELSE NULL
     END AS patient_id,
     CASE
       WHEN (properties->>'therapist_id') ~* '^[0-9a-f-]{36}$' THEN (properties->>'therapist_id')::uuid
       ELSE NULL
     END AS therapist_id,
     MIN(created_at) AS selected_at
   FROM events
   WHERE type = 'patient_selected'
     AND created_at >= NOW() - INTERVAL '30 days'
   GROUP BY 1, 2, 3
 )
 SELECT
   m.id AS match_id,
   m.secure_uuid,
   p.id AS patient_id,
   p.campaign_variant,
   t.id AS therapist_id,
   TRIM(CONCAT(COALESCE(t.first_name,''), ' ', COALESCE(t.last_name,''))) AS therapist_name,
   s.selected_at,
   NOW() - s.selected_at AS age_since_selection
 FROM selections s
 JOIN matches m ON m.id = s.match_id
 JOIN people p ON p.id = m.patient_id
 JOIN therapists t ON t.id = m.therapist_id
 WHERE s.match_id IS NOT NULL
   AND p.type = 'patient'
   AND p.status IS DISTINCT FROM 'anonymous'
   AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
   AND lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
   AND lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
   AND m.status = 'patient_selected'
   AND s.selected_at < NOW() - INTERVAL '24 hours'
 ORDER BY s.selected_at ASC;
 ```

 ---

 ## Card 13 — Revenue proxy: estimated commission from bookings (bookings-based)

 **Decision**: Are we on track for the Dec 20 target of ≥ 2 paying customers?

 Notes:
 - This is **not real revenue** (no payments table). It’s a proxy assuming each booking = one session.
 - Uses `therapists.typical_rate` and estimates: `0.25 * typical_rate * min(10, bookings_per_pair)`.

 **Viz**: table

 ```sql
 WITH b AS (
   SELECT *
   FROM bookings
   WHERE created_at >= NOW() - INTERVAL '30 days'
 ),
 per_pair AS (
   SELECT
     b.patient_id,
     b.therapist_id,
     COUNT(*) AS bookings_count
   FROM b
   GROUP BY 1, 2
 ),
 with_lead AS (
   SELECT
     p.campaign_variant,
     pp.patient_id,
     pp.therapist_id,
     pp.bookings_count
   FROM per_pair pp
   JOIN people p ON p.id = pp.patient_id
   WHERE p.type = 'patient'
     AND p.status IS DISTINCT FROM 'anonymous'
     AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
 ),
 with_rate AS (
   SELECT
     wl.campaign_variant,
     wl.patient_id,
     wl.therapist_id,
     wl.bookings_count,
     t.typical_rate,
     0.25 * COALESCE(t.typical_rate, 0) * LEAST(10, wl.bookings_count) AS est_commission_eur
   FROM with_lead wl
   LEFT JOIN therapists t ON t.id = wl.therapist_id
 )
 SELECT
   COALESCE(campaign_variant, '(none)') AS campaign_variant,
   COUNT(*) AS therapist_patient_pairs,
   SUM(bookings_count) AS bookings_total,
   COUNT(*) FILTER (WHERE typical_rate IS NOT NULL) AS pairs_with_rate_known,
   ROUND(SUM(est_commission_eur)::numeric, 2) AS est_commission_eur_total
 FROM with_rate
 GROUP BY 1
 ORDER BY therapist_patient_pairs DESC;
 ```

 ---

 ## Card 14 — Directory contact funnel (lead-level)

 **Decision**: Are patient-initiated contacts converting (and where do they break: contact → response → accept → booking)?

 Notes:
 - Cohort is *directory-origin leads*: `people.metadata->>'source' = 'directory_contact'`.
 - “Contact” is `matches.metadata.patient_initiated = true`.

 **Viz**: KPI table

 ```sql
 WITH leads AS (
   SELECT
     p.id,
     p.created_at,
     p.campaign_variant,
     p.metadata
   FROM people p
   WHERE p.type = 'patient'
     AND p.status IS DISTINCT FROM 'anonymous'
     AND p.created_at >= NOW() - INTERVAL '30 days'
     AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
     AND coalesce(p.metadata->>'source','') = 'directory_contact'
 ),
 contacts AS (
   SELECT
     m.patient_id,
     m.therapist_id,
     m.status,
     m.created_at,
     COALESCE(m.responded_at, m.therapist_responded_at) AS responded_at
   FROM matches m
   JOIN leads l ON l.id = m.patient_id
   WHERE lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
     AND lower(coalesce(m.metadata->>'patient_initiated','false')) = 'true'
 ),
 per_lead AS (
   SELECT
     l.id AS patient_id,
     l.campaign_variant,
     MIN(c.created_at) AS first_contact_at,
     COUNT(c.therapist_id) AS therapists_contacted,
     BOOL_OR(c.responded_at IS NOT NULL OR c.status IN ('accepted','declined','therapist_responded','session_booked','completed','failed')) AS any_response,
     BOOL_OR(c.status IN ('accepted','session_booked','completed')) AS any_accept
   FROM leads l
   LEFT JOIN contacts c ON c.patient_id = l.id
   GROUP BY 1, 2
 ),
 bookings_14d AS (
   SELECT
     pl.patient_id,
     COUNT(DISTINCT b.id) AS bookings_in_14d
   FROM per_lead pl
   JOIN contacts c ON c.patient_id = pl.patient_id
   JOIN bookings b
     ON b.patient_id = pl.patient_id
    AND b.therapist_id = c.therapist_id
   WHERE pl.first_contact_at IS NOT NULL
     AND b.created_at >= pl.first_contact_at
     AND b.created_at < pl.first_contact_at + INTERVAL '14 days'
   GROUP BY 1
 )
 SELECT
   COUNT(*) AS directory_leads_created,
   COUNT(*) FILTER (WHERE therapists_contacted > 0) AS leads_who_contacted_any,
   COUNT(*) FILTER (WHERE any_response) AS leads_with_any_response,
   COUNT(*) FILTER (WHERE any_accept) AS leads_with_any_accept,
   COUNT(*) FILTER (WHERE COALESCE(b14.bookings_in_14d, 0) > 0) AS leads_with_booking_14d,
   ROUND(AVG(therapists_contacted)::numeric, 2) AS mean_therapists_contacted,
   ROUND(100.0 * COUNT(*) FILTER (WHERE any_accept) / NULLIF(COUNT(*), 0), 1) AS accept_rate_pct,
   ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(b14.bookings_in_14d, 0) > 0) / NULLIF(COUNT(*), 0), 1) AS booking_14d_rate_pct
 FROM per_lead pl
 LEFT JOIN bookings_14d b14 ON b14.patient_id = pl.patient_id;
 ```

 ---

 ## Card 15 — Directory contact: therapists contacted per lead (distribution)

 **Decision**: How many therapists does a directory lead need to contact until one accepts (or until a booking happens)?

 **Viz**: histogram

 ```sql
 WITH leads AS (
   SELECT
     p.id,
     p.created_at,
     p.metadata
   FROM people p
   WHERE p.type = 'patient'
     AND p.status IS DISTINCT FROM 'anonymous'
     AND p.created_at >= NOW() - INTERVAL '30 days'
     AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
     AND coalesce(p.metadata->>'source','') = 'directory_contact'
 ),
 contacts AS (
   SELECT
     m.patient_id,
     m.therapist_id,
     m.status,
     m.created_at
   FROM matches m
   JOIN leads l ON l.id = m.patient_id
   WHERE lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
     AND lower(coalesce(m.metadata->>'patient_initiated','false')) = 'true'
 ),
 per_lead AS (
   SELECT
     l.id AS patient_id,
     MIN(c.created_at) AS first_contact_at,
     COUNT(c.therapist_id) AS therapists_contacted,
     COALESCE(BOOL_OR(c.status IN ('accepted','session_booked','completed')), false) AS any_accept
   FROM leads l
   LEFT JOIN contacts c ON c.patient_id = l.id
   GROUP BY 1
 ),
 bookings_14d AS (
   SELECT
     pl.patient_id,
     COUNT(DISTINCT b.id) AS bookings_in_14d
   FROM per_lead pl
   JOIN contacts c ON c.patient_id = pl.patient_id
   JOIN bookings b
     ON b.patient_id = pl.patient_id
    AND b.therapist_id = c.therapist_id
   WHERE pl.first_contact_at IS NOT NULL
     AND b.created_at >= pl.first_contact_at
     AND b.created_at < pl.first_contact_at + INTERVAL '14 days'
   GROUP BY 1
 ),
 base AS (
   SELECT
     pl.patient_id,
     pl.therapists_contacted,
     pl.any_accept,
     (COALESCE(b14.bookings_in_14d, 0) > 0) AS has_booking_14d,
     AVG(pl.therapists_contacted) OVER () AS mean_contacted_per_lead
   FROM per_lead pl
   LEFT JOIN bookings_14d b14 ON b14.patient_id = pl.patient_id
 ),
 bucketed AS (
   SELECT
     CASE
       WHEN therapists_contacted >= 3 THEN '3+'
       ELSE therapists_contacted::text
     END AS contacted_bucket,
     any_accept,
     has_booking_14d,
     mean_contacted_per_lead
   FROM base
 )
 SELECT *
 FROM (
   SELECT
     contacted_bucket,
     COUNT(*) AS leads,
     ROUND(MAX(mean_contacted_per_lead)::numeric, 2) AS mean_contacted_per_lead,
     ROUND(100.0 * AVG((any_accept)::int), 1) AS accept_rate_pct,
     ROUND(100.0 * AVG((has_booking_14d)::int), 1) AS booking_14d_rate_pct
   FROM bucketed
   GROUP BY 1
 ) q
 ORDER BY
   CASE
     WHEN contacted_bucket = '3+' THEN 999
     ELSE contacted_bucket::int
   END;
 ```

 ---

 ## Card 16 — Ops queue: Directory contacts waiting on therapist response (48h+)

 **Decision**: Which patient-initiated contacts need therapist reminders / escalation?

 **Viz**: table

 ```sql
 SELECT
   m.id AS match_id,
   m.secure_uuid,
   m.patient_id,
   p.campaign_variant,
   m.therapist_id,
   TRIM(CONCAT(COALESCE(t.first_name,''), ' ', COALESCE(t.last_name,''))) AS therapist_name,
   m.created_at AS contact_created_at,
   NOW() - m.created_at AS age_since_contact
 FROM matches m
 JOIN people p ON p.id = m.patient_id
 JOIN therapists t ON t.id = m.therapist_id
 WHERE p.type = 'patient'
  AND p.status IS DISTINCT FROM 'anonymous'
   AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
   AND lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
   AND lower(coalesce(m.metadata->>'patient_initiated','false')) = 'true'
   AND COALESCE(m.responded_at, m.therapist_responded_at) IS NULL
   AND m.created_at < NOW() - INTERVAL '48 hours'
 ORDER BY m.created_at ASC;
 ```

 ---

 ## Card 17 — Supply gaps (top unmet demand)

 **Decision**: What therapist supply should we recruit next (city / modality / gender / in-person)?

 Notes:
 - The live table used by matching is `supply_gaps` (logged during instant matching).

 **Viz**: table

 ```sql
 SELECT
   COALESCE(session_type, 'unknown') AS session_type,
   COALESCE(city, '(any)') AS city,
   COALESCE(gender, '(any)') AS gender,
   COALESCE(modality, '(any)') AS modality,
   COALESCE(schwerpunkt, '(any)') AS schwerpunkt,
   COUNT(*) AS gaps,
   COUNT(DISTINCT patient_id) AS leads
 FROM supply_gaps
 WHERE created_at >= NOW() - INTERVAL '30 days'
 GROUP BY 1, 2, 3, 4, 5
 ORDER BY gaps DESC
 LIMIT 50;
 ```

 ---

 ## Card 18 — Supply gaps vs booking (self-serve impact)

 **Decision**: Do supply gaps correlate with lower booking conversion? If yes, recruiting is the highest leverage lever.

 **Viz**: table

 ```sql
 WITH leads AS (
   SELECT
     p.id,
     p.created_at,
     p.campaign_variant,
     p.metadata
   FROM people p
   WHERE p.type = 'patient'
     AND p.status IS DISTINCT FROM 'anonymous'
     AND p.created_at >= NOW() - INTERVAL '30 days'
     AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
     AND split_part(lower(coalesce(p.campaign_variant, '')), '?', 1) IN ('self-service','marketplace','direct')
 ),
 gaps AS (
   SELECT DISTINCT patient_id
   FROM supply_gaps
   WHERE created_at >= NOW() - INTERVAL '30 days'
 ),
 bookings_first AS (
   SELECT patient_id, MIN(created_at) AS first_booking_at
   FROM bookings
   GROUP BY 1
 )
 SELECT
   CASE WHEN g.patient_id IS NULL THEN 'no_supply_gap_logged' ELSE 'has_supply_gap' END AS gap_flag,
   COUNT(*) AS leads,
   COUNT(*) FILTER (
     WHERE bf.first_booking_at IS NOT NULL
       AND bf.first_booking_at < l.created_at + INTERVAL '14 days'
   ) AS leads_with_booking_14d,
   ROUND(
     100.0 * COUNT(*) FILTER (
       WHERE bf.first_booking_at IS NOT NULL
         AND bf.first_booking_at < l.created_at + INTERVAL '14 days'
     ) / NULLIF(COUNT(*), 0),
     1
   ) AS booking_14d_rate_pct
 FROM leads l
 LEFT JOIN gaps g ON g.patient_id = l.id
 LEFT JOIN bookings_first bf ON bf.patient_id = l.id
 GROUP BY 1
 ORDER BY leads DESC;
 ```

 ---

 ## Card 19 — Ops queue: Accepted but no booking after 7 days (curated)

 **Decision**: Which accepted leads need post-accept follow-up (booking friction / therapist availability / client drop-off)?

 **Viz**: table

 ```sql
 WITH leads AS (
   SELECT
     p.id,
     p.created_at,
     p.campaign_variant,
     p.metadata
   FROM people p
   WHERE p.type = 'patient'
     AND p.status IS DISTINCT FROM 'anonymous'
     AND p.created_at >= NOW() - INTERVAL '30 days'
     AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
 ),
 curated_matches AS (
   SELECT m.*
   FROM matches m
   JOIN leads l ON l.id = m.patient_id
   WHERE lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
     AND lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
 ),
 first_accept AS (
   SELECT DISTINCT ON (patient_id)
     patient_id,
     therapist_id,
     COALESCE(responded_at, therapist_responded_at) AS accepted_at
   FROM curated_matches
   WHERE status IN ('accepted','session_booked','completed')
     AND COALESCE(responded_at, therapist_responded_at) IS NOT NULL
   ORDER BY patient_id, COALESCE(responded_at, therapist_responded_at) ASC
 ),
 first_booking AS (
   SELECT
     fa.patient_id,
     MIN(b.created_at) AS booking_at
   FROM first_accept fa
   LEFT JOIN bookings b
     ON b.patient_id = fa.patient_id
    AND b.therapist_id = fa.therapist_id
    AND b.created_at >= fa.accepted_at
   GROUP BY 1
 )
 SELECT
   l.id AS patient_id,
   l.campaign_variant,
   fa.therapist_id,
   TRIM(CONCAT(COALESCE(t.first_name,''), ' ', COALESCE(t.last_name,''))) AS therapist_name,
   fa.accepted_at,
   NOW() - fa.accepted_at AS age_since_accept
 FROM leads l
 JOIN first_accept fa ON fa.patient_id = l.id
 LEFT JOIN first_booking fb ON fb.patient_id = l.id
 LEFT JOIN therapists t ON t.id = fa.therapist_id
 WHERE fb.booking_at IS NULL
   AND fa.accepted_at < NOW() - INTERVAL '7 days'
 ORDER BY fa.accepted_at ASC;
 ```

 ---

 ## Card 20 — Ops queue: All selected therapists declined (curated)

 **Decision**: Which leads need a new wave of therapists (we exhausted initial picks)?

 **Viz**: table

 ```sql
 WITH leads AS (
   SELECT
     p.id,
     p.created_at,
     p.campaign_variant,
     p.metadata
   FROM people p
   WHERE p.type = 'patient'
     AND p.status IS DISTINCT FROM 'anonymous'
     AND p.created_at >= NOW() - INTERVAL '30 days'
     AND lower(coalesce(p.metadata->>'is_test','false')) <> 'true'
 ),
 curated_matches AS (
   SELECT m.*
   FROM matches m
   JOIN leads l ON l.id = m.patient_id
   WHERE lower(coalesce(m.metadata->>'is_test','false')) <> 'true'
     AND lower(coalesce(m.metadata->>'patient_initiated','false')) <> 'true'
 ),
 per_lead AS (
   SELECT
     patient_id,
     COUNT(*) FILTER (WHERE status IN ('accepted','declined','therapist_responded','session_booked','completed','failed')) AS responded_count,
     COUNT(*) FILTER (WHERE status IN ('accepted','session_booked','completed')) AS accepted_count,
     COUNT(*) FILTER (WHERE status = 'declined') AS declined_count,
     MAX(COALESCE(responded_at, therapist_responded_at)) FILTER (WHERE status = 'declined') AS last_declined_at
   FROM curated_matches
   GROUP BY 1
 )
 SELECT
   l.id AS patient_id,
   l.campaign_variant,
   pl.responded_count,
   pl.declined_count,
   pl.last_declined_at,
   NOW() - pl.last_declined_at AS age_since_last_decline
 FROM leads l
 JOIN per_lead pl ON pl.patient_id = l.id
 WHERE pl.responded_count > 0
   AND pl.accepted_count = 0
   AND pl.declined_count = pl.responded_count
   AND pl.last_declined_at < NOW() - INTERVAL '24 hours'
 ORDER BY pl.last_declined_at ASC;
 ```

# How to interpret results (fast)

- **If Card 2 shows many `0_no_proposals_yet`**:
  - Ops backlog: create matches faster, improve therapist supply coverage.
- **Use Card 7 to locate the slow step**:
  - If `p50_h_lead_to_first_proposal` is high (esp. concierge), ops SLA is the bottleneck.
  - If `p50_h_selection_to_accept` is high, therapist responsiveness is the bottleneck.
- **Use Cards 9–10 to find therapist bottlenecks**:
  - Low `response_rate_pct` → reminders / therapist expectations / filtering.
  - Low `accept_rate_pct` → mismatch quality or therapist supply constraints.
  - High response time → follow-up cadence and/or remove slow therapists from top picks.
- **Use Cards 11–12 as your daily action lists**:
  - Concierge with no proposals (24h+) → create matches.
  - Waiting on therapist response (24h+) → send reminders.
- **Use Cards 19–20 to close loops**:
  - Accepted but no booking (7d+) → follow up with client + therapist availability.
  - All declined → generate next 1–3 proposals (or treat as supply gap).
- **Use Cards 14–16 for the directory contact funnel**:
  - If contact is high but response is low → therapist reminders / remove unresponsive therapists from directory.
  - If response is high but accepts are low → mismatch or therapist capacity problem.
  - If accepts are ok but booking is low → booking UX / availability / follow-up.
- **Use Cards 17–18 for recruiting priorities**:
  - Top gaps tell you *what to recruit*.
  - If gaps reduce booking conversion, supply is the bottleneck (not email copy).
- **If many `1_waiting_patient_selection`**:
  - Improve selection email/copy/CTA; resend after 24–48h; reduce choice friction.
- **If many `2_waiting_therapist_response` / high `mean_contacted`**:
  - Therapist responsiveness or matching quality is the bottleneck.
  - Action: better therapist reminders, improve match fit, adjust supply.
- **If Card 8 shows many `2` / `3` / `4+`**:
  - We are not winning on first-choice proposals → supply or mismatch quality problem.
- **If many `4_accepted_not_booked`**:
  - Booking UX or scheduling availability is the bottleneck.

---

# Follow-ups to add (next iteration)

- Revenue: connect payments/sessions to compute true commission (Metabase dashboard should show actual paid pairs)
- Optional: separate dashboard tabs for `campaign_variant` (concierge vs self-service) to reduce filter friction
