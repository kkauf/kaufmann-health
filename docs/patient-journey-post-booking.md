# Patient Journey: Post-Booking Flow

This document describes what happens after a patient books a session with a therapist via Cal.com.

## Overview

```
BOOKING ──────────────────────────────────────────────────► SESSION END
   │                                                              │
   ├─ Immediate: Confirmation (patient + therapist)               │
   │                                                              │
   ├─ T-24h: Email + SMS reminder                                 │
   │                                                              │
   ├─ T-1h: Email + SMS reminder                                  │
   │                                                              │
   │                                          [MEETING_ENDED webhook]
   │                                                              │
   │                                          ├─ Intro? → Followup email (~2h)
   │                                          │
   │                                          └─ Full session? → Followup (3-5 days)
   │
   └─ [If CANCELLED] → Recovery email (2-4h later)
```

---

## Triggers & Email Flow

### 1. Booking Confirmation (Immediate)

**Trigger:** Cal.com `BOOKING_CREATED` webhook → `/api/public/cal/webhook`

| Recipient | Template | Purpose |
|-----------|----------|---------|
| Patient | `calBookingClientConfirmation` | Confirms date, time, video link, therapist info |
| Therapist | `calBookingTherapistNotification` | Notifies of new booking |

**Idempotency:** `client_confirmation_sent_at`, `therapist_notification_sent_at` columns in `cal_bookings`

---

### 2. Confirmation Recovery (Cron - every 30 min)

**Trigger:** Cron `/api/admin/cal/booking-followups?stage=confirmation_recovery`

**Purpose:** Catch bookings where webhook email delivery failed silently.

**Criteria:**
- Booking created > 10 min ago
- `start_time` in future
- `client_confirmation_sent_at` IS NULL
- Has patient + therapist

---

### 3. 24-Hour Reminder (Cron - every 30 min)

**Trigger:** Cron `/api/admin/cal/booking-followups?stage=reminder_24h`

**Window:** Bookings with `start_time` in 23-25 hours

**Channels:**
- Email: `calBookingReminder` ("Erinnerung: Ihr Termin morgen")
- SMS: If patient has phone number

**Idempotency:** `reminder_24h_sent_at` column

---

### 4. 1-Hour Reminder (Cron - every 30 min)

**Trigger:** Cron `/api/admin/cal/booking-followups?stage=reminder_1h`

**Window:** Bookings with `start_time` in 50-70 minutes

**Channels:**
- Email: `calBookingReminder` ("Gleich geht's los!")
- SMS: Urgent reminder if patient has phone

**Idempotency:** `reminder_1h_sent_at` column

---

### 5. Intro Followup (Cron-only)

**Trigger:** Cron `/api/admin/cal/booking-followups?stage=intro_followup` (runs every 5 min)

**Timing:** 10-30 minutes after intro session ends

**Purpose:** Prompt patient to book a full session while experience is fresh

**Skip Logic:** Automatically skipped if therapist has already booked a `full_session` for this patient (checked via `hasFutureFullSessionBooking()` in `src/lib/cal/booking-checks.ts`). This gives therapists ~15 minutes to book the client themselves before the nudge email goes out.

**Template:** `calIntroFollowup`
- Next available slot suggestion
- Direct booking link
- "Not the right fit?" → browse other therapists

**Idempotency:** `followup_sent_at` column

**Note:** Previously triggered immediately via webhook, changed to cron-based (Jan 2026) to allow therapists time to book clients before follow-up email is sent.

---

### 6. Session Followup (Cron - every 30 min)

**Trigger:** Cron `/api/admin/cal/booking-followups?stage=session_followup`

**Window:** Full sessions that ended 3-5 days ago

**Criteria:**
- `booking_kind = 'full_session'`
- Therapist has available slots (checked via slot cache)

**Template:** `calSessionFollowup`
- Encourages booking next session
- Shows next available slot

**Idempotency:** `session_followup_sent_at` column

---

### 7. Cancellation Recovery (Cron - every 30 min)

**Trigger:** Cron `/api/admin/cal/cancellation-recovery`

**Window:** Cancellations from 2-4 hours ago

**Criteria:**
- Patient has no other successful bookings (hasn't recovered on their own)
- Patient has other matched therapists available
- Haven't sent recovery email in past 72h (patient-level dedup)

**Template:** `cancellationRecovery`
- Empathetic message
- Shows alternative therapists
- Link to match page

---

## Key Files

| File | Purpose |
|------|---------|
| `/api/public/cal/webhook/route.ts` | Handles Cal.com webhooks, sends immediate confirmations |
| `/api/admin/cal/booking-followups/route.ts` | Cron for reminders + session followups |
| `/api/admin/cal/cancellation-recovery/route.ts` | Cron for cancellation recovery |
| `/api/cron/cal-followups/route.ts` | Orchestrates all followup crons |

---

## Database: `cal_bookings` Table

### Key Columns for Email Tracking

| Column | Purpose |
|--------|---------|
| `client_confirmation_sent_at` | Prevents duplicate client confirmations |
| `therapist_notification_sent_at` | Prevents duplicate therapist notifications |
| `reminder_24h_sent_at` | Tracks 24h reminder |
| `reminder_1h_sent_at` | Tracks 1h reminder |
| `followup_sent_at` | Tracks intro followup |
| `session_followup_sent_at` | Tracks full session followup |

### Querying for Debugging

```sql
-- Bookings that should have received reminders but didn't
SELECT
  id, booking_kind, status, start_time, patient_id,
  reminder_24h_sent_at, reminder_1h_sent_at
FROM cal_bookings
WHERE start_time < NOW()
  AND start_time > NOW() - INTERVAL '7 days'
  AND status != 'CANCELLED'
  AND is_test = false
  AND reminder_24h_sent_at IS NULL;

-- Recent cron completions
SELECT
  created_at,
  properties->'totals' as totals
FROM events
WHERE type = 'cal_booking_followups_completed'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## Monitoring & Alerts

### Event Types to Watch

| Event | Indicates |
|-------|-----------|
| `cal_booking_followups_completed` | Cron run summary with counters |
| `email_sent` with `kind: 'cal_booking_*'` | Email successfully sent |
| Errors in `logError` | Schema mismatches, lookup failures |

### Red Flags

- High `skipped_no_patient` count → Patient lookup failing
- High `errors` count → Check error logs
- Zero `sent_email` over multiple runs → System not working

---

## Error Handling Philosophy

**All database lookups MUST check for errors.** Silent failures (ignoring Supabase error responses) have historically caused entire email flows to silently stop working for days.

```typescript
// WRONG - silent failure
const { data: patient } = await supabase.from('people').select('*')...;
if (!patient) { skip(); } // Could be schema error, not missing data!

// CORRECT - loud failure
const { data: patient, error } = await supabase.from('people').select('*')...;
if (error) {
  await logError('context', error, { booking_id, reason: 'patient_lookup_failed' });
  counters.errors++;
  continue;
}
```

---

## Cron Schedule

| Endpoint | Frequency | Stages |
|----------|-----------|--------|
| `/api/cron/cal-followups` | Every 30 min | confirmation_recovery, reminder_24h, reminder_1h, session_followup |
| `/api/cron/cal-followups` (cancellation) | Every 30 min | Calls cancellation-recovery |
