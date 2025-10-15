-- Drop unused verification columns from public.people
ALTER TABLE public.people
  DROP COLUMN IF EXISTS verification_code;

ALTER TABLE public.people
  DROP COLUMN IF EXISTS verification_code_sent_at;
