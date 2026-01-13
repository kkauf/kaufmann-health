# Match Rebuild & Apology Notifications

When matching bugs occur and patients don't receive their therapist matches, use these endpoints to rebuild matches and send apology notifications.

## Endpoints

### POST /api/admin/matches/rebuild

Rebuilds matches for a patient using the **production** `createInstantMatchesForPatient()` function directly.

- **Auth**: Admin cookie required
- **Body**:
  ```json
  {
    "patient_id": "uuid",           // required
    "delete_existing": true,        // default: true - delete empty match records first
    "send_notification": false      // optional: send apology email after rebuild
  }
  ```
- **Returns**:
  ```json
  {
    "data": {
      "matchesUrl": "/matches/uuid",
      "matchQuality": "exact|partial|none",
      "therapistCount": 3
    }
  }
  ```

### POST /api/admin/matches/email (template: 'apology')

Sends apology notification with proper logo/branding. Automatically falls back to SMS for phone-only patients.

- **Auth**: Admin cookie required
- **Body**:
  ```json
  {
    "template": "apology",
    "patient_id": "uuid",
    "personalized_message": "optional custom message"
  }
  ```
- **Returns**: `{ "data": { "ok": true, "via": "email|sms" } }`

## Scripts

### Batch Rebuild & Notify

For multiple affected patients, use the batch script:

```bash
# Edit AFFECTED_PATIENTS array in script first
npx tsx scripts/send-apology-via-api.ts --dry-run   # preview
npx tsx scripts/send-apology-via-api.ts             # send for real
npx tsx scripts/send-apology-via-api.ts --local     # use localhost:3000
```

### Single Patient via curl

```bash
# 1. Login to get cookie
curl -c /tmp/cookies.txt -X POST https://kaufmann-health.de/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"YOUR_ADMIN_PASSWORD"}'

# 2. Rebuild matches
curl -b /tmp/cookies.txt -X POST https://kaufmann-health.de/api/admin/matches/rebuild \
  -H "Content-Type: application/json" \
  -d '{"patient_id":"uuid-here","send_notification":true}'
```

## When to Use

1. **Matching bug detected** - patients report "no matches" or we see `match_quality: none` events
2. **Therapist data changed** - therapist updated schwerpunkte, availability, etc.
3. **Algorithm fix deployed** - need to re-run matching for affected patients

## Runbook: Matching Bug Recovery

1. **Identify affected patients**:
   ```sql
   SELECT p.id, p.name, p.email, p.phone_number, e.created_at
   FROM events e
   JOIN people p ON p.id::text = e.properties->>'patient_id'
   WHERE e.type = 'match_quality'
     AND e.properties->>'quality' = 'none'
     AND e.created_at > NOW() - INTERVAL '3 days'
   ORDER BY e.created_at DESC;
   ```

2. **Verify they still have no matches**:
   ```sql
   SELECT patient_id, COUNT(*) as match_count
   FROM matches
   WHERE patient_id IN ('uuid1', 'uuid2', ...)
     AND therapist_id IS NOT NULL
   GROUP BY patient_id;
   ```

3. **Rebuild matches** via API or script

4. **Send apology notifications** (auto if `send_notification: true`, or manually via template: 'apology')

## Files

| File | Purpose |
|------|---------|
| `src/app/api/admin/matches/rebuild/route.ts` | Rebuild endpoint |
| `src/lib/email/templates/patientApology.ts` | Apology email template |
| `scripts/send-apology-via-api.ts` | Batch send script |
| `scripts/rebuild-affected-matches-v2.ts` | Direct DB rebuild (backup) |

## Incident History

### Jan 11-13, 2026
- **Bug**: Intermittent matching failures, especially for female/no_preference patients
- **Affected**: 7 patients (Enes, Kamy, Cinzia, Laura, Lucien, Hansi, Ina)
- **Resolution**: Rebuilt matches with proper schwerpunkte scoring, sent 4 emails + 3 SMS
- **Root cause**: Under investigation (possibly Cal.com slot cache timing)
