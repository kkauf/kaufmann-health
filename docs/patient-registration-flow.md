# Patient Registration Flow

Complete documentation of the patient journey from landing page to therapist matching.

## Overview

```
 ENTRY POINTS                QUESTIONNAIRE              VERIFICATION            POST-VERIFICATION
 ─────────────               ─────────────              ────────────            ──────────────────
 /therapie-finden             Step 2.5                   Email:                  Instant Matching
 /start                       Schwerpunkte               confirm link            (self-service)
 /lp/[modality]               ↓                          in new tab/             ↓
 /fragebogen                  Step 2.6                   session                 /matches/[session]
 /therapeuten                  Payment Info               ↓                      ↓
                               ↓                          status → new           Therapist Contact
  variant=                    Step 2 (concierge only)
  concierge|                   What Brings You           Phone:                  Manual Curation
  self-service|                ↓                          SMS code on             (concierge)
  online                      Step 3                     same screen             ↓
                               Modality                   ↓                      Admin selects
  mode=online                  ↓                          status → new           matches (24h)
  modality=narm|...           Step 4
  kw={keyword}                 Location + Format
                               ↓
                              Step 5
                               Gender Pref
                               ↓
                              Step 6
                               Contact Info
                               (name + email/phone)
                               ↓
                              Step 6.5 (phone only)
                               SMS Code
                               ↓
                              Step 7
                               Email Confirmation
                               (email only)
```

---

## Phase 1: Entry Points

Patients arrive via different landing pages. Each sets a campaign variant that determines the post-submission flow.

| Landing Page | Default Variant | Notes |
|-------------|----------------|-------|
| `/therapie-finden` | concierge | Best organic converter |
| `/start` | self-service | Paid traffic default |
| `/lp/[modality]` | self-service | Campaign landing pages (NARM, SE, etc.) |
| `/fragebogen` | randomized | Direct access, client-side variant assignment |
| `/therapeuten` | — | Directory browse, enables draft contact flow |

### URL Parameters

| Param | Values | Effect |
|-------|--------|--------|
| `variant` / `v` | `concierge`, `self-service` | Forces flow variant |
| `mode` | `online` | Pre-fills session_preference, skips location step |
| `modality` | `narm`, `hakomi`, `somatic-experiencing`, `core-energetics` | Pre-fills therapeutic approach |
| `kw` | keyword string | Google Ads keyword, maps to modality auto-fill |
| `startStep` | number | Skip to specific step (e.g., from concierge CTA) |
| `fs` | UUID | Form session ID for cross-device continuation |
| `restart` | `1` | Force fresh wizard state |

---

## Phase 2: Questionnaire Steps

**Component:** `SignupWizard.tsx`
**Persistence:** Auto-saves to localStorage + syncs to `form_sessions` table every 30s.

### Step 2.5: Schwerpunkte (Specializations)

**Screen:** `ScreenSchwerpunkte.tsx` | **Progress:** 0%

- Asks: "Welche Körpertherapie-Methoden interessieren dich?"
- Options: NARM, Hakomi, Somatic Experiencing, Core Energetics (multi-select)
- Shows live therapist count matching current filters
- **Required:** At least 1 selection
- **Skip:** Available
- **Next:** Step 2.6

### Step 2.6: Payment Info

**Screen:** `ScreenPaymentInfo.tsx` | **Progress:** 8%

- Explains: "Kurzer Hinweis zur Finanzierung" (sessions cost EUR 80-120)
- Two options:
  - **"Das passt für mich"** (`self_pay`) -- continues to questionnaire
  - **"Nein, ich brauche einen Kassenplatz"** (`insurance_waitlist`) -- shows insurance resources, soft gate
- Insurance selection shows KV Terminservicestelle link and educational content
- **Event:** `payment_preference_selected` with `preference` property
- **Next:** Step 2 (concierge only) or Step 3 (self-service)

### Step 2: What Brings You? (Concierge Only)

**Screen:** `NewScreen3_WhatBringsYou.tsx` | **Progress:** 0%

- Asks: "Was bringt dich zur Therapie?" (free text, 10-500 chars)
- Shows Katherine Kaufmann's photo + personal trust message
- **Self-service users skip this step entirely**
- **Next:** Step 3

### Step 3: Modality Preferences

**Screen:** `NewScreen5_Modality.tsx` | **Progress:** 17%

- Asks: "Ist dir eine bestimmte Methode wichtig?"
- Options: NARM, Hakomi, Somatic Experiencing, Core Energetics
- Pre-filled from `?modality=` or `?kw=` params
- **Optional:** Can skip
- **Next:** Step 4

### Step 4: Location + Session Format + Language

**Screen:** `Screen3.tsx` | **Progress:** 33%

- **Session preference:** Online / Vor Ort (Berlin) / Beides
  - `?mode=online` pre-fills "Online" and hides this question
- **City:** Pre-filled "Berlin" (only active location), shown for in-person/both
- **Language:** Deutsch / Englisch / Egal (optional)
- **Next:** Step 5

