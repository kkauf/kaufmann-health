# Data Model

## State transitions (high-level)

- People (patients): `pre_confirmation → email_confirmed → new → matched`
- People (therapists): `pending_verification → verified | rejected`
- Matches: `proposed → therapist_contacted → therapist_responded → patient_selected → accepted/declined → session_booked → completed | failed`

  ## public.people
- `id uuid pk default gen_random_uuid()`
- `email text unique not null`
- `phone text`
- `name text`
- `type text check in ('patient','therapist')`
- `status text default 'new'` — allowed values: `new`, `pre_confirmation`, `email_confirmed`, `pending_verification` (therapists default), `verified`, `rejected`, `matched`
- `metadata jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`
- `campaign_source text`
- `campaign_variant text`
- `phone_number varchar` — E.164 format: +4917612345678

## public.therapists
Stores profile and qualification data for therapists. References `people(id)`.
- `id uuid pk references people(id)`
- `first_name text`
- `last_name text`
- `gender text` — `male | female | diverse`
- `city text`
- `address text`
- `accepting_new boolean`
- `metadata jsonb` — stores `profile` (photo paths, approach text), `documents` (license, certificates), and Cal.com event IDs.
- `cal_username text`
- `cal_enabled boolean`
- `cal_intro_event_type_id integer`
- `cal_full_session_event_type_id integer`
- `created_at timestamptz`
- `updated_at timestamptz`

### Directory Visibility
Therapists appear in the public directory when verified and accepting new clients. Profile completeness requirements apply.

Notes:
- `secure_uuid` on `matches` is unique and used for magic links. No PII in emails.
- Activation rules: patient becomes `new` after confirmation if `form_completed_at` exists; otherwise stays `email_confirmed`.

Indexes:
- JSONB GIN index on `metadata` recommended for IP/attributes lookups.

  ## public.events (unified logging)
- `id uuid pk default gen_random_uuid()`
- `level text check in ('info','warn','error') default 'info'` 
- `type text not null` — business event or error type (e.g., `lead_submitted`, `email_sent`, `error`)
- `properties jsonb default '{}'::jsonb` — PII-free metadata
- `hashed_ip text` — sha256(IP_HASH_SALT + ip) or null
- `user_agent text`
- `created_at timestamptz default now()`

Indexes:
- `level`, `type`, and `created_at desc` indexes for analytics and ops queries.

RLS:
- Enabled. Inserts allowed for `service_role` via server routes.

  ## public.matches
- `id uuid pk default gen_random_uuid()`
- `therapist_id uuid references people(id)`
- `patient_id uuid references people(id)`
- `status text default 'proposed'` — allowed values:
  - `proposed` (Vorgeschlagen)
  - `therapist_contacted`
  - `therapist_responded`
  - `patient_selected` (patient selection email flow; used by EARTH-125)
  - `accepted` (Akzeptiert)
  - `declined` (Abgelehnt)
  - `session_booked`
  - `completed`
  - `failed`
- `metadata jsonb default '{}'::jsonb` — for patient-initiated contacts (EARTH-203): `{ patient_initiated: true, contact_type: "booking"|"consultation", patient_reason: "...", patient_message: "...", contact_method: "email"|"phone" }`
- `created_at timestamptz not null default now()`

Purpose:
- Capture one-click client feedback 7 days after selection about why a session has not been scheduled yet. Enables actionable insights and operations alerts.

Indexes: `created_at desc`, `reason`, and `match_id`.

  RLS:
  - Enabled. Only the service role writes/reads via server endpoints.

