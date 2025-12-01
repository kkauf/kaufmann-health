# SMS Verification (EARTH-191)

**Fast mobile onboarding: 2s SMS vs 45s+ email for 90% of our traffic**

## Overview

SMS verification allows users to verify their identity via a 6-digit code sent to their German mobile number, dramatically reducing onboarding friction on mobile devices.

### Key Benefits
- **Speed**: 2-second SMS delivery vs 45+ seconds for email
- **Mobile-first**: 90% of traffic is mobile - SMS is their native experience
- **Higher conversion**: Faster verification = less dropoff
- **Graceful fallback**: Auto-fallback to email if SMS fails

## Architecture

### Verification Modes (env: `VERIFICATION_MODE`)

- **`email`**: Email-only verification (default for backward compatibility)
- **`sms`**: SMS-only verification
- **`choice`**: Device-aware defaults
  - **Mobile** (90%): Phone field by default, "Email verwenden" link below
  - **Desktop** (10%): Email field by default, "Handynummer verwenden" link below

### Technical Stack

- **SMS Provider**: Twilio Verify API
- **Phone Input**: `react-international-phone` for robust international phone handling
- **Phone Format**: E.164 (`+4917612345678`)
- **Supported Countries**: All countries via dropdown, default Germany
- **Code Format**: 6 digits, 10-minute expiry
- **Fallback**: Auto-fallback to email on SMS delivery failures (choice mode)

## Database Schema

```sql
-- people table extensions
ALTER TABLE public.people
ADD COLUMN phone_number VARCHAR(20),         -- E.164 format
ADD COLUMN verification_code VARCHAR(10),    -- Last SMS code (audit)
ADD COLUMN verification_code_sent_at TIMESTAMPTZ;

-- form_sessions table extensions  
ALTER TABLE public.form_sessions
ADD COLUMN phone_number VARCHAR(20);

-- Index for conflict detection
CREATE INDEX idx_people_phone_number 
ON public.people(phone_number) 
WHERE phone_number IS NOT NULL;
```

## API Endpoints

### POST /api/public/verification/send-code

Send verification code via SMS or email based on VERIFICATION_MODE.

**Request:**
```json
{
  "contact": "0176 123 45678",  // or email
  "contact_type": "phone",      // or "email"
  "lead_id": "optional-uuid",
  "form_session_id": "optional-uuid"
}
```

**Response (Success):**
```json
{
  "data": { 
    "sent": true, 
    "method": "sms",
    "sid": "twilio-verification-sid"
  },
  "error": null
}
```

**Response (Fallback):**
```json
{
  "data": { 
    "fallback": "email", 
    "reason": "SMS delivery failed"
  },
  "error": null
}
```

### POST /api/public/verification/verify-code

Verify 6-digit SMS code or email token.

**Request:**
```json
{
  "contact": "+4917612345678",
  "contact_type": "phone",
  "code": "123456"
}
```

**Response:**
```json
{
  "data": { "verified": true, "method": "sms" },
  "error": null
}
```

## Frontend Components

### ContactEntryForm (EmailEntryForm)

Device-aware contact entry form. `EmailEntryForm` was refactored in place and now exports both names for backward compatibility.

**Props:**
```typescript
{
  defaultSessionPreference?: 'online' | 'in_person';
  dataCta?: string;
  verificationMode?: 'email' | 'sms' | 'choice';
}
```

**Features:**
- Auto-detects mobile/desktop (choice mode)
- Remembers user preference in localStorage (`kh_contact_method`)
- Smooth field switching with toggle link
- **Phone input**: `react-international-phone` with country selector
- E.164 format output for backend processing
- Custom styling to match design system
- Hydration-safe (no SSR/client mismatch)

### CodeVerificationInput

6-digit SMS code input with auto-advance and paste support.

**Props:**
```typescript
{
  onVerify: (code: string) => Promise<{ success: boolean; error?: string }>;
  onResend?: () => Promise<void>;
  disabled?: boolean;
}
```

**Features:**
- Auto-focus and auto-advance between digits
- Paste support (6-digit codes)
- Backspace navigation
- Loading state during verification
- Error display

## Phone Validation

Phone input is handled by `react-international-phone` which:
- ✅ Validates phone numbers for all countries
- ✅ Formats in E.164 format automatically
- ✅ Shows country flag and dialing code
- ✅ Defaults to Germany (`+49`) for our use case
- ✅ Prevents invalid input

Backend validation still uses our custom validators in `@/lib/verification/phone.ts` for additional German mobile-specific checks when sending SMS.

