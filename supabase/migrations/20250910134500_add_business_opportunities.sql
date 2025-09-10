-- Create table for tracking unmet preferences/business opportunities
create table if not exists public.business_opportunities (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.people(id) on delete cascade,
  mismatch_type text not null check (mismatch_type in ('gender','location','modality')),
  city text,
  created_at timestamptz not null default now()
);

-- Enable RLS (service role bypasses RLS; no public access by default)
alter table public.business_opportunities enable row level security;

-- Helpful indexes
create index if not exists bo_created_at_idx on public.business_opportunities(created_at);
create index if not exists bo_mismatch_type_created_at_idx on public.business_opportunities(mismatch_type, created_at);
create index if not exists bo_city_idx on public.business_opportunities(city);
