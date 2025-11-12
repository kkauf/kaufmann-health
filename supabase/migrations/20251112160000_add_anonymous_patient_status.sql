-- Add 'anonymous' status for questionnaire-only patients who haven't provided contact info yet
-- These patients can browse matches but need to verify before booking

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
      'email_confirmation_sent',
      'anonymous'
    )
  );
