-- Add therapist_viewed_at column to bookings (nullable) and supporting index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookings'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN IF NOT EXISTS therapist_viewed_at timestamptz;

    COMMENT ON COLUMN public.bookings.therapist_viewed_at IS 'Timestamp when therapist viewed booking details via magic link';

    CREATE INDEX IF NOT EXISTS idx_bookings_therapist_viewed_at ON public.bookings (therapist_viewed_at);
  END IF;
END$$;
