# Cal.com Event Type Setup Guide

This document explains how to configure Cal.com event types for Kaufmann Health therapists.

## Overview

Each therapist needs **two event types** in Cal.com:

| Event Type | Slug | Duration | Purpose |
|------------|------|----------|---------|
| **Kostenloses Kennenlernen** | `intro` | 15 min | Free introductory session |
| **Therapiesitzung** | `full-session` | 50-60 min | Paid therapy session |

## URL Structure

KH generates booking URLs in this format:
```
https://cal.kaufmann.health/{cal_username}/{event-slug}?metadata[key]=value&successRedirectUrl=...
```

Examples:
- Intro: `https://cal.kaufmann.health/kgmkauf/intro`
- Full session: `https://cal.kaufmann.health/kgmkauf/full-session`

## Creating Event Types

### 1. Log in to Cal.com Admin

Navigate to `https://cal.kaufmann.health` and log in with admin credentials.

### 2. Create "Intro" Event Type

1. Go to **Event Types** → **New Event Type**
2. Configure:
   - **Title**: `Kostenloses Kennenlernen`
   - **URL Slug**: `intro` (⚠️ must be exactly this)
   - **Duration**: 15 minutes
   - **Location**: Video (Google Meet / Zoom)
   - **Description**: 
     ```
     Ein kostenloses 15-minütiges Erstgespräch zum gegenseitigen Kennenlernen.
     ```

3. Under **Advanced** → **Booking Questions**:
   - Keep defaults (name, email)
   - Optional: Add phone number

4. Under **Availability**:
   - Link to therapist's availability schedule

5. **Save**

### 3. Create "Full Session" Event Type

1. Go to **Event Types** → **New Event Type**
2. Configure:
   - **Title**: `Therapiesitzung`
   - **URL Slug**: `full-session` (⚠️ must be exactly this)
   - **Duration**: 50 or 60 minutes (therapist preference)
   - **Location**: Video or In-Person (therapist preference)
   - **Description**:
     ```
     Eine vollständige Therapiesitzung.
     ```

3. Under **Payments** (if applicable):
   - Configure Stripe payment collection
   - Set price per session

4. **Save**

## Metadata Handling

KH passes metadata in the booking URL that arrives in webhook payloads:

| Key | Description | Example |
|-----|-------------|---------|
| `kh_therapist_id` | KH therapist UUID | `abc123...` |
| `kh_booking_kind` | Event type | `intro` or `full_session` |
| `kh_source` | Booking origin | `directory` or `questionnaire` |
| `kh_gclid` | Google Ads click ID | `Cj0KCQ...` |
| `kh_utm_source` | UTM source | `google` |
| `kh_utm_medium` | UTM medium | `cpc` |
| `kh_utm_campaign` | UTM campaign | `spring_2025` |

This metadata is stored in `cal_bookings.kh_metadata` when the webhook is received.

## Redirect After Booking

KH uses `successRedirectUrl` to redirect users back to Kaufmann Health after booking:
```
https://www.kaufmann-health.de/booking/confirmed?therapist={id}&kind={type}
```

This shows a branded confirmation page instead of Cal's default.

## Availability Configuration

Each therapist should configure their availability in Cal.com:

1. Go to **Availability** → **Default Schedule**
2. Set working hours for each day
3. Add buffer time between appointments (recommended: 10-15 min)
4. Set minimum notice (recommended: 24 hours)
5. Set booking window (recommended: 2-4 weeks ahead)

## Per-Therapist Setup Checklist

When onboarding a new therapist:

- [ ] Create Cal.com user (automatic via KH provisioning)
- [ ] Create `intro` event type with slug `intro`
- [ ] Create `full-session` event type with slug `full-session`
- [ ] Configure availability schedule
- [ ] Test booking flow end-to-end
- [ ] Verify webhook received in KH (`cal_bookings` table)
- [ ] Set `cal_enabled = true` in KH admin

## Troubleshooting

### "Event not found" error
- Verify the event type slug matches exactly (`intro` or `full-session`)
- Check that the event type is not disabled

### Webhook not received
- Verify `CAL_WEBHOOK_SECRET` matches in both KH and Cal webhook config
- Check webhook is enabled for the user
- Check KH logs for signature verification failures

### Metadata not appearing
- Metadata must be passed as `metadata[key]=value` in URL params
- Check Cal.com version supports metadata forwarding

## Related Documentation

- [Cal.com Architecture](./cal-com-architecture-verified.md)
- [Cal.com Integration Cheatsheet](./cal-com-integration-cheatsheet.md)
- [User Provisioning](../cal-provisioning.md)
