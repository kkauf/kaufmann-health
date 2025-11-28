# Email Cadence QA Tracker

**Created**: 2025-11-28
**Status**: IN PROGRESS

---

## Deployment Status

| Environment | Status | Notes |
|-------------|--------|-------|
| Local | ✅ Tested | All crons work, feedback page works |
| Production | ✅ Deployed | b6dd33c merged to main |

---

## Cron Endpoints Tested

| Endpoint | Local | Production | Notes |
|----------|-------|------------|-------|
| `/api/admin/leads/rich-therapist-email` | ✅ | ✅ | 0 sent (no patients in 20-28h window) |
| `/api/admin/leads/selection-nudge` | ✅ | ✅ | 0 sent (no patients in 5-6 day window) |
| `/api/admin/leads/feedback-request` | ✅ | ✅ | 0 sent (no patients in 10-11 day window) |

---

## Feedback Page QA

| Item | Status | Notes |
|------|--------|-------|
| `/feedback/quick` renders | ✅ | |
| Reason "price_too_high" displays | ✅ | Shows "Preis ist zu hoch" |
| Reason "unsure_which_therapist" displays | ✅ | Shows "Unsicher, welche:r Therapeut:in passt" |
| Reason "other" displays | ✅ | Shows "Etwas anderes" |
| Details textarea works | ✅ | Submit button appears when text entered |
| Details submission works | ✅ | Shows "✓ Zusätzliches Feedback gesendet" |
| Interview CTA visible | ✅ | Shows €25 Amazon voucher |
| Calendly link works | ✅ | Links to cal.com/kkauf/15min |
| "Zurück zur Startseite" link | ✅ | |

---

## Email Visual QA Checklist

### Day 1: Rich Therapist Email
> Subject: `[Name] — deine persönliche Empfehlung`

| Item | Status | Notes |
|------|--------|-------|
| Subject personalized with therapist name | ⬜ | |
| Patient name in greeting | ⬜ | |
| Therapist photo renders | ⬜ | |
| Therapist initials if no photo | ⬜ | |
| City displays | ⬜ | |
| Modality badges colored | ⬜ | |
| Approach text truncated | ⬜ | |
| "✓ Kostenloses Kennenlerngespräch" | ⬜ | |
| "✓ Schnelle Terminvergabe" | ⬜ | |
| "Jetzt ansehen" CTA → matches page | ⬜ | |
| "Andere Vorschläge ansehen" link | ⬜ | |
| "Passt nicht zu mir" → feedback page | ⬜ | |
| UTM params in URLs | ⬜ | |
| Dark mode disabled | ⬜ | |

### Day 5: Selection Nudge Email
> Subject: `Noch unsicher? So findest du die richtige Person`

| Item | Status | Notes |
|------|--------|-------|
| Patient name in greeting | ⬜ | |
| "✓ Kostenloses Kennenlerngespräch" | ⬜ | |
| "✓ Chemie zeigt sich im ersten Gespräch" | ⬜ | |
| "✓ Jederzeit wechseln" | ⬜ | |
| "Meine Vorschläge ansehen" CTA | ⬜ | |
| "Schreib uns" mailto link | ⬜ | |
| UTM params in URLs | ⬜ | |
| Dark mode disabled | ⬜ | |

### Day 10: Feedback Request Email
> Subject: `Kurze Frage: Was hält dich zurück?`

| Item | Status | Notes |
|------|--------|-------|
| Patient name in greeting | ⬜ | |
| 5 feedback options visible | ⬜ | |
| Each option links to /feedback/quick | ⬜ | |
| Correct reason param per option | ⬜ | |
| Interview CTA visible | ⬜ | |
| €25 Amazon voucher mentioned | ⬜ | |
| Calendly link works | ⬜ | |
| UTM params in URLs | ⬜ | |
| Dark mode disabled | ⬜ | |

---

## To Test Email Delivery

### Send Preview Emails to LEADS_NOTIFY_EMAIL (Recommended)

```bash
# Send ALL templates to your inbox
curl "https://www.kaufmann-health.de/api/admin/emails/preview?template=all&send=true&token=YOUR_CRON_SECRET"

# Send specific template
curl "https://www.kaufmann-health.de/api/admin/emails/preview?template=rich_therapist&send=true&token=YOUR_CRON_SECRET"
curl "https://www.kaufmann-health.de/api/admin/emails/preview?template=selection_nudge&send=true&token=YOUR_CRON_SECRET"
curl "https://www.kaufmann-health.de/api/admin/emails/preview?template=feedback_request&send=true&token=YOUR_CRON_SECRET"
curl "https://www.kaufmann-health.de/api/admin/emails/preview?template=email_confirmation&send=true&token=YOUR_CRON_SECRET"

# Preview HTML in browser (no send)
open "https://www.kaufmann-health.de/api/admin/emails/preview?template=rich_therapist&token=YOUR_CRON_SECRET"
```

### Local Testing
```bash
# Preview HTML locally
curl "http://localhost:3000/api/admin/emails/preview?template=rich_therapist&token=YOUR_CRON_SECRET"

# Send to LEADS_NOTIFY_EMAIL locally
curl "http://localhost:3000/api/admin/emails/preview?template=all&send=true&token=YOUR_CRON_SECRET"
```

---

## Unit Tests

```bash
npm test tests/email.new-cadence.test.ts
```

| Test | Status |
|------|--------|
| Rich Therapist - subject personalization | ✅ |
| Rich Therapist - UTM params | ✅ |
| Rich Therapist - feedback URL | ✅ |
| Rich Therapist - missing data | ✅ |
| Selection Nudge - content | ✅ |
| Selection Nudge - UTM params | ✅ |
| Feedback Request - options | ✅ |
| Feedback Request - interview CTA | ✅ |
| Feedback Request - links | ✅ |
| Feedback Request - UTM params | ✅ |
| Dark mode prevention | ✅ |

---

## Monitoring

### Check email delivery events
```sql
SELECT 
  properties->>'kind' as email_type,
  properties->>'patient_id' as patient_id,
  created_at
FROM events
WHERE type = 'email_sent'
  AND properties->>'kind' IN ('rich_therapist_d1', 'selection_nudge_d5', 'feedback_request_d10')
ORDER BY created_at DESC
LIMIT 20;
```

### Check cron execution
```sql
SELECT type, properties, created_at
FROM events
WHERE type IN ('cron_executed', 'cron_completed', 'cron_failed')
  AND source LIKE '%leads%'
ORDER BY created_at DESC
LIMIT 20;
```

### Check feedback responses
```sql
SELECT properties, created_at
FROM events
WHERE type = 'feedback_response'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Issues Found

| Issue | Severity | Status | Fix |
|-------|----------|--------|-----|
| (none yet) | | | |

---

## Sign-off

- [ ] All emails received in test inbox
- [ ] All links work correctly
- [ ] Dark mode renders correctly
- [ ] Feedback page captures responses
- [ ] Events logged to database

**QA Complete**: ⬜
**Approved by**: _____________
**Date**: _____________
