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
- `status text default 'proposed'`
- `commission_collected numeric default 0`
- `notes text`
- `created_at timestamptz default now()`

Relationships:
- `matches.therapist_id` → `people.id`
- `matches.patient_id` → `people.id`

Future rules to consider:
- Enforce that `therapist_id` references a `people` row with `type='therapist'` and `patient_id` with `type='patient'` (via views or check constraints with triggers) if needed.
