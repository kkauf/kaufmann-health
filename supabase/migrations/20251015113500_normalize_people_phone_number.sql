-- Normalize legacy phone data to phone_number
-- Safe backfill: only copy when phone_number is NULL, legacy phone is present,
-- and no other row already has that phone_number (to avoid violating unique index).

-- Preview duplicates (manual check, not executed):
-- select p.id, p.phone as legacy_phone from public.people p
-- where p.phone_number is null and coalesce(trim(p.phone), '') <> ''
--   and exists (
--     select 1 from public.people q
--     where q.phone_number = p.phone and q.id <> p.id
--   );

update public.people p
set phone_number = p.phone
where p.phone_number is null
  and coalesce(trim(p.phone), '') <> ''
  and not exists (
    select 1 from public.people q
    where q.phone_number = p.phone
      and q.id <> p.id
  );
