-- EARTH-191: Allow phone-only patient leads
-- 1) Make people.email nullable (email no longer the sole primary contact)
-- 2) Enforce that either email OR phone_number is present
-- 3) Ensure uniqueness for phone_number (when provided)

-- 1) Drop NOT NULL from people.email
ALTER TABLE public.people
  ALTER COLUMN email DROP NOT NULL;

-- 2) Add CHECK: email OR phone_number must be present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'people_email_or_phone_check'
  ) THEN
    ALTER TABLE public.people
      ADD CONSTRAINT people_email_or_phone_check
      CHECK (email IS NOT NULL OR phone_number IS NOT NULL);
  END IF;
END $$;

-- 3) Enforce uniqueness for phone_number when not null
-- Drop previous non-unique index if it exists
DROP INDEX IF EXISTS idx_people_phone_number;

-- Create partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS people_phone_number_key
  ON public.people (phone_number)
  WHERE phone_number IS NOT NULL;
