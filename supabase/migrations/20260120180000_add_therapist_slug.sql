-- Add slug column to therapists table for SEO-friendly profile URLs
ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_therapists_slug ON public.therapists(slug) WHERE slug IS NOT NULL;

-- Backfill slugs for existing verified therapists
-- Format: firstname-lastname (matches cal_username pattern for consistency)
-- Uses cal_username if available, otherwise generates from name
UPDATE public.therapists
SET slug = COALESCE(cal_username, LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      CONCAT(
        COALESCE(first_name, 'therapist'),
        '-',
        COALESCE(last_name, 'kh')
      ),
      '[^a-zA-Z0-9-]', '-', 'g'  -- Replace non-alphanumeric with dash
    ),
    '-+', '-', 'g'  -- Collapse multiple dashes
  )
))
WHERE status = 'verified' AND slug IS NULL;

-- Trim leading/trailing dashes
UPDATE public.therapists
SET slug = TRIM(BOTH '-' FROM slug)
WHERE slug IS NOT NULL;
