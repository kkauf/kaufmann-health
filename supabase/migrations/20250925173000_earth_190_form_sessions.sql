-- EARTH-190: Form sessions for email-first questionnaire
-- Stores partial form state for up to 7 days to support resume via email confirmation link

create table if not exists public.form_sessions (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists form_sessions_updated_at_idx on public.form_sessions(updated_at desc);

alter table public.form_sessions enable row level security;

-- Service role (server) can fully manage
create policy "service role can manage" on public.form_sessions
  for all to service_role using (true) with check (true);
