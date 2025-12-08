-- Add 'city' to business_opportunities mismatch_type constraint
-- This tracks when a patient wants in-person therapy but the matched therapist is in a different city

-- Drop the existing constraint and add a new one with 'city' included
ALTER TABLE public.business_opportunities 
DROP CONSTRAINT IF EXISTS business_opportunities_mismatch_type_check;

ALTER TABLE public.business_opportunities 
ADD CONSTRAINT business_opportunities_mismatch_type_check 
CHECK (mismatch_type IN ('gender', 'location', 'modality', 'city'));
