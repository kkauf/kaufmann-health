-- Add credential_tier column to therapists table
-- Values: 'licensed' (authorized to practice psychotherapy), 'certified' (modality-certified without psychotherapy license)
ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS credential_tier TEXT NOT NULL DEFAULT 'licensed';

COMMENT ON COLUMN public.therapists.credential_tier IS 'licensed = authorized to practice psychotherapy (HP/Approbation), certified = modality-certified without psychotherapy license';
