# Google Ads Conversion Architecture

> **This is the authoritative reference for Google Ads conversion tracking.**  
> Read this before making any changes to conversion-related code.

## Overview

Kaufmann Health uses **Enhanced Conversions for Leads** - a two-layer system where:

1. **Client-side gtag** fires the BASE conversion (Website source)
2. **Server-side API** ENHANCES that conversion with hashed user data

This is NOT offline/import conversions. The conversion action source in Google Ads is **Website**, with Enhanced Conversions enabled via the Google Ads API.

## Conversion Events (Jan 2026)

| Event | Function | Value | When Fired |
|-------|----------|-------|------------|
| **KH - Form Complete** | `fireFormCompleteConversion()` | €4 | After questionnaire form submit |
| **KH - Lead Verified** | `fireLeadVerifiedConversion()` | €12 | After email/SMS verification (**PRIMARY**) |
| **KH - Intro Booked** | `fireIntroBookedConversion()` | €60 | After intro booking completes |
| **KH - Session Booked** | `fireSessionBookedConversion()` | €125 | After full session booking |

**Primary conversion**: `KH - Lead Verified` (€12) - Google optimizes bids against this.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER FLOW                                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. FORM SUBMISSION (SignupWizard)                                   │
│    - User completes questionnaire                                    │
│    - fireFormCompleteConversion(patientId) called (€4)              │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. VERIFICATION COMPLETED (Client-Side)                             │
│    File: src/lib/gtag.ts → fireLeadVerifiedWithEnhancement()        │
│                                                                      │
│    STEP A: Fire base conversion via gtag FIRST                      │
│    gtag('event', 'conversion', {                                    │
│      send_to: 'AW-XXX/label',                                       │
│      value: 12,                                                      │
│      currency: 'EUR',                                                │
│      transaction_id: patientId,  ← CRITICAL: Used for matching      │
│      transport_type: 'beacon'    ← Survives page navigation         │
│    });                                                               │
│                                                                      │
│    STEP B: Trigger server-side enhancement via API                  │
│    POST /api/public/conversions/enhance { patient_id }              │
│    (Uses sendBeacon for reliability)                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. SERVER-SIDE: ENHANCED CONVERSION                                  │
│    Endpoint: POST /api/public/conversions/enhance                   │
│    File: src/lib/google-ads.ts                                      │
│    Trigger: src/lib/conversion.ts → maybeFirePatientConversion()    │
│                                                                      │
│    API: uploadConversionAdjustments                                  │
│    Endpoint: customers/{id}:uploadConversionAdjustments             │
│                                                                      │
│    Payload: {                                                        │
│      conversionAdjustments: [{                                      │
│        conversionAction: '...',                                      │
│        adjustmentType: 'ENHANCEMENT',                               │
│        orderId: patientId,  ← MUST MATCH transaction_id from gtag   │
│        adjustmentDateTime: '...',                                    │
│        gclidDateTimePair: { gclid, conversionDateTime },            │
│        userIdentifiers: [{ hashedEmail, hashedPhoneNumber }]        │
│      }]                                                              │
│    }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. GOOGLE MATCHES ENHANCEMENT TO BASE                                │
│    - Google receives base conversion (Website source) FIRST         │
│    - Google receives enhancement (API source) AFTER                 │
│    - Matches via orderId = transaction_id                           │
│    - Enriches conversion with hashed user data for attribution      │
└─────────────────────────────────────────────────────────────────────┘
```

## Critical: Conversion Timing

**The base conversion MUST be received by Google BEFORE the enhancement.**

Previously (broken): Server fired enhancement immediately on verification, before client gtag fired.
Now (fixed): Client fires gtag first, then triggers server enhancement via `/api/public/conversions/enhance`.

The client uses `fireLeadVerifiedWithEnhancement()` which:
1. Fires gtag base conversion immediately
2. Calls enhancement endpoint via sendBeacon (network round-trip provides natural delay)

## Key Concepts

### Why Two Layers?

| Layer | Purpose | Reliability |
|-------|---------|-------------|
| Client gtag | Creates base conversion in Google Ads | May be blocked by ad blockers |
| Server API | Enriches with hashed PII for attribution | Always fires (server-side) |

The combination ensures:
- Base conversion is registered even without server enhancement
- Attribution is improved with hashed email/phone when enhancement succeeds
- GCLID links conversion to the original ad click

### The Matching Key: orderId / transaction_id

**This is critical**: The client-side `transaction_id` and server-side `orderId` MUST be the same value (the patient UUID).

```typescript
// Client (gtag.ts)
gtag('event', 'conversion', {
  transaction_id: patientId,  // ← Same value
  // ...
});

// Server (google-ads.ts)
{
  orderId: patientId,  // ← Same value
  // ...
}
```

Google uses this to match the enhancement to the base conversion.

## Google Ads UI Configuration

The conversion action should be configured as:

| Setting | Value |
|---------|-------|
| Conversion source | **Website** |
| Action optimization | Primary |
| Enhanced conversions | ✅ Enabled |
| Enhanced conversions method | **Google Ads API** |

**DO NOT** set conversion source to "Import" - that's for offline conversions, which is a different feature.

## API Details

### Endpoint

```
POST https://googleads.googleapis.com/v21/customers/{customerId}:uploadConversionAdjustments
```

### Payload Structure

```typescript
{
  conversionAdjustments: [{
    conversionAction: 'customers/XXX/conversionActions/YYY',
    adjustmentType: 'ENHANCEMENT',
    orderId: string,           // REQUIRED - matches transaction_id
    adjustmentDateTime: 'YYYY-MM-DD HH:MM:SS+00:00',
    gclidDateTimePair: {       // When GCLID available
      gclid: string,
      conversionDateTime: 'YYYY-MM-DD HH:MM:SS+00:00'
    },
    userIdentifiers: [{
      hashedEmail: string,     // SHA256, lowercase, trimmed
      userIdentifierSource: 'FIRST_PARTY'
    }]
  }],
  partialFailure: true,
  validateOnly: false
}
```

### Environment Variables

```bash
# OAuth credentials
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_DEVELOPER_TOKEN=

