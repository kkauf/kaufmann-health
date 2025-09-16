# Data Model

## public.people
- `id uuid pk default gen_random_uuid()`
- `email text unique not null`
- `phone text`
- `name text`
- `type text check in ('patient','therapist')`
- `status text default 'new'` — values: `new`, `pending_verification` (therapists default), `verified`, `rejected`
- `metadata jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`

Business notes:
- `metadata` is a flexible bag for form/funnel details (`city`, `issue`, `availability`, `budget`, etc.).
- Common keys used by the therapy finder funnel: `specializations` (string[] of slugs), `funnel_type='koerperpsychotherapie'`, `submitted_at` (ISO string), `ip`, `user_agent`.
- Therapist verification documents are stored on the `public.therapists` table (see below). Patient leads remain in `public.people`.
- Storage RLS: `therapist-documents` is private; authenticated users can insert; only `service_role` has read/manage. Reason: keep sensitive verification docs off the public surface.

Indexes:
- For lead rate limiting by IP stored in `metadata`, add a JSONB GIN index:
  ```sql
  CREATE INDEX IF NOT EXISTS people_metadata_gin_idx
  ON public.people USING GIN (metadata);
  ```

## public.events (unified logging)
- `id uuid pk default gen_random_uuid()`
- `level text check in ('info','warn','error') default 'info'` 
- `type text not null` — business event or error type (e.g., `lead_submitted`, `email_sent`, `error`)
- `properties jsonb default '{}'::jsonb` — PII-free metadata
- `hashed_ip text` — sha256(IP_HASH_SALT + ip) or null
- `user_agent text`
- `created_at timestamptz default now()`

Create table:
```sql
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info' check (level in ('info','warn','error')),
  type text not null,
  properties jsonb not null default '{}'::jsonb,
  hashed_ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
```

Indexes:
- For analytics and ops queries:
  ```sql
  create index if not exists events_level_idx on public.events(level);
  create index if not exists events_type_idx on public.events(type);
  create index if not exists events_created_at_idx on public.events(created_at desc);
  ```

RLS:
- Enable RLS but allow inserts with the service role only. Example:
  ```sql
  alter table public.events enable row level security;
  create policy "service role can insert" on public.events
    for insert to service_role using (true) with check (true);
  ```

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
- `commission_collected numeric default 0`
- `notes text`
- `created_at timestamptz default now()`
- `secure_uuid uuid not null default gen_random_uuid()` — used for magic links
- `responded_at timestamptz` — legacy/fallback response timestamp
- `therapist_contacted_at timestamptz`
- `therapist_responded_at timestamptz`
- `patient_confirmed_at timestamptz`

Relationships:
- `matches.therapist_id` → `therapists.id`
- `matches.patient_id` → `people.id`

Indexes:
- Unique `secure_uuid` to enforce one-time magic links and fast lookups:
```sql
create unique index if not exists matches_secure_uuid_key
  on public.matches(secure_uuid);
```

Future rules to consider:
- Enforce that `therapist_id` references a `people` row with `type='therapist'` and `patient_id` with `type='patient'` (via views or check constraints with triggers) if needed.

See also: [security](./security.md), [technical decisions](./technical-decisions.md)

## public.therapist_contracts
- `id uuid pk default gen_random_uuid()`
- `therapist_id uuid references people(id)`
- `contract jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Relationships:
- `therapist_contracts.therapist_id` → `therapists.id`

## public.therapists

- `id uuid pk default gen_random_uuid()`
- `first_name text`
- `last_name text`
- `email text unique`
- `phone text`
- `city text`
- `modalities jsonb not null default '[]'::jsonb` — array of specialization slugs (e.g., `narm`, `hakomi`)
- `session_preferences jsonb not null default '[]'::jsonb` — array of `online` | `in_person`
- `status text not null default 'pending_verification' check in ('pending_verification','verified','rejected')`
- `metadata jsonb not null default '{}'::jsonb`
- `verification_notes text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Documents structure (stored in Supabase Storage bucket `therapist-documents`, paths recorded under `metadata.documents`):

```json
{
  "license": "therapists/<id>/license-<ts>.<ext>",
  "specialization": {
    "narm": ["therapists/<id>/specialization-narm-<ts>.<ext>"]
  }
}
```

- License can be: Psychologischer Psychotherapeut (approbiert), Heilpraktiker für Psychotherapie, Großer Heilpraktiker. Required.
- Specialization certificates are optional (can be provided later). Multiple documents allowed per specialization.

Profile metadata (stored under `metadata.profile`):

```json
{
  "photo_pending_path": "applications/<id>/profile-photo-<ts>.(jpg|png)",
  "approach_text": "<therapeutic approach text>"
}
```

Buckets:
- `therapist-applications` (private): holds pending profile photos before admin approval.
- `therapist-profiles` (public): holds approved profile photos; set by the admin PATCH flow.

Indexes:

```sql
create index if not exists therapists_metadata_gin_idx
  on public.therapists using gin (metadata);
```

## public.business_opportunities

- `id uuid pk default gen_random_uuid()`
- `patient_id uuid not null references public.people(id) on delete cascade`
- `mismatch_type text not null check in ('gender','location','modality')`
- `city text`
- `created_at timestamptz not null default now()`

Purpose:
- When admin suggests therapists that partially match a patient's preferences, we log specific mismatch reasons to quantify unmet demand (e.g., requests for male therapists in Munich).

Indexes:
```sql
create index if not exists bo_created_at_idx on public.business_opportunities(created_at);
create index if not exists bo_mismatch_type_created_at_idx on public.business_opportunities(mismatch_type, created_at);
create index if not exists bo_city_idx on public.business_opportunities(city);
```

RLS:
- Enabled. Only the service role inserts/queries via server-side admin APIs. No public access.

## public.session_blockers

- `id uuid pk default gen_random_uuid()`
- `match_id uuid not null references public.matches(id) on delete cascade`
- `reason text not null check in ('scheduling','cost','changed_mind','no_contact','other')`
- `created_at timestamptz not null default now()`

Purpose:
- Capture one-click client feedback 7 days after selection about why a session has not been scheduled yet. Enables actionable insights and operations alerts.

Create table:
```sql
create table if not exists public.session_blockers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  reason text not null check (reason in ('scheduling','cost','changed_mind','no_contact','other')),
  created_at timestamptz not null default now()
);
```

Indexes:
```sql
create index if not exists session_blockers_created_at_idx on public.session_blockers(created_at desc);
create index if not exists session_blockers_reason_idx on public.session_blockers(reason);
create index if not exists session_blockers_match_id_idx on public.session_blockers(match_id);
```

RLS:
- Enabled. Only the service role writes/reads via server endpoints.
