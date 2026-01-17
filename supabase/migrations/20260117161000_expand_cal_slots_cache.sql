-- Expand cal_slots_cache to store full slot lists for booking modal
-- This enables instant slot loading without external Cal.com API calls

-- Add columns for full slot arrays (JSONB for flexible slot data)
ALTER TABLE public.cal_slots_cache
ADD COLUMN IF NOT EXISTS intro_slots JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS full_slots JSONB DEFAULT '[]'::jsonb;

-- Add index for efficient lookups (we mainly query by therapist_id which is already PK)
COMMENT ON COLUMN public.cal_slots_cache.intro_slots IS 'Array of all intro slots [{date_iso, time_label, time_utc}, ...]';
COMMENT ON COLUMN public.cal_slots_cache.full_slots IS 'Array of all full-session slots [{date_iso, time_label, time_utc}, ...]';