## public.cal_bookings
Ingested bookings from Cal.com.
- `id uuid pk default gen_random_uuid()`
- `cal_uid text unique` — The unique ID from Cal.com
- `last_trigger_event text` — `BOOKING_CREATED | BOOKING_RESCHEDULED | BOOKING_CANCELLED`
- `organizer_username text`
- `event_type_id integer`
- `start_time timestamptz`
- `end_time timestamptz`
- `therapist_id uuid references therapists(id)`
- `patient_id uuid references people(id)`
- `match_id uuid references matches(id)`
- `booking_kind text` — `intro | full_session`
- `source text` — `directory | questionnaire`
- `status text`
- `is_test boolean`
- `metadata jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`
- `client_confirmation_sent_at timestamptz`
- `therapist_notification_sent_at timestamptz`
- `reminder_24h_sent_at timestamptz`
- `reminder_1h_sent_at timestamptz`

## public.form_sessions
Stores partial questionnaire state for email-first flow (EARTH-190). Enables resume via confirmation link.
- `id uuid pk default gen_random_uuid()`
- `data jsonb not null default '{}'::jsonb` — form field values (city, session_preference, methods, etc.)
- `email text` — associated email if known
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `expires_at timestamptz` — auto-cleanup after 7 days

RLS: Service role only.

## public.business_opportunities
Tracks unmet patient preferences for supply-side insights (EARTH-124).
- `id uuid pk default gen_random_uuid()`
- `patient_id uuid not null references people(id) on delete cascade`
- `mismatch_type text not null` — `gender | location | modality`
- `city text`
- `created_at timestamptz not null default now()`

Indexes: `created_at`, `mismatch_type + created_at`, `city`.

RLS: Service role only.

## public.session_blockers
Captures why sessions didn't happen (7-day post-selection feedback, EARTH-127).
- `id uuid pk default gen_random_uuid()`
- `match_id uuid not null references matches(id) on delete cascade`
- `reason text not null` — `scheduling | cost | changed_mind | no_contact | other`
- `created_at timestamptz not null default now()`

Indexes: `created_at desc`, `reason`, `match_id`.

RLS: Service role only.

## public.therapist_slots
Recurring availability slots for native booking (deprecated in favor of Cal.com for most therapists).
- `id uuid pk default gen_random_uuid()`
- `therapist_id uuid not null references therapists(id) on delete cascade`
- `day_of_week smallint not null` — 0=Sunday, 6=Saturday
- `time_local time not null` — Europe/Berlin timezone
- `format text not null` — `online | in_person`
- `address text not null default ''` — required for in_person, empty for online
- `duration_minutes integer not null default 60`
- `active boolean not null default true`
- `created_at timestamptz not null default now()`

Indexes: `therapist_id + active`, unique on `(therapist_id, day_of_week, time_local, format, address)`.

## public.cal_slots_cache
Pre-computed Cal.com availability for fast directory display (EARTH-248).
- `therapist_id uuid pk references therapists(id) on delete cascade`
- `next_intro_date_iso text` — YYYY-MM-DD in Europe/Berlin
- `next_intro_time_label text` — HH:MM in Europe/Berlin
- `next_intro_time_utc timestamptz`
- `slots_count integer default 0` — total intro slots in 14 days (for platform scoring)
- `cached_at timestamptz not null default now()`
- `last_error text` — null = success

RLS: Public read, service role write (via cron).

## public.short_links
URL shortening for SMS links.
- `id uuid pk default gen_random_uuid()`
- `code varchar(10) unique not null` — short code (e.g., `abc123`)
- `target_url text not null`
- `utm_source varchar(50)`
- `utm_medium varchar(50)`
- `utm_campaign varchar(100)`
- `patient_id uuid references people(id) on delete set null`
- `clicks integer default 0`
- `created_at timestamptz default now()`
- `last_clicked_at timestamptz`

RLS: Public read (for redirect), service role write.

## public.ad_spend_log
Daily ad spend for CAC/CPL calculations (populated via nightly cron from Google Ads API).
- `id uuid pk default gen_random_uuid()`
- `date date not null`
- `spend_eur numeric(10,2) not null`
- `source text not null default 'google_ads'`
- `campaign_name text`
- `clicks integer`
- `impressions integer`
- `conversions numeric(10,2)`
- `created_at timestamptz default now()`

Unique: `(date, source, campaign_name)`.

RLS: Service role only.
