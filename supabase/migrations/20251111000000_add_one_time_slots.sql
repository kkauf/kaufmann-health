-- Add support for one-time appointments in therapist_slots
-- Add is_recurring and specific_date fields
alter table public.therapist_slots
  add column if not exists is_recurring boolean not null default true,
  add column if not exists specific_date date;

-- Add constraint: if not recurring, specific_date must be set
alter table public.therapist_slots
  add constraint therapist_slots_one_time_date_chk
    check ((is_recurring = true and specific_date is null) or (is_recurring = false and specific_date is not null));

-- Drop old unique index
drop index if exists therapist_slots_uniq;

-- Create new unique constraints:
-- For recurring slots: (therapist_id, day_of_week, time_local, format) where is_recurring = true
create unique index if not exists therapist_slots_recurring_uniq
  on public.therapist_slots(therapist_id, day_of_week, time_local, format)
  where is_recurring = true;

-- For one-time slots: (therapist_id, specific_date, time_local, format) where is_recurring = false
create unique index if not exists therapist_slots_one_time_uniq
  on public.therapist_slots(therapist_id, specific_date, time_local, format)
  where is_recurring = false;

-- Update index for querying
drop index if exists therapist_slots_therapist_active_idx;
create index if not exists therapist_slots_therapist_active_idx
  on public.therapist_slots(therapist_id, active, is_recurring);
