-- EARTH-191: SMS verification support
-- Add phone_number and SMS verification fields to people and form_sessions

-- Add phone_number to people table
ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Add verification code fields for SMS (Twilio Verify handles expiry)
-- We store these for audit/debugging, actual verification via Twilio API
ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS verification_code_sent_at TIMESTAMPTZ;

-- Index for phone lookups (conflict detection)
CREATE INDEX IF NOT EXISTS idx_people_phone_number 
ON public.people(phone_number) 
WHERE phone_number IS NOT NULL;

-- Add phone_number to form_sessions for autosave
ALTER TABLE public.form_sessions
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Comments for clarity
COMMENT ON COLUMN public.people.phone_number IS 'E.164 format: +4917612345678';
COMMENT ON COLUMN public.people.verification_code IS 'Last SMS verification code (for audit/debug)';
COMMENT ON COLUMN public.people.verification_code_sent_at IS 'When SMS code was last sent';
COMMENT ON COLUMN public.form_sessions.phone_number IS 'Phone number from wizard autosave';
