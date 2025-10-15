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
- **Security**: JWT signed with `JWT_SECRET` environment variable (required in production)

### API Endpoint
```bash
POST /api/public/contact
```

### Message Templates
**Booking:**
```
Guten Tag [Name],

vielen Dank für deine Nachricht über Kaufmann Health. Ich freue mich, von dir zu hören!

Gerne vereinbaren wir einen Termin. Ich biete dir folgende Zeitslots an:

Option 1: [Tag, Datum, Uhrzeit]
Option 2: [Tag, Datum, Uhrzeit]
Option 3: [Tag, Datum, Uhrzeit]

Adresse meiner Praxis:
[Straße, Hausnummer]
[PLZ Stadt]

ODER für Online-Termin:
[Link zum Video-Call / Zoom / Skype]

Ich reserviere diese Termine für dich für die nächsten 48 Stunden. Da auch andere Klient:innen auf einen Platz warten, wäre ich dir dankbar, wenn du mir bis dahin kurz Bescheid geben könntest, welcher Termin für dich passt – oder ob keiner davon funktioniert, dann finden wir eine andere Lösung.

Für Rückfragen stehe ich dir gerne zur Verfügung.

Viele Grüße,
[therapist_name]
```

**Consultation:**
```
Guten Tag [Name],

vielen Dank für deine Nachricht über Kaufmann Health. Ich freue mich, von dir zu hören!

Gerne biete ich dir ein kostenloses 15-Minuten-Erstgespräch an. Ich biete dir folgende Zeitslots an:

Option 1: [Tag, Datum, Uhrzeit]
Option 2: [Tag, Datum, Uhrzeit]
Option 3: [Tag, Datum, Uhrzeit]

Das Gespräch findet statt:
[Telefonisch ODER per Video-Call ODER in meiner Praxis]

Adresse (falls vor Ort):
[Straße, Hausnummer]
[PLZ Stadt]

Ich reserviere diese Termine für dich für die nächsten 48 Stunden. Da auch andere interessierte Personen auf einen Platz warten, wäre ich dir dankbar, wenn du mir bis dahin kurz Bescheid geben könntest – gerne auch, falls keiner der Termine passt, dann schauen wir gemeinsam nach Alternativen.

Für Rückfragen stehe ich dir gerne zur Verfügung.

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
