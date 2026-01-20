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

### Directory Visibility Rules
A therapist appears in the public directory (`/api/public/therapists`) only if:
1. `status = 'verified'`
2. `accepting_new = true`
3. Not in `HIDDEN_THERAPIST_IDS` env or `metadata.hidden = true`

**Profile completeness enforcement:** The `accepting_new` toggle in the therapist portal is only enabled when the profile is complete (photo, 3 profile text fields with min 50 chars each, schwerpunkte, and typical_rate). New therapists default to `accepting_new = false`, so they must complete their profile before being visible.

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