## Analytics Events

All events tracked via `ServerAnalytics.trackEventFromRequest`:

- **`verification_code_sent`**: Code sent successfully (SMS or email)
  - Props: `{ contact_type: 'phone' | 'email', sid?: string }`
- **`verification_code_verified`**: Code verified successfully
  - Props: `{ contact_type: 'phone' | 'email' }`
- **`verification_code_failed`**: Code sending/verification failed
  - Props: `{ contact_type, reason, error }`
- **`verification_fallback_email`**: SMS failed, falling back to email
  - Props: `{ reason }`

## Environment Configuration

```bash
# Verification mode (default: email)
# Works on both server and client
NEXT_PUBLIC_VERIFICATION_MODE="choice"  # email | sms | choice

# Twilio Verify API
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_VERIFY_SERVICE_SID="VA..."
```

## Testing

### Unit Tests

```bash
# Phone validation and formatting
npm test tests/verification.phone.test.ts
```

### Integration Testing

SMS verification can be tested in staging/dev by:
1. Using Twilio test credentials
2. Using test phone numbers (provided by Twilio)
3. Verifying fallback to email works

## Security Considerations

1. **Rate Limiting**: 
   - Same IP-based rate limiting as email (60s window)
   - Twilio Verify has built-in rate limiting per phone number

2. **Phone Number Privacy**:
   - Stored as E.164 format
   - Not exposed in public APIs
   - Same RLS policies as email

3. **Code Expiry**:
   - Twilio Verify handles 10-minute expiry automatically
   - Codes are single-use

4. **Validation**:
   - German mobile numbers only (reduces spam/abuse)
   - Backend validation before sending SMS
   - Graceful fallback prevents blocking legitimate users

## Cost Considerations

- **Twilio Verify Pricing**: ~€0.05/SMS (Germany)
- **Monthly Budget**: Monitor via Twilio dashboard
- **Fallback Strategy**: Email fallback prevents blocking if budget exceeded

## Post-Verification SMS (Transactional)

### SMS Cadence
Phone-only users receive a separate nurture sequence via `/api/admin/leads/sms-cadence`:

| Day | Purpose |
|-----|---------|
| 2 | Gentle nudge with matches link + callback offer |
| 5 | Decision help + "Antworte Hilfe" for callback |
| 10 | Feedback request (no link, just ask what's blocking) |

See `docs/emails.md` → "SMS Cadence" for full details.

### Reply Handling
- **Incoming webhook**: `/api/internal/sms/incoming` forwards replies to `LEADS_NOTIFY_EMAIL`
- **Callback detection**: Messages containing "Hilfe", "Anruf", "Rückruf" get flagged for priority callback

## Monitoring

Monitor SMS verification health:

```sql
-- SMS verification success rate (last 24h)
SELECT 
  COUNT(*) FILTER (WHERE type = 'verification_code_sent' 
    AND props->>'contact_type' = 'phone') as sms_sent,
  COUNT(*) FILTER (WHERE type = 'verification_code_verified' 
    AND props->>'contact_type' = 'phone') as sms_verified,
  COUNT(*) FILTER (WHERE type = 'verification_fallback_email') as fallbacks
FROM events
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND source = 'api.verification.send-code';
```

## Migration Path

1. **Phase 1** (Current): Infrastructure ready, mode=`email` (backward compatible)
2. **Phase 2**: Enable `choice` mode in staging, monitor metrics
3. **Phase 3**: Enable `choice` mode in production
4. **Phase 4**: Evaluate switching to `sms` mode (mobile-only if conversion proves significantly better)

## Troubleshooting

### SMS not delivering

1. Check Twilio account status and balance
2. Verify phone number is German mobile (15x/16x/17x)
3. Check Twilio Verify service logs
4. Verify `TWILIO_*` env vars are set correctly

### Fallback not working

1. Check `VERIFICATION_MODE=choice` is set
2. Verify email configuration (RESEND_API_KEY)
3. Check analytics for `verification_fallback_email` events

### Phone validation failing

1. Test with unit tests: `npm test tests/verification.phone.test.ts`
2. Check phone format (should be German mobile)
3. Verify normalizePhoneNumber returns E.164 format

## References

- Linear Issue: [EARTH-191](https://linear.app/kaufmannearth/issue/EARTH-191)
- Twilio Verify Docs: https://www.twilio.com/docs/verify/api
- Migration: `supabase/migrations/20250929180000_earth_191_sms_verification.sql`
