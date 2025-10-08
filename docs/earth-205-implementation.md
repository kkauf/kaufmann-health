# EARTH-205: Therapist Receives & Responds to Contact Requests

## Overview

Enhanced the existing `/match/[uuid]` page to display patient-initiated contact request details and provide therapists with a streamlined response flow using mailto links.

## Implementation Summary

### 1. Enhanced Match Page (`/match/[uuid]/page.tsx`)

**Added Fields:**
- `contactType`: 'booking' | 'consultation' (from `matches.metadata`)
- `patientMessage`: Full message from patient
- `patientReason`: Brief reason/issue description
- `contactMethod`: 'email' | 'phone'
- `createdAt`: Timestamp for "Angefragt vor X Stunden"

**UI Changes:**
- Request type badge ("Direktbuchung" or "Kostenloses Erstgespräch (15 Min)")
- Timestamp showing hours since request
- Patient message displayed in gray box with proper formatting
- All metadata extracted from `matches.metadata` JSON field

### 2. Enhanced Actions Component (`/match/[uuid]/Actions.tsx`)

**New Props:**
- `contactType`, `patientName`, `patientReason`, `contactMethod`

**Accept Flow Enhancement:**
- Button label: "Annehmen und antworten" (when contactType present)
- After acceptance, displays "E-Mail-Entwurf öffnen" button
- Generates mailto link with pre-filled template
- Phone-only contacts show amber warning box

**Mailto Template Logic:**
```typescript
generateMailto() {
  subject: 'Re: Ihre Anfrage bei Kaufmann Health'
  body:
    - Greeting with patient's first name
    - For booking: includes "[Ihre Praxis-Adresse hier einfügen]"
    - For consultation: mentions 15-minute duration
    - Closes with "Viele Grüße"
}
```

### 3. Email Notification Updates (`therapistNotification.ts`)

**New Parameters:**
- `contactType`: 'booking' | 'consultation'
- `patientMessage`: Patient's full message

**Email Changes:**
- Subject: "Neue Anfrage: Direktbuchung" or "Neue Anfrage: Erstgespräch"
- Shows request type badge in emerald green
- Includes "Nachricht vom Klienten" section with escaped HTML
- Backward compatible (works without new fields)

### 4. Rejection Email Template (`patientUpdates.ts`)

**New Function:** `renderTherapistRejection()`

**Content:**
- Personalized greeting using patient's first name
- Therapist's name in signature
- Link to therapist directory (`/therapeuten`)
- Professional, empathetic tone

**Email Flow:**
- Triggered when therapist clicks "Ablehnen"
- Only for patient-initiated contacts (`metadata.patient_initiated === true`)
- Legacy admin matches use existing `renderPatientCustomUpdate()`

### 6. Therapist Name in Mailto Signature

**Match Page** (`/match/[uuid]/page.tsx`):
- Fetches therapist name from `therapists` table
- Passes `therapistName` to Actions component

**Actions Component** (`/match/[uuid]/Actions.tsx`):
- Accepts `therapistName` prop
- Includes in mailto signature: `Viele Grüße,\n${therapistName}`
- Gracefully handles missing therapist name (signature still present)

### 5. Updated API Endpoints

**Contact Endpoints** (`/api/public/contact` & `/api/public/matches/[uuid]/contact`):
- Now pass `contactType` and `patientMessage` to email template
- Metadata includes all contact context

**Respond Endpoint** (`/api/public/match/[uuid]/respond`):
- Loads `metadata` from matches table
- Checks `patient_initiated` flag for rejection email selection
- Sends `renderTherapistRejection()` for patient-initiated declines
- Falls back to `renderPatientCustomUpdate()` for admin matches

## User Flow

### Therapist Receives Request

1. **Email notification arrives:**
   - Subject: "Neue Anfrage: Direktbuchung" (or Erstgespräch)
   - Shows request type, patient reason, and full message
   - CTA: "Anfrage ansehen"

2. **Clicks link → Opens `/match/[uuid]`:**
   - See request type and timestamp
   - View patient message in formatted box
   - See patient context (city, session preference, etc.)
   - Privacy notice: contact info revealed after acceptance

3. **Accept Flow:**
   - Click "Annehmen und antworten"
   - Contact info appears
   - For email: "E-Mail-Entwurf öffnen" button
   - For phone: Prominent phone display with SMS/call note
   - Mailto opens with pre-filled professional template

4. **Decline Flow:**
   - Click "Ablehnen"
   - Patient receives personalized rejection email
   - Email includes therapist name and directory link

## Technical Details

### Database Schema

No migration required. Uses existing `matches.metadata` JSONB column with structure:
```typescript
{
  patient_initiated: true,
  contact_type: 'booking' | 'consultation',
  patient_reason: string,
  patient_message: string,
  contact_method: 'email' | 'phone'
}
```

