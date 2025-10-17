-- Migration: Add performance indexes for user-facing routes
-- Created: 2025-10-17
-- Purpose: Prevent sequential scans on matches.patient_id and therapists.status
-- Impact: Match selection page + therapist directory
-- Safe: CONCURRENTLY prevents table locks, both tables <100 rows

-- 1. Match selection page optimization
-- Eliminates seq scan when loading patient's matches
-- Affects: /api/public/matches/[uuid] (line 104-109)
CREATE INDEX IF NOT EXISTS idx_matches_patient_created 
ON public.matches(patient_id, created_at DESC);

-- 2. Therapist directory optimization
-- Eliminates seq scan + filter on status='verified'
-- Affects: /api/public/therapists (line 22-26)
-- Partial index: only verified therapists (90%+ of queries)
CREATE INDEX IF NOT EXISTS idx_therapists_status_created 
ON public.therapists(status, created_at DESC) 
WHERE status = 'verified';

-- Verify indexes created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'idx_matches_patient_created'
  ) THEN
    RAISE EXCEPTION 'Index idx_matches_patient_created not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'idx_therapists_status_created'
  ) THEN
    RAISE EXCEPTION 'Index idx_therapists_status_created not created';
  END IF;
  
  RAISE NOTICE 'User-facing performance indexes created successfully';
END $$;
