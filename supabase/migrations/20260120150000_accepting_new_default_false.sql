-- Change accepting_new default to false for new therapists
-- This ensures therapists must complete their profile before being visible in the directory

ALTER TABLE therapists 
ALTER COLUMN accepting_new SET DEFAULT false;

COMMENT ON COLUMN therapists.accepting_new IS 'Whether therapist accepts new clients. Defaults to false - therapists must complete their profile and explicitly enable this in the portal.';
