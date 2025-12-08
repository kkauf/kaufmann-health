# Test 4: Concierge vs Self-Service Matching

## Overview

Test 4 compares two lead matching approaches:
- **Concierge**: Manual therapist curation by admin (24h turnaround)
- **Self-Service**: Instant auto-matching based on Schwerpunkte selection

## URL Parameters

Variants are passed via URL:
- `/fragebogen?variant=concierge`
- `/fragebogen?variant=self-service`
- `/therapie-finden?variant=concierge` (landing page)
- `/therapie-finden?variant=self-service` (landing page)

Both `?variant=` and `?v=` are supported.

## User Flow Differences

### Questionnaire Routing

| Step | Concierge | Self-Service |
|------|-----------|--------------|
| 1. Timeline | ✅ | ✅ |
| 2. Topic Input | Open text field | Skipped |
| 2.5 Schwerpunkte | Skipped | Checkbox selection |
| 3. Modality | ✅ | ✅ |
| 4. Location | ✅ | ✅ |
| 5. Preferences | ✅ | ✅ |
| 6. Contact | ✅ | ✅ |

### Post-Verification Behavior

| Variant | Auto-Matching | Confirmation Screen | Next Step |
|---------|---------------|---------------------|-----------|
| Concierge | ❌ No | "Wir bereiten deine Auswahl vor (24h)" | Wait for admin email |
| Self-Service | ✅ Yes | "Deine Matches sind bereit" + CTA | View matches immediately |

## Technical Implementation

### SignupWizard.tsx

```typescript
const isConcierge = variant === 'concierge';
const isSelfService = variant === 'self-service';

// Variant-aware step routing
const usesSchwerpunkteStep = isSelfService || (!isConcierge && SHOW_SCHWERPUNKTE);
```

### Leads API (`/api/public/leads`)

```typescript
// Gate auto-matching for concierge
const skipAutoMatch = campaign_variant === 'concierge';

if (!skipAutoMatch) {
  matchResult = await createInstantMatchesForPatient(patientId, variant);
}
```

### Admin Alerts (`/api/admin/alerts/new-leads`)

Only sends notifications for leads requiring manual intervention:
- Concierge leads: Included in notification
- Self-service/marketplace leads: Excluded (auto-matched)

## Data Model

### `people` Table

| Field | Description |
|-------|-------------|
| `campaign_variant` | `'concierge'` \| `'self-service'` \| `'marketplace'` \| null |
| `metadata.schwerpunkte` | Array of focus areas (self-service) |
| `metadata.additional_info` | Open text field (concierge) |

### Analytics Events

| Event | Variant | Description |
|-------|---------|-------------|
| `instant_match_created` | Self-service | Auto-matches generated |
| `concierge_lead_created` | Concierge | Lead requires manual matching |

## Admin UI

### `/admin/leads`

- **Variant Badge**: Shows 🎯 Concierge or ⚡ Self-Service
- **Schwerpunkte**: Displayed for self-service leads
- **Freitext**: Displayed for concierge leads (additional_info)

### Manual Matching Flow (Concierge)

1. Admin sees lead in `/admin/leads` with 🎯 Concierge badge
2. Admin clicks "Match" → selects up to 3 therapists
3. Admin sends selection email via `/api/admin/matches/email?template=selection`
4. Patient receives email with therapist profiles + selection links

## Landing Pages

### `/therapie-finden`

Reads `?variant=` from URL and passes to all CTAs:
```typescript
const fragebogenHref = `/fragebogen?variant=${variant}`;
```

### `/start`

Already supports variants via `?v=` parameter.

## Testing

### E2E Tests (`test4-concierge-self-service.spec.ts`)

- Concierge flow shows text field (step 2)
- Self-service flow shows Schwerpunkte (step 2.5)
- Concierge confirmation shows waiting screen
- Self-service confirmation shows matches CTA

### Unit Tests (`api.leads.test4-variants.test.ts`)

- Concierge leads skip auto-matching
- Self-service leads get instant matches
- Admin alerts exclude auto-matched leads

## Google Ads Integration

Both variants fire conversions at verification. The `campaign_variant` is stored for attribution analysis.

Landing page URLs from ads:
- Concierge: `https://kaufmann-health.de/therapie-finden?variant=concierge`
- Self-Service: `https://kaufmann-health.de/therapie-finden?variant=self-service`
