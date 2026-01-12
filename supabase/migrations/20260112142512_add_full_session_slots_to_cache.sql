-- Add full_session slot columns to cal_slots_cache
-- This allows the follow-up email to show the next available full session slot

ALTER TABLE cal_slots_cache
ADD COLUMN IF NOT EXISTS next_full_date_iso TEXT,
ADD COLUMN IF NOT EXISTS next_full_time_label TEXT,
ADD COLUMN IF NOT EXISTS next_full_time_utc TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS full_slots_count INTEGER DEFAULT 0;

COMMENT ON COLUMN cal_slots_cache.next_full_date_iso IS 'Next available full session date (YYYY-MM-DD, Europe/Berlin)';
COMMENT ON COLUMN cal_slots_cache.next_full_time_label IS 'Next available full session time (HH:MM, Europe/Berlin)';
COMMENT ON COLUMN cal_slots_cache.next_full_time_utc IS 'Next available full session time in UTC';
COMMENT ON COLUMN cal_slots_cache.full_slots_count IS 'Number of available full session slots';
