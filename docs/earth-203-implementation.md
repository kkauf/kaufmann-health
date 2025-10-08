# EARTH-203: First-Time Contact Flow Implementation

## Overview

Implemented patient-initiated contact flow from therapist directory. Users can now contact therapists directly by clicking "Therapeut:in buchen" or "Kostenloses Erstgespräch" buttons, which opens a verification modal followed by message composition.

## User Journey

1. **Click contact button** → Modal opens: "Anmelden um zu senden"
2. **Enter contact info** → Name + Email/Phone choice
3. **Verify code** → SMS or email verification (reuses existing `/api/public/verification/*` endpoints)
4. **Compose message** → Pre-filled editable message with reason field
5. **Send** → Success confirmation, therapist receives notification email with magic link

## Technical Implementation

### Database

**Migration**: `20251008000000_earth_203_patient_initiated_contacts.sql`
- Documents metadata schema for patient-initiated contacts in `matches.metadata`
- Structure: `{ patient_initiated: true, contact_type: "booking"|"consultation", patient_reason: "...", patient_message: "...", contact_method: "email"|"phone" }`

### Backend

**New Files:**
- `src/lib/auth/clientSession.ts` — JWT-based session management for `kh_client` cookie
- `src/app/api/public/contact/route.ts` — Contact creation endpoint with rate limiting

**Key Features:**
- **Functional cookie** `kh_client`: HTTP-only, 30 days, scoped to `/`, contains signed JWT with patient info
- **Rate limiting**: Max 3 contacts per patient per 24 hours (tracked via `matches` table)
- **Session reuse**: Returning users skip verification if cookie valid
- **Privacy-first**: Therapist email contains magic link only, no PII

**API Endpoint**: `POST /api/public/contact`

Request body:
```json
{
  "therapist_id": "uuid",
  "contact_type": "booking" | "consultation",
  "patient_name": "string",
  "patient_email": "string (if contact_method='email')",
  "patient_phone": "string (if contact_method='phone')",
  "contact_method": "email" | "phone",
  "patient_reason": "string (required)",
  "patient_message": "string (optional)"
}
```

Response:
- 200: `{ data: { match_id, therapist_name, success: true } }` + `Set-Cookie` for new patients
- 400: Validation errors
- 404: Therapist not found
- 429: Rate limit exceeded (code: `RATE_LIMIT_EXCEEDED`)
- 500: Server error

### Frontend

**New Components:**
- `src/features/therapists/components/ContactModal.tsx` — Multi-step modal (verify → verify-code → compose → success)
- `src/components/ui/textarea.tsx` — Shadcn textarea component

**Updated Components:**
- `src/features/therapists/components/TherapistCard.tsx` — Replaced `/fragebogen` links with contact modal
- `src/features/therapists/components/TherapistDetailModal.tsx` — Replaced `/fragebogen` links with contact modal

**Modal Steps:**
1. **Verify**: Name + contact method (email/phone) selection
2. **Verify Code**: 6-digit code entry with resend option
3. **Compose**: Reason field + editable pre-filled message
4. **Success**: Confirmation with "Weitere Therapeuten ansehen" CTA

**Pre-filled Messages:**
- **Booking**: "Guten Tag [Name], ich möchte gerne einen Termin vereinbaren. Ich suche Unterstützung bei [reason] und fand dein Profil sehr ansprechend."
- **Consultation**: "Guten Tag [Name], ich würde gerne ein kostenloses Erstgespräch (15 Min) vereinbaren. Ich suche Unterstützung bei [reason] und fand dein Profil sehr ansprechend."

### Email Notification

Reuses existing `therapistNotification` template with:
- Type: `'outreach'`
- Magic link to `/match/[secure_uuid]` (72h expiry)
- Minimal PII in email (only reason/issue)
- Full patient contact revealed only after therapist accepts (handled in EARTH-205)

### Analytics Events

**Tracked events:**
- `contact_modal_opened` (client-side, via `trackEvent`)
- `contact_verification_code_sent` (client-side)
- `contact_verification_code_failed` (client-side)
- `contact_verification_completed` (client-side)
- `contact_message_sent` (client-side)
- `contact_message_failed` (client-side)
- `patient_created` (server-side, for new patients)
- `contact_match_created` (server-side)
- `contact_email_sent` (server-side)
- `contact_rate_limit_hit` (server-side)

All events include `therapist_id` and `contact_type` in properties.

### Security

- **Cookie**: Functional cookie (not tracking), HTTP-only, Secure in production, SameSite=Lax
- **JWT**: Signed with `JWT_SECRET`, 30-day expiry
- **Rate limiting**: 3 contacts/day per patient (by patient_id from session/cookie)
- **Privacy**: No PII in therapist notification email (magic link only)
- **Validation**: All inputs sanitized, phone numbers normalized

### Testing

