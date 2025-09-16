-- Add session_blockers table to track why sessions didn't happen (EARTH-127)
-- Matches business rule: server writes only; use service_role. RLS enabled.

create table if not exists public.session_blockers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  reason text not null check (reason in ('scheduling','cost','changed_mind','no_contact','other')),
  created_at timestamptz not null default now()
);

create index if not exists session_blockers_created_at_idx on public.session_blockers(created_at desc);
create index if not exists session_blockers_reason_idx on public.session_blockers(reason);
create index if not exists session_blockers_match_id_idx on public.session_blockers(match_id);

alter table public.session_blockers enable row level security;

-- Allow service role to manage records
create policy if not exists "service role can manage" on public.session_blockers
  for all to service_role using (true) with check (true);
