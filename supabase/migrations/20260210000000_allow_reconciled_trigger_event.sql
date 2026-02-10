-- Allow 'RECONCILED' as a valid last_trigger_event for bookings synced
-- by the nightly reconcile-bookings cron (missed webhooks recovery).
alter table cal_bookings
  drop constraint cal_bookings_last_trigger_event_chk,
  add constraint cal_bookings_last_trigger_event_chk check (
    last_trigger_event in (
      'BOOKING_CREATED',
      'BOOKING_RESCHEDULED',
      'BOOKING_CANCELLED',
      'RECONCILED'
    )
  );
