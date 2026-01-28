# Therapist Registration Flow

Complete documentation of the therapist onboarding journey from signup to directory visibility.

## Overview

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  1. REGISTRATION    │ ──► │  2. PROFILE +       │ ──► │  3. ADMIN           │ ──► │  4. PORTAL          │
│     FORM            │     │     DOCUMENTS       │     │     VERIFICATION    │     │     ONBOARDING      │
│                     │     │                     │     │                     │     │                     │
│  /therapists/       │     │  /therapists/       │     │  Admin Dashboard    │     │  /portal            │
│  register           │     │  complete-profile/  │     │                     │     │                     │
│                     │     │  upload-documents/  │     │                     │     │                     │
│  Status: -          │     │  Status:            │     │  Status: verified   │     │  Status: verified   │
│                     │     │  pending_verification│    │                     │     │  accepting_new:     │
│                     │     │  or rejected        │     │                     │     │  true/false         │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘     └─────────────────────┘

UI Progress Indicator (OnboardingProgress component):
Step 0: Registrierung → Step 1: Profil → Step 2: Dokumente → Step 3: Fertig
```

---

## Phase 1: Registration Form

**URL:** `/therapists/register`
**Component:** `RegistrationForm.tsx` (in `/app/therapists/register/`)
**Landing page:** `/fuer-therapeuten` (links to registration)
**Status after:** `pending_verification`

### Fields Collected

| Field | Required | Type | Stored In |
|-------|----------|------|-----------|
| Name (Vor- und Nachname) | No | Text | `therapists.first_name`, `therapists.last_name` |
| E-Mail | **Yes** | Email | `therapists.email` |
| Telefonnummer | No | Phone | `therapists.phone` |
| Geschlecht | **Yes** | Select: female/male/non-binary | `therapists.gender` |
| Qualifikation | **Yes** | Select: Heilpraktiker/Approbiert | (stored in form, used for validation) |
| Schwerpunkte | **Yes** (≥1) | Checkboxes: NARM, Hakomi, SE, Core Energetics | `therapists.modalities` |
| AGB/Datenschutz Consent | **Yes** | Checkbox | Contract signed automatically |

### What Happens on Submit

1. **Therapist record created** in `therapists` table with `status: 'pending_verification'`
2. **Contract signed** automatically (stored in `therapist_contracts` table)
3. **Welcome email sent** with link to complete profile
4. **Internal notification** sent to admin

### Key Notes

- No email confirmation required (unlike patient flow)
- City, session preferences, approach text are NOT collected here anymore
- These are collected in Phase 2 (profile completion) or Phase 4 (portal)
- **localStorage persistence:** Form data is auto-saved to `kh_therapist_registration_draft` key, restored on page revisit
- Landing page `/fuer-therapeuten` links to `/therapists/register` for the actual form

---

## Phase 2: Profile Completion + Document Upload

**URLs:**
- `/therapists/complete-profile/[id]` (Step 1)
- `/therapists/upload-documents/[id]` (Step 2)
- `/therapists/onboarding-complete/[id]` (Confirmation)

**Access:** Only for `pending_verification` or `rejected` status  
**Status after:** Still `pending_verification` (waiting for admin)

### Step 1: Profile Completion

**URL:** `/therapists/complete-profile/[id]`

| Field | Required | Condition | Stored In |
|-------|----------|-----------|-----------|
| Geschlecht | If missing | Only shown if not already set | `therapists.gender` |
| Stadt | If missing | Only shown if not already set | `therapists.city` |
| Akzeptiert neue Klienten | If null | Only shown if not already set | `therapists.accepting_new` |
| Rechnungsadresse (Straße) | **Yes** | Only shown if not already set | `metadata.profile.billing_street` |
| Rechnungsadresse (PLZ) | **Yes** | Only shown if not already set | `metadata.profile.billing_postal_code` |
| Rechnungsadresse (Stadt) | **Yes** | Only shown if not already set | `metadata.profile.billing_city` |
| Profilfoto | **Yes** | Only shown if no photo exists | `metadata.profile.photo_pending_path` |

**Notes:**
- `approach_text` is NOT collected during onboarding - therapists fill this in the portal after verification.
- Billing address (Rechnungsadresse) is required during onboarding for invoicing. It is not publicly displayed. All three fields must be filled.

### Step 2: Document Upload

**URL:** `/therapists/upload-documents/[id]`

| Document | Required | Format | Stored In |
|----------|----------|--------|-----------|
| Staatliche Zulassung (Heilpraktiker-Erlaubnis) | **Yes** | PDF, JPG, PNG (max 4MB) | Supabase Storage → `metadata.documents.license` |
| Spezialisierungs-Zertifikat (NARM, Hakomi, SE, Core Energetics) | **Yes** (≥1) | PDF, JPG, PNG (max 4MB) | Supabase Storage → `metadata.documents.specialization` |

### Step 3: Confirmation

**URL:** `/therapists/onboarding-complete/[id]`

Shows confirmation message:
- "Prüfung durch unser Team" (2 Werktage)
- "Bestätigung per E-Mail"
- "Klienten-Anfragen empfangen"

### Automated Reminders

If therapist doesn't complete profile/upload documents:
- **Day 3:** First reminder email
- **Day 10:** Second reminder email
- **Day 21:** Final reminder email

Reminders stop after 3 emails or after documents are uploaded.

---

## Phase 3: Admin Verification

**URL:** `/admin/therapists`  
**Access:** Admin only

### Admin Actions

| Action | Resulting Status | Email Sent |
|--------|------------------|------------|
| Approve | `verified` | Approval email with Cal.com credentials + portal link |
| Rückfrage (Request changes) | `rejected` | Rejection email with checklist of what's missing |
| Decline | `declined` | Decline email (terminal, not accepted into network) |

### What Admin Reviews

- Qualification documents (Heilpraktiker-Erlaubnis)
- Specialization certificates
- Profile photo
- Basic profile data

### On Approval

1. Status changed to `verified`
2. Cal.com account provisioned (username + temporary password)
3. Magic link generated for portal access
4. Approval email sent with:
   - Cal.com credentials
   - Portal magic link
   - Onboarding checklist overview

---

## Phase 4: Portal Onboarding (Post-Approval)

**URL:** `/portal`  
**Access:** Verified therapists only (via magic link or login)  
**Login:** `/portal/login` → Magic link sent to email

### Portal Checklist

Therapists must complete these to become visible in the directory:

| Task | Where | Required for Visibility |
|------|-------|------------------------|
| Change Cal.com password | Cal.com | No (security recommendation) |
| Complete profile text | Portal | **Yes** (gated) |
| Set up Cal.com availability | Cal.com | **Yes** (automatic - booking buttons only appear when slots exist) |
| Enable "Accepting new clients" | Portal | **Yes** (toggle) |

**Note:** Cal.com booking availability is automatic. New accounts are created with 0 availability.
Once the therapist sets up their availability in Cal.com, booking buttons appear automatically
on their profile (no manual activation needed).

### Profile Fields (Portal)

| Field | Required | Editable | Notes |
|-------|----------|----------|-------|
| **Wer kommt zu mir?** | Yes* | ✅ | Who your typical clients are |
| **Worauf ich in Sitzungen Wert lege** | Yes* | ✅ | Your session approach |
| **Was erwartet Klient:innen in der ersten Sitzung?** | Yes* | ✅ | First session expectations |
| **Über mich** | No | ✅ | Personal background |
| Stadt | Yes | ✅ | Practice city |
| Praxisadresse | No | ✅ | Street, postal code, city |
| Stundensatz | No | ✅ | Typical hourly rate |
| Sitzungsart | Yes | ✅ | Online / In-Person / Both |
| Schwerpunkte | Yes | ✅ | Min 3, Max 8 focus areas |
| Sprachen | No | ✅ | Languages spoken |
| Profilfoto | Yes | ✅ | Upload new photo |

*Required for profile completeness check

### Visibility Gating

The "Neue Klient:innen annehmen" toggle is **locked** until profile is complete:
- All required profile text fields filled
- Cal.com availability configured
- At least 3 Schwerpunkte selected

Once complete, therapist can enable the toggle to become visible in the directory.

### Profile Visibility Warning

When profile is complete but `accepting_new` is OFF, the portal shows:
- **Top banner (red)**: "Dein Profil ist nicht sichtbar" with "Profil jetzt aktivieren" button
- **Availability section**: Red border + "Nicht sichtbar" badge to make the disabled state obvious

This prevents therapists from completing their profile but forgetting to enable visibility.

### Post-Approval Reminders

Verified therapists who haven't completed their profile receive automated reminders:
- **Timing:** Starts 3 days after verification
- **Frequency:** Every 7 days
- **Cap:** Max 3 reminders
- **Checks:** Profile text fields (≥50 chars each) + photo
- **Opt-out:** Therapists can opt out via link in email

---

## Email Journey Summary

| Trigger | Email Template | When Sent |
|---------|---------------|-----------|
| Signup | `therapistWelcome` | Immediately after registration |
| Day 3 without docs | `therapistDocumentReminder` (day3) | 3 days after signup |
| Day 10 without docs | `therapistDocumentReminder` (day10) | 10 days after signup |
| Day 21 without docs | `therapistDocumentReminder` (day21) | 21 days after signup |
| Admin: Rückfrage | `therapistRejection` | When admin requests changes |
| Admin: Approve | `therapistApproval` | When admin approves |
| Admin: Decline | `therapistDecline` | When admin declines |
| Portal login | `therapistMagicLink` | When therapist requests login |
| Post-approval (profile incomplete) | `therapistReminder` | 3+ days after approval, every 7 days, max 3 |

---

## Status Transitions

```
                              ┌──────────────────┐
                              │  (not created)   │
                              └────────┬─────────┘
                                       │ Submit form
                                       ▼
                              ┌──────────────────┐
                              │ pending_         │◄──────────┐
                              │ verification     │           │
                              └────────┬─────────┘           │
                                       │                     │
              ┌────────────────────────┼──────────────────┐  │
              │                        │                  │  │
              ▼                        ▼                  ▼  │ Resubmit
     ┌────────────────┐       ┌────────────────┐   ┌─────────┴──────┐
     │   verified     │       │   declined     │   │    rejected    │
     │                │       │   (terminal)   │   │   (Rückfrage)  │
     └────────────────┘       └────────────────┘   └────────────────┘
              │
              │ Toggle in portal
              ▼
     ┌────────────────┐
     │ accepting_new  │ ──► Visible in directory
     │ = true         │
     └────────────────┘
