-- Add email tracking columns to cal_bookings for idempotent email sending
-- These columns track when confirmation emails were sent to prevent duplicates

ALTER TABLE cal_bookings
ADD COLUMN IF NOT EXISTS client_confirmation_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS therapist_notification_sent_at TIMESTAMPTZ;

-- Add index for querying unsent emails (for potential retry/resend logic)
CREATE INDEX IF NOT EXISTS idx_cal_bookings_client_email_pending
ON cal_bookings (created_at)
WHERE client_confirmation_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cal_bookings_therapist_email_pending
ON cal_bookings (created_at)
WHERE therapist_notification_sent_at IS NULL;

COMMENT ON COLUMN cal_bookings.client_confirmation_sent_at IS 'Timestamp when client confirmation email was sent (for idempotency)';
COMMENT ON COLUMN cal_bookings.therapist_notification_sent_at IS 'Timestamp when therapist notification email was sent (for idempotency)';
