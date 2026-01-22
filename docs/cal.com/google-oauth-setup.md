# Cal.com Google OAuth Setup

Self-hosted Cal.com requires its own Google Cloud OAuth credentials for Google Calendar integration.

## Key URLs

| Purpose | URL |
|---------|-----|
| Homepage | `https://www.kaufmann-health.de` |
| Cal.com instance | `https://cal.kaufmann.health` |
| Privacy policy | `https://www.kaufmann-health.de/datenschutz` |

## Google Cloud Project

- **Project name:** kaufmann-health-eu
- **Project ID:** 321222106152
- **Console:** `console.cloud.google.com/apis/credentials?project=kaufmann-health-eu`

## Required Scopes

Cal.com needs these Google Calendar scopes:

| Scope | Purpose |
|-------|---------|
| `calendar.readonly` | Check therapist availability, prevent double-bookings |
| `calendar.events` | Create/update/delete booking events |

Both are "sensitive scopes" requiring Google verification.

## OAuth Consent Screen Setup

1. Go to **APIs & Services** → **OAuth consent screen**
2. Configure:
   - **User Type:** External
   - **App name:** Kaufmann Health
   - **User support email:** Your email
   - **App logo:** Optional
   - **App domain:** `kaufmann-health.de`
   - **Privacy policy:** `https://www.kaufmann-health.de/datenschutz`
   - **Terms of service:** `https://www.kaufmann-health.de/agb`

3. **Add scopes:**
   - Click "Add or remove scopes"
   - Search for "calendar"
   - Select:
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/calendar.events`
   - Save

4. **Publishing status:** Set to "In production"

## Scope Verification

Sensitive scopes require separate verification from brand verification.

### Justification Template

Use this when submitting for scope verification:

**App description:**
> Kaufmann Health is a therapy matching platform that connects patients seeking body-oriented psychotherapy with qualified therapists in Germany. We use a self-hosted Cal.com instance (cal.kaufmann.health) as our scheduling system to enable patients to book appointments directly with therapists.

**calendar.readonly justification:**
> To check therapist availability by reading their existing Google Calendar events. This prevents double-bookings and shows patients accurate available time slots. Cal.com reads the calendar to display only times when the therapist is actually free.

**calendar.events justification:**
> To create, update, and delete booking events on the therapist's Google Calendar when patients book, reschedule, or cancel appointments. This ensures the therapist's calendar stays synchronized with bookings made through our platform.

**Data handling:**
> - Calendar data is only accessed for scheduling purposes
> - We only read/write events related to bookings made through our platform
> - No calendar data is stored permanently beyond what's needed for the booking
> - No calendar data is shared with third parties
> - Users can disconnect their Google Calendar at any time through Cal.com settings

**User authorization flow:**
> Therapists explicitly connect their Google Calendar through Cal.com's integration settings at cal.kaufmann.health. They are shown exactly what permissions are being requested and must actively consent. Patients do not need to connect their calendars.

## Troubleshooting

### "Google hasn't verified this app" warning

**Causes:**
1. Scopes not added to OAuth consent screen (most common)
2. Scope verification not submitted/approved
3. App still in "Testing" mode

**Fix:**
1. Verify scopes are listed in OAuth consent screen → Data Access
2. Submit for scope verification if not done
3. Set publishing status to "In production"

### Verification Types

Google has two separate verifications:

| Type | What it approves | Timeline |
|------|------------------|----------|
| Brand verification | App name, logo, domain | ~1 week |
| Scope verification | Access to sensitive APIs | 3-7 days for sensitive scopes |

Brand verification alone does NOT remove the warning if scopes aren't verified.

## Related

- [Event Type Setup](./event-type-setup.md)
- [Cal.com Architecture](./cal-com-architecture-verified.md)