### Step 5: Gender Preference

**Screen:** `Screen4.tsx` | **Progress:** 50%

- Asks: "Bevorzugtes Geschlecht der Therapeut:in (optional)"
- Options: Frau / Mann / Keine Praeferenz
- **Optional**
- **Next:** Step 6

### Step 6: Contact Info

**Screen:** `Screen1.tsx` | **Progress:** 67%

- **Name** (required)
- **Contact method toggle:** Email or Phone
  - Email: standard email validation
  - Phone: German mobile number validation + normalization
- Shows match count: "X passende Therapeut:innen gefunden"
- Consent text displayed
- **Next:**
  - Phone users -> Step 6.5 (SMS verification)
  - Email users -> submits form, shows Step 7 (email confirmation)

### Step 6.5: SMS Code Verification (Phone Only)

**Screen:** `Screen1_5.tsx` | **Progress:** 83%

- 6-digit code input with auto-advancing fields
- Supports paste-to-fill for OTP
- Auto-submits when all 6 digits entered
- Resend option available
- **On success:** Phone verified, form auto-submitted -> Step 7/8 confirmation

### Step 7: Email Confirmation Waiting (Email Only)

**Progress:** 100%

- Shows: "Bestaetige deine E-Mail-Adresse"
- Progressive disclosure:
  1. "E-Mail nicht erhalten?" -> resend form
  2. After 1+ resends: SMS fallback option
- **No resend events tracked this week** -- users don't interact with this screen, they go to email

### Step 8-9: Confirmation / Matches

- **Concierge:** "Wir bereiten deine persoenliche Auswahl vor" (24h manual curation)
- **Self-service + phone verified:** Immediate matches CTA or auto-redirect
- **Self-service + email verified:** Auto-redirect to `/matches/[session]`
- **Optional:** Phone users can add email for therapist communication

---

## Phase 3: Lead Creation

**Endpoint:** `POST /api/public/leads`
**Triggered:** When user submits at Step 6

### Fields Stored

| Field | Source | Stored In |
|-------|--------|-----------|
| name | Step 6 | `people.name` |
| email | Step 6 (if email) | `people.email` |
| phone_number | Step 6 (if phone) | `people.phone_number` |
| contact_method | Step 6 toggle | `people.contact_method` |
| campaign_source | URL/referrer detection | `people.campaign_source` |
| campaign_variant | URL param or default | `people.campaign_variant` |
| form_session_id | Auto-generated | `people.metadata.form_session_id` |
| confirm_token | Generated (email only) | `people.metadata.confirm_token` |

### On Submit

1. Person record created with `status: 'pending_verification'`
2. **Email users:** Confirmation email sent with magic link (24h TTL)
3. **Phone users:** Already verified via Step 6.5, status set to `new`
4. Internal admin notification sent
5. Campaign attribution stored from headers/URL

---

## Phase 4: Verification

### Email Verification

**Endpoint:** `GET /api/public/leads/confirm?token={token}&id={id}`

1. Validates token matches and hasn't expired (24h)
2. Updates `status` -> `new`
3. Sets `metadata.confirmed_at`, `metadata.email_confirmed_at`
4. Deletes `confirm_token` and `confirm_sent_at` from metadata
5. Creates client session cookie (`kh_client`, 30-day JWT)
6. Creates instant matches (self-service, if no draft contact)
7. Processes draft contact (if from directory flow)
8. Redirects to matches URL (self-service) or confirmation page (concierge)

### SMS Verification

**Endpoint:** `POST /api/public/verification/verify-code`

1. Validates 6-digit code via Twilio
2. Finds or creates person record
3. Sets `metadata.phone_verified: true`, `status: 'new'`
4. Creates client session cookie
5. Creates instant matches (if no draft contact)
6. Returns matches URL for client-side redirect

---

## Phase 5: Status Transitions

```
                         ┌──────────────────────┐
                         │  pending_verification │
                         │  (form submitted,     │
                         │   not yet verified)   │
                         └──────────┬────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            email link clicked              phone verified
                    │                          (SMS code)
                    ▼                               │
         ┌──────────────────┐                       │
         │ email_confirmation│                      │
         │ _sent             │                      │
         │ (legacy status)   │                      │
         └────────┬──────────┘                      │
                  │                                 │
                  │ + form_completed                │
                  ▼                                 ▼
         ┌──────────────────────────────────────────────┐
         │                    new                       │
         │  (verified, actionable -- ready for          │
         │   instant matching or admin curation)        │
         └──────────────────────┬───────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
          self-service                      concierge
                │                               │
                ▼                               ▼
         instant matches               admin reviews
         proposed -> selected           manually curates
         -> sent -> accepted            therapist selections
```

### Status Values

| Status | Meaning |
|--------|---------|
| `pending_verification` | Form submitted, awaiting email/phone verification |
| `email_confirmation_sent` | Email sent, link not yet clicked |
| `new` | **Verified and actionable.** Ready for matching or admin review |
| `matched` | Admin selected therapist matches (concierge) |
| `rejected` | Not a fit (admin decision) |

