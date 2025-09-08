-- EARTH-70: Add therapists.metadata and verification_notes for document uploads and admin review

begin;

-- 1) Add metadata jsonb to therapists (if not present)
alter table if exists public.therapists
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 2) Add verification_notes for admin comments
alter table if exists public.therapists
  add column if not exists verification_notes text;

-- 3) Helpful index for metadata queries
create index if not exists therapists_metadata_gin_idx on public.therapists using gin (metadata);

commit;