```

---

## Database Fields Reference

### `therapists` Table

| Field | Set At | Editable By |
|-------|--------|-------------|
| `first_name` | Registration | Admin, Portal |
| `last_name` | Registration | Admin, Portal |
| `email` | Registration | Admin only |
| `phone` | Registration | Admin only |
| `gender` | Registration or Step 1 | Admin, Portal |
| `city` | Step 1 or Portal | Admin, Portal |
| `modalities` | Registration | Admin, Portal |
| `schwerpunkte` | Portal | Portal |
| `session_preferences` | Portal | Portal |
| `typical_rate` | Portal | Portal |
| `photo_url` | Admin publishes | Admin (publishes pending photo) |
| `accepting_new` | Portal | Portal (gated on completeness) |
| `status` | Registration → Admin | Admin only |
| `cal_username` | Admin approval | System |
| `cal_enabled` | Admin approval | System (true when Cal.com account exists) |
| `metadata.profile.billing_*` | Step 1 | Admin only (set during onboarding) |
| `metadata.profile.*` | Step 1, Portal | Portal |
| `metadata.documents.*` | Step 2 | System (uploads) |

---

## Common Issues

### "Therapist not visible in admin"
- Check `accepting_new` filter - admin now shows ALL therapists regardless of this flag
- Check `status` filter in admin UI

### "Therapist can't enable accepting_new"
- Profile is incomplete - check required fields in portal
- Cal.com availability not configured

### "Therapist completed profile but isn't visible"
- `accepting_new` is still OFF - therapist may have missed the toggle
- Portal now shows prominent red warning banner when this happens
- Admin can check this status in the admin preview

### "Therapist didn't receive welcome email"
- Check spam folder
- Verify email address is correct
- Check events table for `email_sent` with `stage: 'therapist_welcome'`

### "Therapist didn't complete profile after signup"
- Document reminders sent at day 1, 3, 7
- After 3 reminders, system stops
- Admin can manually follow up
