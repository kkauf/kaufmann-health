-- Relax address requirement for therapist_slots and adjust uniqueness
alter table if exists public.therapist_slots
  drop constraint if exists therapist_slots_format_address_chk;

-- Old unique index may include address; drop and recreate without address
drop index if exists therapist_slots_uniq;
create unique index if not exists therapist_slots_uniq on public.therapist_slots(therapist_id, day_of_week, time_local, format);

-- Keep address column as optional override (still NOT NULL with default '' from previous migration)
-- No additional constraint to require address for in_person; therapist-level practice_address will be used when slot.address is empty.
