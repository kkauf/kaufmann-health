# Therapist Self-Service Portal

The therapist portal allows verified therapists to manage their profile, availability, and settings without admin intervention.

## Access & Authentication

### URL
`/portal` — Main portal entry point

### Authentication Flow
1. **Magic Link Request**: Therapist clicks link in email or requests at `/portal/login`
2. **Email Sent**: `therapistMagicLink` template with signed token URL
3. **Token Verification**: `/portal/auth?token=...` verifies and sets session cookie
4. **Session Cookie**: `kh_therapist` (JWT, 30 days, HTTP-only)

### Session Cookie (`kh_therapist`)
- **Type**: Functional/service-delivery (not tracking)
- **Expiry**: 30 days
- **Security**: HTTP-only, Secure in production, SameSite=Lax
- **Payload**: `{ therapist_id, email, name?, iat, exp }`

### Key Files
- `src/lib/auth/therapistSession.ts` — Session management utilities
- `src/app/portal/auth/route.ts` — Token verification endpoint
- `src/app/portal/login/page.tsx` — Magic link request form

---

## Portal Features

### 1. Profile Editing (`EditProfileForm.tsx`)
Therapists can edit:

| Field | Type | Validation |
|-------|------|------------|
| `who_comes_to_me` | Text (50+ chars) | Profile completeness |
| `session_focus` | Text (50+ chars) | Profile completeness |
| `first_session` | Text (50+ chars) | Profile completeness |
| `about_me` | Text | Optional |
| `modalities` | Multi-select | NARM, Hakomi, SE, Core Energetics |
| `schwerpunkte` | Multi-select | Focus areas |
| `session_preferences` | Checkbox | Online / In-Person |
| `typical_rate` | Number | €/hour |
| `practice_address` | Structured | Street, PLZ, City |
| `languages` | Multi-select | Deutsch, English, etc. |

### 2. Availability Toggle
- **`accepting_new`**: Toggle to show/hide from directory
- **Gated**: Only enabled when profile is complete (photo + 3 text fields ≥50 chars + schwerpunkte + rate)

### 3. Calendar Management (`CalendarManagement.tsx`)
For Cal.com-enabled therapists:

#### Client Booking ("Klient:in einbuchen")
Therapist-initiated booking feature to solve the problem of therapists scheduling ad-hoc instead of through Cal.com:
- **Client Selector**: Dropdown showing recent clients (from `cal_bookings`) with name, email, last session date, session count
- **Manual Entry**: Option to enter new client email/name
- **Booking Flow**: Opens Cal.com `/full-session` with prefilled client data and `kh_source=therapist_portal` tracking
- **API**: Fetches clients via `GET /api/portal/clients`

#### Availability Management
- Link to Cal.com dashboard for availability settings
- Documentation links (beginner guide, advanced guide, video tutorial)
- FAQ section about Cal.com settings

### 4. Native Slots Manager (`SlotsManager.tsx`)
For non-Cal.com therapists (legacy):
- Add/edit recurring weekly slots
- Set format (online/in-person) and address

---

## API Endpoints

### Portal-Specific

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/portal/auth` | GET | Verify magic link token, set session cookie |
| `/api/portal/clients` | GET | List recent clients for therapist (from `cal_bookings`) |
| `/api/public/therapist-portal/profile` | PATCH | Update profile fields |
| `/api/public/therapist-portal/photo` | POST | Upload profile photo |
| `/api/public/therapist-portal/slots` | GET/POST/DELETE | Manage availability slots |

### Authentication
Portal endpoints verify `kh_therapist` cookie via `getTherapistSession(request)`.

---

## Profile Completeness Rules

A profile is **complete** when:
1. ✅ Photo uploaded (`photo_url` set)
2. ✅ Three profile text fields ≥ 50 characters each
3. ✅ At least one schwerpunkt selected
4. ✅ Typical rate set

**Impact**: `accepting_new` toggle is disabled until profile is complete.

---

## Migration Notes

### Legacy `approach_text` → New Structured Fields
- Old profiles have single `approach_text` field
- New profiles use structured fields: `who_comes_to_me`, `session_focus`, `first_session`, `about_me`
- Portal shows legacy text read-only if new fields are empty
- Saving new fields migrates away from legacy

### Legacy Address → Structured Address
- Old: Single `practice_address` string
- New: `practice_street`, `practice_postal_code`, `practice_city`
- Portal auto-parses legacy format on load

### Billing Address (Rechnungsadresse)
- Collected during onboarding Step 1 (not editable in the portal)
- Stored in `metadata.profile.billing_street`, `billing_postal_code`, `billing_city`
- Used for invoicing; not publicly displayed
- To update billing address, therapists must contact support

---

## Security Considerations

1. **Verified Therapists Only**: Portal requires `status='verified'` in therapists table
2. **No Admin Access**: Therapists cannot access other therapists' data
3. **Cookie Scope**: `kh_therapist` is path `/` to allow API access
4. **CSRF**: SameSite=Lax provides basic CSRF protection
5. **Photo Upload**: Validates MIME type and size before upload

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid/expired token | Redirect to `/portal/login` |
| No session cookie | Redirect to `/portal/login` |
| Therapist not verified | Redirect to `/portal/login` |
| Session expired | Auto-redirect on next page load |

---

## Related Documentation

- [Email Templates](./emails.md) — `therapistMagicLink` template
- [Architecture](./architecture.md) — Session management patterns
- [Security](./security.md) — Cookie policies
