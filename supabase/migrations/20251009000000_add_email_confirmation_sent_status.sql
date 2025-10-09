-- Add 'email_confirmation_sent' to people.status check constraint
-- This status is used when an email verification link has been sent but not yet clicked

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
      'email_confirmed',
      'email_confirmation_sent'
    )
  );
