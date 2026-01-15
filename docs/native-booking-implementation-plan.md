# Native KH Booking Flow - Implementation Plan

## Overview

Replace Cal.com redirect flow with native KH booking that calls Cal.com's internal `/api/book/event` endpoint directly.

**Goals:**
- Seamless UX (no redirect to foreign domain)
- Full control over booking form, confirmation, emails
- Maintain Cal.com as backend for calendar sync, video links, webhooks

---

## Railway Versioning Strategy

### How Railway Handles Versions

Railway **does not** use semantic versioning for deployments. Instead:

1. **Each deployment is a snapshot** - Railway stores the Docker image + environment variables
2. **Rollback available** - Click three dots on any previous deployment → "Rollback"
3. **Retention limits** - Based on plan (Pro: 14 days, Team: unlimited)

### How to "Pin" Cal.com Version

**Option A: Disconnect Auto-Deploy (Recommended)**
```
Railway Dashboard → Cal.com Service → Settings → Source
→ Uncheck "Automatic Deploys"
```
This stops Railway from auto-deploying when the Cal.com repo updates.

**Option B: Fork the Repo**
1. Fork `calcom/cal.com` to your GitHub
2. Point Railway to your fork
3. Never merge upstream updates (or do so manually)

**Option C: Use Specific Commit**
In Railway, you can deploy from a specific branch/commit. Create a branch at a known-good commit and deploy from that.

**Recommendation:** Option A + note the current deployment date. If `/api/book/event` breaks after an update, rollback via Railway UI.

---

## Fallback Strategy

### Error Detection (Our Side)

The `/api/book/event` endpoint returns JSON errors we can detect:

| Error | Meaning | Action |
|-------|---------|--------|
| `no_available_users_found_error` | Slot mismatch | Refresh slots, retry |
| `booking_time_out_of_bounds_error` | Slot expired/past | Refresh slots |
| `invalid_type in 'X'` | API contract changed | Fallback to redirect |
| Network error / 5xx | Cal.com down | Fallback to redirect |

### Fallback Logic

```typescript
async function createNativeBooking(params: BookingParams): Promise<BookingResult> {
  try {
    const res = await fetch(`${CAL_ORIGIN}/api/book/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    
    const data = await res.json();
    
    if (data.uid) {
      return { success: true, booking: data };
    }
    
    // Slot mismatch - can retry with fresh slots
    if (data.message === 'no_available_users_found_error') {
      return { success: false, error: 'slot_mismatch', canRetry: true };
    }
    
    // API changed - fallback to redirect
    return { success: false, error: 'api_error', fallbackToRedirect: true };
    
  } catch (e) {
    // Network failure - fallback to redirect
    return { success: false, error: 'network', fallbackToRedirect: true };
  }
}
```

### Feature Flag for Gradual Rollout

```typescript
// In useCalBooking or booking config
const USE_NATIVE_BOOKING = process.env.NEXT_PUBLIC_NATIVE_BOOKING === 'true';

// Fallback preserves current behavior
if (!USE_NATIVE_BOOKING || result.fallbackToRedirect) {
  redirectToCal(name, email, patientId);
}
```

---

## Current Flow vs New Flow

### Current Flow (Redirect)

```
1. User selects slot in KH
2. User enters name/email, verifies
3. KH redirects to: cal.kaufmann.health/{username}/intro?slot=...
4. User sees Cal.com booking page (jarring UX, timezone issues)
5. User confirms booking on Cal.com
6. Cal.com sends emails (their templates)
7. Cal.com webhook → KH stores in cal_bookings
8. KH sends supplementary emails
```

### New Flow (Native)

```
1. User selects slot in KH UI
2. User enters name/email, verifies (unchanged)
3. KH shows native booking confirmation form
4. User clicks "Termin bestätigen"
5. KH calls /api/book/event directly
6. On success:
   - KH shows confirmation page
   - KH sends branded confirmation email (with video link)
   - Cal.com sends calendar invite (ICS) via its own email
   - Webhook still fires → cal_bookings updated
7. On failure:
   - Retry with fresh slots, or
   - Fallback to redirect flow
