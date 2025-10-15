-- Drop legacy phone column from public.people after migration to phone_number
-- Ensure application code no longer references public.people.phone before running this.

ALTER TABLE public.people
  DROP COLUMN IF EXISTS phone;
