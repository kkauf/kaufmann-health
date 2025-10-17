-- Migration: Clean up events table and add performance index
-- Created: 2025-10-17
-- Purpose: Remove low-value cron events and optimize admin dashboard queries
-- Impact: Reduces table size by ~3K rows, speeds up admin stats queries

-- 1. One-time cleanup: Remove old cron monitoring events
-- Keep last 7 days for operational debugging
DELETE FROM events
WHERE type IN ('cron_executed', 'cron_completed', 'patient_unresponsive')
  AND created_at < NOW() - INTERVAL '7 days';

-- 2. Add composite index for admin dashboard queries
-- Eliminates seq scan on type + created_at filters
-- Affects: /api/admin/stats queries (59ms → 5ms expected)
CREATE INDEX IF NOT EXISTS idx_events_type_created_desc 
ON public.events(type, created_at DESC);

-- 3. Report cleanup results
DO $$
DECLARE
  events_count INTEGER;
  table_size TEXT;
BEGIN
  SELECT COUNT(*) INTO events_count FROM events;
  SELECT pg_size_pretty(pg_total_relation_size('events')) INTO table_size;
  
  RAISE NOTICE 'Events table cleanup complete: % rows, % size', events_count, table_size;
  RAISE NOTICE 'Expected: ~5,400 rows, ~2.4 MB';
END $$;