```

---

## New Data We Need

From the Cal.com email screenshots, we need these fields in our emails:

| Field | Source | Notes |
|-------|--------|-------|
| **Video URL** | Webhook `metadata.videoCallUrl` | Already captured |
| **Reschedule URL** | `${CAL_ORIGIN}/reschedule/${booking_uid}` | Construct from uid |
| **Cancel URL** | `${CAL_ORIGIN}/booking/${booking_uid}?cancel=true` | Construct from uid |
| **Booking UID** | Response from `/api/book/event` | New |
| **Organizer email** | `therapists.email` | Already have |
| **Guest email** | User input | Already have |
| **Location type** | `integrations:daily` or address | From event type config |

### What Cal.com `/api/book/event` Returns

On success (based on Booking table structure):

```typescript
{
  id: number,
  uid: string,  // "2wnPXcx33FJ2bck9ntWuA5"
  eventTypeId: number,
  userId: number,
  startTime: string,  // ISO
  endTime: string,
  status: 'ACCEPTED' | 'PENDING',
  metadata: {
    videoCallUrl?: string,  // If using Cal Video
    ...ourMetadata
  },
  responses: {
    name: string,
    email: string,
    location: { value: string, optionValue: string }
  }
}
```

---

## Implementation Phases

### Phase 1: API Integration (2-3 hours)

**Files to create/modify:**
- `src/lib/cal/book.ts` - New: Native booking API client
- `src/contracts/cal.ts` - Add booking request/response types

**Tasks:**
1. Create `createCalBooking()` function that calls `/api/book/event`
2. Handle all error cases
3. Add feature flag `NEXT_PUBLIC_NATIVE_BOOKING`
4. Add fallback to redirect flow

### Phase 2: Booking Form UI (3-4 hours)

**Files to modify:**
- `src/features/therapists/components/TherapistDetailModal.tsx`
- `src/features/therapists/hooks/useCalBooking.ts`

**Tasks:**
1. Add new step `'confirm'` after verification
2. Show booking summary (date, time, location, therapist)
3. Add "Termin bestätigen" button that calls native API
4. Handle loading/error states
5. Show success confirmation inline

**New UI elements:**
- Booking summary card (matches Cal.com email format)
- Location selector (if therapist supports both online/in-person)
- Loading spinner during booking
- Success state with next steps

### Phase 3: Email Templates (2-3 hours)

**Files to modify:**
- `src/lib/email/templates/calBookingClientConfirmation.ts`

**New fields to add:**
```typescript
type CalBookingClientConfirmationParams = {
  // Existing
  patientName?: string | null;
  therapistName: string;
  dateIso: string;
  timeLabel: string;
  isIntro: boolean;
  sessionPrice?: number | null;
  
  // NEW
  bookingUid: string;          // For reschedule/cancel links
  videoUrl?: string | null;    // Cal Video or Zoom link
  therapistEmail: string;      // For "Who" section
  patientEmail: string;        // For "Who" section
  locationType: 'video' | 'in_person';
  locationAddress?: string;    // For in-person
  endTime: string;             // HH:MM for duration display
};
```

**Email sections to add:**
1. **Was** - Event title with both names
2. **Wann** - Full date/time with timezone
3. **Wer** - Organizer + Guest with emails
4. **Wo** - Video link or address
5. **Reschedule/Cancel links** - At bottom

### Phase 4: Webhook Updates (1-2 hours)

**Files to modify:**
- `src/app/api/public/cal/webhook/route.ts`

**Tasks:**
1. Extract `videoCallUrl` from webhook payload reliably
2. Store reschedule/cancel URLs (or derive from uid)
3. Update email sending logic to include new fields
4. Ensure idempotency with native bookings

### Phase 5: Testing & Rollout (2-3 hours)

**Tasks:**
1. Test with feature flag OFF (current behavior preserved)
2. Test with feature flag ON (native flow)
3. Test fallback scenarios (slot mismatch, API errors)
4. Test email rendering with all fields
5. Gradual rollout: Enable for test users first

---

## Database Schema Changes

**No schema changes required.** Existing `cal_bookings` table has all needed columns:

```sql
-- Already exists
cal_uid TEXT,           -- booking UID
start_time TIMESTAMPTZ,
status TEXT,
kh_metadata JSONB,      -- includes videoCallUrl
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cal.com changes `/api/book/event` | Low | High | Feature flag + fallback to redirect |
| Slot calculation mismatch | Medium | Medium | Already fixed timezone bug; test thoroughly |
| Cal.com emails still sent | N/A | Low | This is fine - they send ICS invites |
| Video link not in response | Low | Medium | Fall back to webhook data |

---

## Success Metrics

- **Conversion rate increase**: More users complete booking (no redirect drop-off)
- **Support tickets decrease**: Fewer timezone confusion complaints
- **Booking completion time**: Faster end-to-end flow

---

## Files Changed Summary

| File | Change Type | Priority |
|------|-------------|----------|
| `src/lib/cal/book.ts` | New | P0 |
| `src/contracts/cal.ts` | Modify | P0 |
| `src/features/therapists/hooks/useCalBooking.ts` | Modify | P0 |
| `src/features/therapists/components/TherapistDetailModal.tsx` | Modify | P1 |
| `src/lib/email/templates/calBookingClientConfirmation.ts` | Modify | P1 |
| `src/app/api/public/cal/webhook/route.ts` | Modify | P2 |

---

## Open Questions

1. **Location selection**: Should users choose online vs in-person, or auto-detect from therapist config?
2. **Cal Video vs external**: Some therapists use Zoom. Should we show different UI?
3. **Reschedule flow**: Should reschedule also be native, or is redirect OK for that?

---

## Recommended Next Steps

1. **Immediate**: Test timezone fix is working (verify slots match Cal.com)
2. **Phase 1**: Implement `createCalBooking()` with feature flag
3. **Phase 2**: Build confirmation UI
4. **Phase 3**: Enhance email templates
5. **Phase 4**: Enable for test traffic
6. **Phase 5**: Full rollout