### Link Expiry

**72 hours** - Maintains existing behavior for security and urgency. Original ticket mentioned 30 days, but confirmed to keep 72-hour window to encourage prompt therapist response.

### Backward Compatibility

All enhancements are additive:
- Works with admin-created matches (no `contactType`)
- Email template falls back to legacy subject/content
- Button labels adapt based on presence of metadata
- Rejection email logic checks `patient_initiated` flag

## Files Changed

### New Files
- `tests/earth-205.therapist-response.test.ts` — Unit test suite (10 tests, all passing)
- `tests/earth-205.e2e.test.ts` — End-to-end test suite (10 tests, all passing)
- `docs/earth-205-implementation.md` — This file

### Modified Files
- `src/app/match/[uuid]/page.tsx` — Fetch therapist name, extract and display contact metadata
- `src/app/match/[uuid]/Actions.tsx` — Mailto generation with therapist signature and enhanced UX
- `src/lib/email/templates/therapistNotification.ts` — Include message and request type
- `src/lib/email/templates/patientUpdates.ts` — Add `renderTherapistRejection()`
- `src/app/api/public/contact/route.ts` — Pass new fields to email
- `src/app/api/public/matches/[uuid]/contact/route.ts` — Pass new fields to email
- `src/app/api/public/match/[uuid]/respond/route.ts` — Smart rejection email selection

## Testing

### Test Coverage
```bash
# Unit tests
npm test -- tests/earth-205.therapist-response.test.ts

# End-to-end tests
npm test -- tests/earth-205.e2e.test.ts

# All critical tests
npm run test:critical
```

**Unit Tests (10 tests, all passing):**
- ✓ Email includes contact type and patient message
- ✓ Shows "Erstgespräch" for consultation type
- ✓ Backward compatibility (works without new fields)
- ✓ HTML escaping in patient message
- ✓ Rejection email with therapist name and directory link
- ✓ Rejection email without therapist name
- ✓ Uses first name only for greeting
- ✓ Mailto template for booking with address placeholder
- ✓ Mailto template for consultation
- ✓ Metadata extraction

**End-to-End Tests (10 tests, all passing):**
- ✓ Complete booking request flow (contact → email → accept → mailto with signature)
- ✓ Consultation request with 15-minute notice
- ✓ Phone-only contact method handling
- ✓ Rejection flow with directory link
- ✓ Backward compatibility with admin-created matches
- ✓ Generic mailto for admin matches
- ✓ 72-hour link expiry enforcement
- ✓ Contact info revelation only after acceptance
- ✓ XSS protection via HTML escaping
- ✓ Patient status transition to 'matched'

### Manual Testing Checklist

- [ ] Patient sends contact request from directory
- [ ] Therapist receives email with message and request type
- [ ] Clicking email link opens match page
- [ ] Page shows request type, timestamp, and patient message
- [ ] Accept button labeled "Annehmen und antworten"
- [ ] After accepting, mailto button appears
- [ ] Mailto opens with correct template (booking vs consultation)
- [ ] Mailto includes therapist name in signature ("Viele Grüße,\n[Name]")
- [ ] Address placeholder present for booking
- [ ] Decline sends rejection email to patient
- [ ] Rejection email includes therapist name and directory link
- [ ] Phone-only contacts show amber warning
- [ ] Backward compat: admin matches work without new fields

## Analytics Events

No new events added. Existing events continue to fire:
- `magic_link_opened` (page view)
- `therapist_responded` (accept/decline)
- `contact_message_sent` (from patient side, already implemented in EARTH-203)

## Security & Privacy

**Maintained:**
- Contact info only revealed after acceptance
- 72-hour link expiry
- No cookies or tracking on therapist pages
- HTML escaping in patient messages

**Enhanced:**
- Therapist rejection email is professional and empathetic
- Patient can continue search via directory link
- No PII in notification email (privacy-first)

## Success Metrics

Track via existing Supabase events:
- Therapist response time (measure time from `created_at` to `therapist_responded_at`)
- Accept rate for patient-initiated vs admin-initiated matches
- Email open rates (if Resend tracking enabled)

## Known Limitations

- Mailto requires therapist to have default email client configured
- Address placeholder must be manually edited by therapist for in-person bookings
- No in-app messaging (by design, keeps therapists in email workflow)
- No reminder emails for patient-initiated contacts (could be added later)

## Future Enhancements (Not in Scope)

- Auto-populate therapist address for in-person bookings (requires storing address)
- Calendar integration for booking suggestions
- WhatsApp/SMS templates for phone-only contacts
- Reminder emails if therapist doesn't respond within 24h
- Analytics dashboard for therapist response patterns
