-- EARTH-248: Cal slots cache for fast "next intro slot" display
-- Pre-computed Cal.com availability cached server-side to avoid slow DB queries on each page load

CREATE TABLE IF NOT EXISTS public.cal_slots_cache (
  therapist_id UUID PRIMARY KEY REFERENCES public.therapists(id) ON DELETE CASCADE,
  -- Next intro slot (first available free intro call)
  next_intro_date_iso TEXT,        -- YYYY-MM-DD in Europe/Berlin
  next_intro_time_label TEXT,      -- HH:MM in Europe/Berlin
  next_intro_time_utc TIMESTAMPTZ, -- Full UTC timestamp for precise display
  -- Cache metadata
  slots_count INTEGER DEFAULT 0,   -- Total intro slots in next 14 days (for scoring)
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Error tracking (null = success, string = last error message)
  last_error TEXT
);

-- Index for quick lookups when joining with therapists
CREATE INDEX IF NOT EXISTS idx_cal_slots_cache_cached_at ON public.cal_slots_cache(cached_at);

-- RLS: Public read (needed for therapist API), admin write
ALTER TABLE public.cal_slots_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached slots (public directory)
DROP POLICY IF EXISTS "cal_slots_cache_select_public" ON public.cal_slots_cache;
CREATE POLICY "cal_slots_cache_select_public" ON public.cal_slots_cache
  FOR SELECT USING (true);

-- Only service role can insert/update (via cron job)
DROP POLICY IF EXISTS "cal_slots_cache_insert_service" ON public.cal_slots_cache;
CREATE POLICY "cal_slots_cache_insert_service" ON public.cal_slots_cache
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "cal_slots_cache_update_service" ON public.cal_slots_cache;
CREATE POLICY "cal_slots_cache_update_service" ON public.cal_slots_cache
  FOR UPDATE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "cal_slots_cache_delete_service" ON public.cal_slots_cache;
CREATE POLICY "cal_slots_cache_delete_service" ON public.cal_slots_cache
  FOR DELETE USING (auth.role() = 'service_role');

COMMENT ON TABLE public.cal_slots_cache IS 'Pre-computed Cal.com availability for fast directory display (EARTH-248)';
COMMENT ON COLUMN public.cal_slots_cache.next_intro_date_iso IS 'Next available intro slot date in Europe/Berlin timezone';
COMMENT ON COLUMN public.cal_slots_cache.next_intro_time_label IS 'Next available intro slot time (HH:MM) in Europe/Berlin timezone';
COMMENT ON COLUMN public.cal_slots_cache.slots_count IS 'Total intro slots available in next 14 days for platform scoring';
