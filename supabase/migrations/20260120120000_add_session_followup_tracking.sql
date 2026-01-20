-- Add session follow-up tracking column to cal_bookings
-- This tracks when the 3-5 day post-session follow-up email was sent to prevent duplicates

ALTER TABLE cal_bookings
ADD COLUMN IF NOT EXISTS session_followup_sent_at TIMESTAMPTZ;

-- Index for efficiently finding sessions needing follow-up
-- (completed full sessions 3-5 days ago, not yet sent)
CREATE INDEX IF NOT EXISTS idx_cal_bookings_session_followup_pending
ON cal_bookings (end_time)
WHERE session_followup_sent_at IS NULL 
  AND booking_kind = 'full_session'
  AND status = 'completed';

COMMENT ON COLUMN cal_bookings.session_followup_sent_at IS 'Timestamp when 3-5 day post-session follow-up email was sent (for idempotency)';
