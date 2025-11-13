-- Add secure_uuid to bookings to enable therapist magic link
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'secure_uuid'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN secure_uuid uuid;
    ALTER TABLE public.bookings ALTER COLUMN secure_uuid SET DEFAULT gen_random_uuid();
    UPDATE public.bookings SET secure_uuid = gen_random_uuid() WHERE secure_uuid IS NULL;
    ALTER TABLE public.bookings ALTER COLUMN secure_uuid SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_secure_uuid_key ON public.bookings(secure_uuid);
  END IF;
END$$;
