-- Relax email/phone constraint to allow anonymous patients who haven't provided contact info yet
-- Anonymous patients can browse matches but must verify before booking

alter table public.people drop constraint if exists people_email_or_phone_check;

alter table public.people add constraint people_email_or_phone_check
  check (
    status = 'anonymous' 
    OR email IS NOT NULL 
    OR phone_number IS NOT NULL
  );
