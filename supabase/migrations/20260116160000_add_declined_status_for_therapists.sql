-- Add 'declined' status for therapists who are not accepted into the network
-- 'rejected' = transient, needs fixes (documents, photo, approach text)
-- 'declined' = terminal, not accepted (e.g., missing certification, not a fit)

alter table public.therapists drop constraint if exists therapists_status_check;
alter table public.therapists add constraint therapists_status_check
  check (
    status in (
      'pending_verification',
      'verified',
      'rejected',
      'declined'
    )
  );
