-- Add last_accessed_at column to matches table for link expiration tracking
-- This allows us to refresh expired match links without corrupting created_at

ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz;

-- Backfill existing records to use created_at as initial value
UPDATE public.matches 
SET last_accessed_at = created_at 
WHERE last_accessed_at IS NULL;

-- Create index for expiration queries
CREATE INDEX IF NOT EXISTS idx_matches_last_accessed_at 
ON public.matches(last_accessed_at);

COMMENT ON COLUMN public.matches.last_accessed_at IS 'Tracks when the match link was last accessed. Used for 30-day link expiration. Updated on each valid access to keep link fresh.';
