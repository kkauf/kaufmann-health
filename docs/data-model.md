# Data Model

## public.people
- `id uuid pk default gen_random_uuid()`
- `email text unique not null`
- `phone text`
- `name text`
- `type text check in ('patient','therapist')`
- `status text default 'new'`
- `metadata jsonb default '{}'::jsonb`
- `created_at timestamptz default now()`

Business notes:
- `metadata` is a flexible bag for form/funnel details (`city`, `issue`, `availability`, `budget`, etc.).
- Common keys used by the therapy finder funnel: `specializations` (string[] of slugs), `funnel_type='koerperpsychotherapie'`, `submitted_at` (ISO string), `ip`, `user_agent`.
- Consider future constraints (e.g., email verified) when the funnel evolves.

Indexes:
- For lead rate limiting by IP stored in `metadata`, add a JSONB GIN index:
  ```sql
  CREATE INDEX IF NOT EXISTS people_metadata_gin_idx
  ON public.people USING GIN (metadata);
  ```

## public.matches
- `id uuid pk default gen_random_uuid()`
- `therapist_id uuid references people(id)`
- `patient_id uuid references people(id)`
- `status text default 'proposed'`
- `commission_collected numeric default 0`
- `notes text`
- `created_at timestamptz default now()`

Relationships:
- `matches.therapist_id` → `people.id`
- `matches.patient_id` → `people.id`

Future rules to consider:
- Enforce that `therapist_id` references a `people` row with `type='therapist'` and `patient_id` with `type='patient'` (via views or check constraints with triggers) if needed.
