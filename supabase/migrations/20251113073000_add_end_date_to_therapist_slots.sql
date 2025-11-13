-- Add optional end_date to therapist_slots to allow expiring recurring series
alter table if exists public.therapist_slots
  add column if not exists end_date date;

-- Note: end_date applies to recurring series (is_recurring = true).
-- No uniqueness/index changes required; availability expansion and booking validation respect end_date in application logic.
