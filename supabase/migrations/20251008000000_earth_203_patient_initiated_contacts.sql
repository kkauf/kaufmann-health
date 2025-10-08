-- EARTH-203: Support patient-initiated contact flow from directory
-- Extends matches table to track patient-initiated contacts vs admin-initiated matches

-- Add metadata field to matches to store contact context
-- This allows us to distinguish patient-initiated contacts from admin matches
-- and store additional context like the patient's message and contact type

-- Expected metadata structure for patient-initiated contacts:
-- {
--   "patient_initiated": true,
--   "contact_type": "booking" | "consultation",
--   "patient_message": "...",
--   "patient_reason": "..."
-- }

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.matches.metadata IS 'JSONB metadata. For patient-initiated contacts: { patient_initiated: true, contact_type: "booking"|"consultation", patient_message: "...", patient_reason: "..." }';
