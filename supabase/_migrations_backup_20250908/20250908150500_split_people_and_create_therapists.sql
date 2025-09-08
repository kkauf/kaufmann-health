-- EARTH-113: Split people table – create therapists, migrate data, update FKs, and clean up

begin;

-- Ensure pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- 1) Create new therapists table
create table if not exists public.therapists (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  email text unique,
  phone text,
  gender text,
  city text,
  photo_url text,
  modalities jsonb not null default '[]'::jsonb,
  session_preferences jsonb not null default '[]'::jsonb,
  status text not null default 'pending_verification' check (status in ('pending_verification','verified','rejected')),
  approach_text text,
  accepting_new boolean not null default true,
  typical_rate integer,
  availability_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Migrate existing therapist rows from public.people → public.therapists
-- Reuse the same id to preserve references in matches and contracts.
insert into public.therapists (id, first_name, last_name, email, phone, city, modalities, session_preferences, status, created_at, updated_at)
select p.id,
       nullif(trim(split_part(p.name, ' ', 1)), '') as first_name,
       nullif(trim(regexp_replace(p.name, '^\S+\s*', '')), '') as last_name,
       p.email,
       p.phone,
       coalesce(p.metadata->>'city', null) as city,
       coalesce(p.metadata->'specializations', '[]'::jsonb) as modalities,
       case
         when (p.metadata ? 'session_preferences') then coalesce(p.metadata->'session_preferences', '[]'::jsonb)
         when (p.metadata ? 'session_preference') then
           case when (p.metadata->>'session_preference') in ('online','in_person') then jsonb_build_array(p.metadata->>'session_preference') else '[]'::jsonb end
         else '[]'::jsonb
       end as session_preferences,
       case when p.status in ('verified','rejected') then p.status else 'pending_verification' end as status,
       p.created_at,
       now()
from public.people p
where p.type = 'therapist'
  and not exists (select 1 from public.therapists t where t.id = p.id);

-- 3) Update foreign keys: matches.therapist_id → therapists(id)
-- Drop existing FK if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'matches'
      AND c.constraint_type = 'FOREIGN KEY'
      AND c.constraint_name = 'matches_therapist_id_fkey'
  ) THEN
    ALTER TABLE public.matches DROP CONSTRAINT matches_therapist_id_fkey;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- ignore
  NULL;
END $$;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_therapist_id_fkey
  FOREIGN KEY (therapist_id)
  REFERENCES public.therapists(id)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

-- 4) Update foreign key for therapist_contracts.therapist_id → therapists(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'therapist_contracts'
      AND c.constraint_type = 'FOREIGN KEY'
      AND c.constraint_name = 'therapist_contracts_therapist_id_fkey'
  ) THEN
    ALTER TABLE public.therapist_contracts DROP CONSTRAINT therapist_contracts_therapist_id_fkey;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- ignore
  NULL;
END $$;

ALTER TABLE public.therapist_contracts
  ADD CONSTRAINT therapist_contracts_therapist_id_fkey
  FOREIGN KEY (therapist_id)
  REFERENCES public.therapists(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE;

-- 5) Remove therapist rows from people (clients remain in people)
DELETE FROM public.people WHERE type = 'therapist';

commit;
