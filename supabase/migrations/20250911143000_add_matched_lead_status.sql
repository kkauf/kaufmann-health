-- EARTH-131: Add 'matched' status for patient leads

-- Update people.status check constraint to include 'matched'
alter table public.people drop constraint if exists people_status_check;
alter table public.people add constraint people_status_check
  check (status in ('new', 'pending_verification', 'verified', 'rejected', 'matched'));
