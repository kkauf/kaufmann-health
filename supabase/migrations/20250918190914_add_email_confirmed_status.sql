-- Add 'email_confirmed' to people.status check constraint
-- Keeps all previously allowed statuses and adds the transitional state used by /api/public/leads/confirm

alter table public.people drop constraint if exists people_status_check;
alter table public.people add constraint people_status_check
  check (
    status in (
      'new',
      'pending_verification',
      'verified',
      'rejected',
      'matched',
      'pre_confirmation',
      'email_confirmed'
    )
  );
