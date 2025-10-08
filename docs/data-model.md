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