**New test files:**
- `tests/api.public.contact.test.ts` — API endpoint tests (create, rate limit, validation, 404)
- `tests/client-session.test.ts` — JWT token creation/verification, cookie formatting

**Coverage:**
- ✅ New patient creation and match
- ✅ Rate limit enforcement (429 response)
- ✅ Field validation (400 response)
- ✅ Non-existent therapist (404 response)
- ✅ Token creation and verification
- ✅ Cookie formatting

All critical tests pass (172 tests).

## Documentation Updates

- `docs/api.md` — Added `POST /api/public/contact` endpoint documentation
- `docs/data-model.md` — Documented `matches.metadata` schema for patient-initiated contacts
- `docs/analytics.md` — Added contact flow event types

## Dependencies

- **Added**: `jose` (^5.x) for JWT signing/verification

## Migration Required

Run migration before deploying:
```bash
npx supabase db push
```

Or apply manually:
```sql
COMMENT ON COLUMN public.matches.metadata IS 'JSONB metadata. For patient-initiated contacts: { patient_initiated: true, contact_type: "booking"|"consultation", patient_message: "...", patient_reason: "..." }';
```

## Environment Variables

No new environment variables required. Uses existing:
- `JWT_SECRET` (for session token signing)
- `NEXT_PUBLIC_BASE_URL` (for magic link generation)
- Supabase and email credentials (already configured)

## Next Steps (EARTH-205)

Therapist-side flow for responding to patient-initiated contacts:
- Magic link page at `/match/[secure_uuid]` needs to show patient message and reason
- Accept/decline actions
- Reveal patient contact info only after acceptance

## Success Metrics

Track via Supabase events:
- Click-to-send conversion: `contact_message_sent` / `contact_modal_opened`
- Verification completion: `contact_verification_completed` / `contact_verification_code_sent`
- Rate limit hits: `contact_rate_limit_hit` count
- Therapist response time: Compare `matches.therapist_responded_at` for patient-initiated vs admin-initiated

## Known Limitations

- No retry logic for failed email sends (fire-and-forget pattern)
- Rate limit is per-patient only (no global IP-based limit)
- SMS verification fallback to email handled by existing verification endpoints
- No in-app messaging (therapist responds via magic link, then email/phone)

## Files Changed

**New:**
- `src/lib/auth/clientSession.ts`
- `src/app/api/public/contact/route.ts`
- `src/features/therapists/components/ContactModal.tsx`
- `src/components/ui/textarea.tsx`
- `tests/api.public.contact.test.ts`
- `tests/client-session.test.ts`
- `supabase/migrations/20251008000000_earth_203_patient_initiated_contacts.sql`

**Modified:**
- `src/features/therapists/components/TherapistCard.tsx`
- `src/features/therapists/components/TherapistDetailModal.tsx`
- `docs/api.md`
- `docs/data-model.md`
- `docs/analytics.md`
- `package.json` (added `jose`)

## Bug Fixes Applied

**Bug 1: Button overflow** 
- Added `text-sm` and `truncate` to "Kostenloses Erstgespräch" button
- Made icon `shrink-0` to prevent compression

**Bug 2: Modal spacing** 
- Increased spacing: `space-y-5` for better breathing room
- Enhanced design per `docs/design-language.md`:
  - 44px touch targets (`h-11` on all inputs/buttons)
  - Gradient therapist info card with shadow
  - Premium button shadows on CTAs
  - Better label typography and hierarchy
- Added `max-h-[90vh] overflow-y-auto` to prevent modal overflow

**Bug 3: Phone validation** 
- Integrated `react-international-phone` (same as EmailEntryForm)
- Added `forceDialCode` for clear country indication
- Proper autocomplete attributes (`tel`, `name`, `email`)
- Helper text for SMS notification

**Bug 4: Enter key support** 
- Added `handleKeyDown` handler for all steps
- Enter submits current step if valid
- Shift+Enter in textarea for line breaks
- Disabled during loading states

**Bug 5: Email verification** 
- **Decision**: Use verification codes for both SMS and email (consistency)
- Reuses existing `/api/public/verification/*` endpoints
- See `docs/earth-203-verification-decision.md` for rationale
- Benefits: simpler, stays in modal, mobile-friendly (auto-fill codes)

## Deployment Checklist

- [x] Tests pass (`npm run test:critical`) - 172 tests passing
- [x] Build succeeds (`npm run build`)
- [x] Migration applied to production
- [x] Documentation updated
- [x] All bugs fixed
- [ ] Verify `JWT_SECRET` is set in production
- [ ] Test verification flow (SMS/email codes)
- [ ] Test rate limiting (try 4 contacts)
- [ ] Verify therapist receives notification email
- [ ] Test on mobile: iOS contact card auto-fill, keyboard handling
- [ ] Verify cookie is set correctly
