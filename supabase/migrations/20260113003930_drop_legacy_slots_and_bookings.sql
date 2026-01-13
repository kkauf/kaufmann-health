-- Drop legacy therapist_slots and bookings tables
-- Cal.com now handles all booking functionality via cal_bookings table

-- Drop indexes first
DROP INDEX IF EXISTS therapist_slots_therapist_active_idx;
DROP INDEX IF EXISTS therapist_slots_uniq;
DROP INDEX IF EXISTS therapist_slots_one_time_idx;
DROP INDEX IF EXISTS idx_bookings_therapist_viewed_at;
DROP INDEX IF EXISTS bookings_secure_uuid_key;

-- Drop the legacy bookings table (not cal_bookings)
DROP TABLE IF EXISTS public.bookings;

-- Drop therapist_slots table
DROP TABLE IF EXISTS public.therapist_slots;