---

## Phase 6: Form Completion Merge

**Endpoint:** `POST /api/public/leads/{id}/form-completed`
**Called:** After user reaches confirmation screen (Step 7+)

Merges questionnaire data from `form_sessions` into `people.metadata`:

| Data Merged | Source Step |
|------------|------------|
| `city` | Step 4 |
| `session_preference` | Step 4 |
| `gender_preference` | Step 5 (mapped: Frau->female, Mann->male) |
| `language_preference` | Step 4 |
| `modality_matters` | Step 3 |
| `specializations` | Step 3 (methods array) |
| `issue` | Step 2 (concierge additional_info) |
| `schwerpunkte` | Step 2.5 |
| `payment_preference` | Step 2.6 |
| `form_completed_at` | Timestamp |
| Campaign attribution | Backfilled from form session if missing |

---

## Phase 7: Instant Matching (Self-Service)

**Function:** `createInstantMatchesForPatient()` in `/src/features/leads/lib/match.ts`

Triggered for verified patients without a draft contact:
1. Filters therapists by: schwerpunkte, session_preference, city, language, gender
2. Ranks by match quality
3. Creates up to 3 `matches` records with `status: 'proposed'`
4. Generates matches URL: `/matches/[session_id]`
5. Stores URL in `people.metadata.last_confirm_redirect_path`

---

## Phase 8: Email Journey

| Trigger | Template | When |
|---------|----------|------|
| Form submitted (email users) | `renderEmailConfirmation` | Immediately |
| Admin notified | Internal notification | On lead creation |
| Resend requested | `renderEmailConfirmation` (new token) | User action on Step 7 |
| Phone user adds email | Confirmation email | Optional post-verification |

**No nurture emails for patients.** Post-submission communication is handled by the matching flow (match notifications, therapist introductions).

---

## Variant Differences

| Behavior | Self-Service | Concierge |
|----------|-------------|-----------|
| Step 2 (What Brings You) | Skipped | Shown |
| Post-verification | Instant matches | 24h manual curation |
| Matches URL | Auto-redirect | Admin sends selections |
| Confirmation screen | "See your matches" CTA | "We're preparing your selection" |

---

## Campaign Attribution Chain

Attribution is captured at multiple points with fallback logic:

```
1. URL params (?variant=, ?kw=, ?modality=)
   ↓ stored in SignupWizard refs
2. Form session auto-save (_attr.campaign_source, _attr.campaign_variant)
   ↓ synced to form_sessions table
3. Lead submission headers (X-Campaign-Source-Override, X-Campaign-Variant-Override)
   ↓ stored in people.campaign_source, people.campaign_variant
4. Form completion backfill (from form_sessions if missing on person)
```

---

## Analytics Events

### Wizard Progression
- `screen_viewed` -- step number, session_id
- `payment_preference_selected` -- preference (self_pay / insurance_waitlist)

### Submission
- `form_completed` / `fragebogen_completed` -- lead_id, form_session_id
- `contact_verification_completed` -- contact_method (email / phone)
- `instant_match_created` -- match_quality, patient_id

### Funnel Metrics (Admin Dashboard)
- **Form Completion Rate:** fragebogen_completed / page_views
- **Verification Rate:** contact_verification_completed / fragebogen_completed
- **Lead-to-Intro Rate:** leads with intro call / total leads
- **Lead-to-Session Rate:** leads with booking / total leads

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/features/leads/components/SignupWizard.tsx` | Main wizard component |
| `src/features/leads/components/screens/` | Individual step screens |
| `src/app/api/public/leads/route.ts` | Lead creation |
| `src/app/api/public/leads/confirm/route.ts` | Email verification |
| `src/app/api/public/leads/[id]/form-completed/route.ts` | Form data merge |
| `src/app/api/public/verification/send-code/route.ts` | SMS send |
| `src/app/api/public/verification/verify-code/route.ts` | SMS verify |
| `src/features/leads/lib/match.ts` | Instant matching logic |
| `src/features/leads/lib/processDraftContact.ts` | Directory flow contact |
| `src/contracts/leads.ts` | Lead submission schema |

---

## Common Issues

### "Lead not visible in admin"
- Check `status` -- may still be `pending_verification` or `email_confirmation_sent`
- Check `is_test` flag in metadata

### "Matches not created after verification"
- Verify `createInstantMatchesForPatient` was called (check `instant_match_created` events)
- Check if draft contact exists (directory flow skips instant matching)
- Check therapist availability for the patient's filters

### "Email confirmation link expired"
- Token TTL is 24h from `confirm_sent_at`
- User can resend from Step 7 or use SMS fallback

### "Phone verification not working"
- Check Twilio service status
- Validate German mobile format (must start with +49)
- Check rate limiting (3 codes per phone per hour)

### "Campaign attribution missing"
- Check form_sessions table for `_attr` data
- Verify `X-Campaign-*` headers are being sent on lead creation
- Form completion backfill may not have run -- check `form_completed` event
