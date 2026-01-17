-- Performance fixes migration
-- 1. Add missing index on matches.therapist_id (flagged by Supabase advisor)
-- 2. Fix RLS initplan anti-pattern on cal_slots_cache

-- 1. Add index on matches.therapist_id foreign key
-- This enables efficient joins when fetching therapist data for matches
CREATE INDEX IF NOT EXISTS idx_matches_therapist_id 
ON public.matches(therapist_id);

-- 2. Fix RLS policies on cal_slots_cache to use (select auth.role())
-- This evaluates once per query instead of per row

-- Drop and recreate insert policy with optimized check
DROP POLICY IF EXISTS "cal_slots_cache_insert_service" ON public.cal_slots_cache;
CREATE POLICY "cal_slots_cache_insert_service" ON public.cal_slots_cache
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- Drop and recreate update policy with optimized check
DROP POLICY IF EXISTS "cal_slots_cache_update_service" ON public.cal_slots_cache;
CREATE POLICY "cal_slots_cache_update_service" ON public.cal_slots_cache
  FOR UPDATE USING ((select auth.role()) = 'service_role');

-- Drop and recreate delete policy with optimized check
DROP POLICY IF EXISTS "cal_slots_cache_delete_service" ON public.cal_slots_cache;
CREATE POLICY "cal_slots_cache_delete_service" ON public.cal_slots_cache
  FOR DELETE USING ((select auth.role()) = 'service_role');

-- Verify index was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'idx_matches_therapist_id'
  ) THEN
    RAISE EXCEPTION 'Index idx_matches_therapist_id not created';
  END IF;
  
  RAISE NOTICE 'Performance indexes and RLS fixes applied successfully';
END $$;
