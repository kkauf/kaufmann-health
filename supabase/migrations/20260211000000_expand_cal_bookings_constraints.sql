-- Expand check constraints on cal_bookings to match application contracts.
--
-- cal_bookings_last_trigger_event_chk: Add MEETING_ENDED and no-show events
-- that CalWebhookProcessableEvent processes into the table.
--
-- cal_bookings_source_chk: Add all CalBookingSource values (native, email links,
-- therapist portal) — previously only 'directory' and 'questionnaire' were allowed,
-- causing reconcile inserts to fail for bookings from other sources.

alter table cal_bookings
  drop constraint cal_bookings_last_trigger_event_chk,
  add constraint cal_bookings_last_trigger_event_chk check (
    last_trigger_event in (
      'BOOKING_CREATED',
      'BOOKING_RESCHEDULED',
      'BOOKING_CANCELLED',
      'RECONCILED',
      'MEETING_ENDED',
      'BOOKING_NO_SHOW_UPDATED',
      'AFTER_HOSTS_CAL_VIDEO_NO_SHOW',
      'AFTER_GUESTS_CAL_VIDEO_NO_SHOW'
    )
  );

alter table cal_bookings
  drop constraint cal_bookings_source_chk,
  add constraint cal_bookings_source_chk check (
    source in (
      'directory',
      'questionnaire',
      'email_confirm',
      'intro_followup_email',
      'session_followup_email',
      'therapist_notification_email',
      'therapist_portal',
      'native'
    )
    or source is null
  );
