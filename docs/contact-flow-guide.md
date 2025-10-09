# Patient-Initiated Contact Flow (EARTH-203)

## Quick Reference

### User Flow
1. Browse directory → Click "Therapeut:in buchen" or "Erstgespräch"
2. Modal: Enter name + email/phone → Verify code
3. Compose message with reason → Send
4. Success: "Therapeut erhält deine Nachricht"

### Rate Limit
- **3 contacts per patient per 24 hours**
- Tracked via `matches` table by `patient_id`
- Error message: "Du hast bereits 3 Therapeuten kontaktiert..."

### Session Cookie
- **Name**: `kh_client`
- **Type**: Functional (not tracking)
- **Duration**: 30 days
- **Scope**: `/` (entire site)
- **Content**: Signed JWT with `{ patient_id, contact_method, contact_value, name }`
- **Purpose**: Skip re-verification for returning users

### API Endpoint
```bash
POST /api/public/contact
```

### Message Templates
**Booking:**
```
Guten Tag [Name],

vielen Dank für deine Nachricht über Kaufmann Health.

Gerne vereinbaren wir einen Termin. Bitte wähle einen der folgenden Zeitslots:

Option 1: [Tag, Datum, Uhrzeit]
Option 2: [Tag, Datum, Uhrzeit]
Option 3: [Tag, Datum, Uhrzeit]

Adresse meiner Praxis:
[Straße, Hausnummer]
[PLZ Stadt]

ODER für Online-Termin:
[Link zum Video-Call / Zoom / Skype]

Bitte bestätige deinen Wunschtermin innerhalb von 48 Stunden. Falls ich nichts von dir höre, gebe ich die Slots wieder frei.

Viele Grüße,
[therapist_name]
```

**Consultation:**
```
Guten Tag [Name],

vielen Dank für deine Nachricht über Kaufmann Health.

Gerne biete ich dir ein kostenloses 15-Minuten-Erstgespräch an. Bitte wähle einen der folgenden Zeitslots:

Option 1: [Tag, Datum, Uhrzeit]
Option 2: [Tag, Datum, Uhrzeit]
Option 3: [Tag, Datum, Uhrzeit]

Das Gespräch dient zum gegenseitigen Kennenlernen und findet statt:
[Telefonisch ODER per Video-Call ODER in meiner Praxis]

Adresse (falls vor Ort):
[Straße, Hausnummer]
[PLZ Stadt]

Bitte bestätige deinen Wunschtermin innerhalb von 48 Stunden.

Viele Grüße,
[therapist_name]
```

### Therapist Notification
- Email with magic link to `/match/[secure_uuid]`
- No PII in email (privacy-first)
- Shows reason/issue only
- Full contact info revealed after acceptance (EARTH-205)

### Analytics
Track in Supabase events:
- `contact_modal_opened`
- `contact_verification_code_sent`
- `contact_verification_completed`
- `contact_message_sent`
- `contact_match_created`
- `contact_rate_limit_hit`

### Error Handling
- **Invalid therapist**: 404 "Therapeut nicht gefunden"
- **Rate limit**: 429 with `code: "RATE_LIMIT_EXCEEDED"`
- **Validation**: 400 "Fehlende Pflichtfelder"
- **Verification failed**: "Ungültiger Code" with retry option

### Database
- Creates `match` record with `status='proposed'`
- Metadata includes: `patient_initiated: true`, `contact_type`, `patient_reason`, `patient_message`, `contact_method`
- Patient record created if doesn't exist (by email or phone)

### Testing
```bash
npm run test:critical
```

Tests cover:
- New patient creation
- Rate limiting
- Validation
- 404 handling
- JWT token lifecycle