# Account IDs
GOOGLE_ADS_CUSTOMER_ID=1234567890
GOOGLE_ADS_LOGIN_CUSTOMER_ID=  # Optional, for MCC

# Conversion action resource names
GOOGLE_ADS_CA_CLIENT_REGISTRATION=customers/XXX/conversionActions/YYY
GOOGLE_ADS_CA_THERAPIST_REGISTRATION=customers/XXX/conversionActions/ZZZ

# Client-side (public)
NEXT_PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXX
NEXT_PUBLIC_GAD_CONV_CLIENT=AW-XXX/label
```

## Common Errors

### "Conversion action can't be used for import or adjustment"

**Cause**: The conversion action is not configured for Enhanced Conversions via API.

**Fix**: In Google Ads:
1. Go to Tools & Settings → Conversions
2. Click on the conversion action
3. Scroll to "Enhanced conversions"
4. Enable it and select "Google Ads API" as the method
5. Save

### "No base conversion found for enhancement"

**Cause**: The client-side gtag conversion didn't fire or wasn't received by Google before the enhancement was uploaded.

**Check**:
1. Verify `transaction_id` matches `orderId`
2. Check if gtag.js loaded before conversion fired (see `gtag_available` in events)
3. Verify no ad blocker interference

### Conversion shows in Google Ads but no enhancement data

**Cause**: Enhancement uploaded successfully but Google couldn't match it.

**Check**:
1. Verify `orderId` exactly matches `transaction_id`
2. Check timing - enhancement should come after base conversion

## Code Files

| File | Purpose |
|------|---------|
| `src/lib/gtag.ts` | Client-side: `fireLeadVerifiedWithEnhancement()` fires base + triggers enhancement |
| `src/app/api/public/conversions/enhance/route.ts` | API endpoint that triggers server-side enhancement |
| `src/lib/google-ads.ts` | Server-side API client, uploads enhancements |
| `src/lib/conversion.ts` | Orchestration - `maybeFirePatientConversion()` |
| `src/components/GtagLoader.tsx` | Loads gtag.js with Consent Mode v2 |
| `tests/google-ads.architecture.test.ts` | Verifies correct API usage |

## Historical Context

| Date | Event |
|------|-------|
| Dec 2025 | Code incorrectly changed to `uploadClickConversions` (offline conversions). This created NEW conversions server-side instead of enhancing website conversions. |
| Jan 8, 2026 | Fixed client-side reliability with beacon transport and direct pixel fallback. |
| Jan 10, 2026 | Corrected architecture to use `uploadConversionAdjustments` for Enhanced Conversions. |
| Jan 22, 2026 | Fixed conversion timing: client now fires base conversion FIRST, then triggers server enhancement via `/api/public/conversions/enhance`. This fixes "sending data too late" error in Google Ads. |

## The Two APIs - Know the Difference

### uploadClickConversions (NOT what we use)
- Creates **NEW** offline conversions
- Requires conversion source = "Import"
- Used when you have NO client-side tracking
- Works independently of website

### uploadConversionAdjustments (WHAT WE USE)
- **ENHANCES** existing website conversions
- Requires conversion source = "Website"
- Requires base conversion to exist first
- Adds hashed PII for better attribution

## Test Coverage

`tests/google-ads.architecture.test.ts` verifies:
- ✅ Uses `uploadConversionAdjustments` endpoint
- ✅ Payload includes `adjustmentType: 'ENHANCEMENT'`
- ✅ Payload includes `orderId` for matching
- ✅ User identifiers are SHA256 hashed
- ✅ GCLID included in `gclidDateTimePair`

Run tests:
```bash
npx vitest run tests/google-ads.architecture.test.ts
```

## Privacy & Compliance

- **No raw PII sent**: Only SHA256 hashed email/phone
- **GCLID for attribution**: Links to ad click, not personal data
- **Consent Mode v2**: Client-side respects user consent settings
- **Server-side always fires**: Not dependent on cookies/consent

## Consent & Attribution

For Enhanced Conversions to work properly, the **base conversion must be attributed to the ad click**. This requires:

### When User Accepts Cookies

We grant these consent signals:
- `ad_storage: 'granted'` - Allows conversion tracking cookies
- `ad_user_data: 'granted'` - **Critical**: Allows GCLID attribution for Enhanced Conversions

### When User Denies/Ignores Cookies

Default consent is all denied. Google's Consent Mode v2 sends "cookieless pings" with **limited attribution**. To recover some of these conversions:

**Consent Mode modeling** (automatic, no manual enable needed):
- Google automatically models conversions for non-consenting users
- **Eligibility threshold**: 700 ad clicks per 7-day period (per country)
- Once threshold is met, modeled conversions appear in the Conversions column automatically

### Troubleshooting Low Conversion Count

If Google Ads shows fewer conversions than expected:

1. **Check cookie consent rate** - Query `events` table for `cookie_consent_accepted` vs `cookie_consent_rejected`
2. **Verify `ad_user_data` is granted on accept** - See `CookieBanner.tsx`
3. **Check ad click volume** - Need 700 clicks/7 days for consent modeling to kick in
4. **Check `gtag_conversion_attempted` events** - Verify `gtag_available: true` and `has_gclid: true`
