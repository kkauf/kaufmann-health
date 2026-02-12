# QA Testing Guide

## What Changed (Latest)

**Feb 12, 2026:**
- Email verification now uses **6-digit code entry** (same UX as SMS) instead of magic-link-only. The email still includes a magic link button as fallback.
- Match preview redesign: shows **therapist photos + Schwerpunkt overlap labels** instead of modality badges + city.
- 3 bugs from Thursday's test report fixed on staging.

---

## Setup

| Environment | URL |
|---|---|
| Staging | `staging.kaufmann-health.de` |
| Feature preview | Vercel preview URL (shared per feature) |
| Production | `www.kaufmann-health.de` — **never test here** |

**Enable test mode** — visit any URL with `?tt=1` once. Sets `kh_test=1` cookie (filters your data from analytics, routes emails to sink).

**SMS bypass** — use code `000000` in any SMS verification step (staging only).

**Test therapist accounts** — any therapist registered on staging is auto-flagged `is_test: true` (won't appear in prod directory/matches).

---

## Flow Variants

The questionnaire has two A/B test variants. Test both:

| | Classic (`?variant=classic`) | Progressive (`?variant=progressive`) |
|---|---|---|
| After preferences | Full contact form (name + email/phone) | Anonymous submit → match preview → phone only |
| Email/phone | Toggle on same form | Toggle on phone-only screen |
| Match preview | None | Step 5.75: therapist photos + Schwerpunkt labels |
| Name collection | Part of contact form | Separate step after verification |

---

## Job 1: Sign Up → Get Matched

**The happy path:** Fill questionnaire → verify identity → see matched therapists.

### Checklist (test each variant × each verification method = 4 combinations)

**Questionnaire (both variants):**
- [ ] Select Schwerpunkte → live therapist count updates
- [ ] Payment step, modality, location, gender preferences all work
- [ ] Step 5.5 (credential opt-in): checkbox appears, default unchecked
- [ ] Back navigation preserves data at every step
- [ ] Progress bar advances smoothly, never jumps

**Progressive-only steps:**
- [ ] Step 5.75: match preview shows therapist photos + Schwerpunkt overlap labels
- [ ] Match preview does NOT show modality badges or city names
- [ ] Zero-match scenario shows encouraging message, doesn't block flow
- [ ] Step 6.75: name (required) + email (optional) + consent checkbox

**Classic-only steps:**
- [ ] Step 6: full contact form with name, email/phone toggle, consent

**SMS verification (both variants):**
- [ ] Enter phone → code screen → `000000` → verified → proceeds

**Email verification (both variants):**
- [ ] Toggle "Lieber per E-Mail?" → enter email → code screen with 6 input boxes
- [ ] Email contains both 6-digit code AND "E-Mail bestätigen" magic link button
- [ ] Enter code → auto-submits after 6th digit → proceeds
- [ ] Magic link in email also works as fallback

**After verification:**
- [ ] Redirects to `/matches/{uuid}` with therapist recommendations
- [ ] At least 3 therapists shown (even with unusual preferences)
- [ ] Cards show: photo, name, modalities, location, availability

### Edge cases
| Try this | Expect |
|---|---|
| Wrong SMS/email code | Error message |
| Expired code (>10 min) | "Code expired", must resend |
| Resend 3+ times | Rate limit message |
| Partial email code (<6 digits) | No auto-submit |
| Empty name at name step | Validation error |
| Invalid email/phone format | Validation error |
| Invalid matches UUID | 404 or error page |

---

## Job 2: Book a Therapist

**Use the designated test therapist only** — real therapists get actual Cal.com calendar invites.

**The happy path:** Find therapist in directory → select slot → verify → booking confirmed.

### Checklist

- [ ] Find test therapist in `/therapeuten`
- [ ] Click booking → select available intro slot (15 min, free)
- [ ] SMS path: phone → `000000` → name → booking confirmed
- [ ] Email path: toggle to email → 6-digit code → name → booking confirmed
- [ ] Already-verified user: verification steps skipped entirely
- [ ] Confirmation emails in sink: patient gets date/time/link, therapist gets notification
- [ ] No available slots → graceful "no slots" message

---

## Job 3: Contact a Therapist

**The happy path:** Click contact → compose message → verify → message sent.

### Checklist

- [ ] Contact button on matches page or directory → modal opens
- [ ] Pre-composed message shown, editable
- [ ] SMS path: phone → `000000` → name → message sent
- [ ] Email path: toggle → 6-digit code or magic link → name → message sent
- [ ] Already-verified user: skips straight to compose → send
- [ ] Therapist receives email with patient message (check sink)

---

## Job 4: Register as a Therapist

**The happy path:** Register → complete profile → upload documents → done.

### Checklist (test both credential tiers)

**Licensed tier** (HP, Approbierte, Heilpraktiker):
- [ ] `/fuer-therapeuten` → "Jetzt registrieren" → registration form
- [ ] Required: first name, last name, email, city, Qualifikation
- [ ] Profile step: photo (required) + approach text (required)
- [ ] Documents step: "Staatliche Zulassung erforderlich" — license upload required
- [ ] Completion page + welcome email

**Certified tier** (Psychologische:r Berater:in):
- [ ] Same flow, but documents step shows "Spezialisierungs-Zertifikat" heading
- [ ] No license upload — only specialization certificate
- [ ] Legal disclaimer shown on their public profile

**Portal:**
- [ ] `/portal/login` → magic link email → authenticated session
- [ ] Profile editing: city, approach text, modalities, accepting_new all persist
- [ ] No password login exists (magic link only)

---

## Job 5: Browse the Directory

### Checklist

- [ ] `/therapeuten` loads with therapist cards (photo, name, modalities, city, availability)
- [ ] "Mehr anzeigen" pagination works
- [ ] Filter by modality (NARM, Hakomi, SE, CE, Alle) works
- [ ] Filter by format (Online, Vor Ort, Alle) works
- [ ] Default view: licensed therapists only (emerald ShieldCheck badge)
- [ ] `/therapeuten?tier=all`: both licensed + certified shown
- [ ] Certified therapists: slate Award badge + legal disclaimer in profile
- [ ] Responsive: mobile (375px), tablet (768px), desktop (1440px)

---

## Static Pages (Quick Smoke Test)

Just verify these load and CTAs work:

- [ ] `/` (homepage) — CTAs link to questionnaire/directory
- [ ] `/therapie` + `/therapie/narm`, `/hakomi`, `/somatic-experiencing`, `/core-energetics`
- [ ] `/fuer-therapeuten` — register + login buttons, FAQ dropdowns
- [ ] `/ueber-uns`, `/beratung`
- [ ] `/agb`, `/datenschutz`, `/impressum`

---

## Quick Reference

| Task | How |
|---|---|
| Enable test mode | `?tt=1` on any URL |
| Bypass SMS | Code `000000` |
| Force classic variant | `?variant=classic` |
| Force progressive variant | `?variant=progressive` |
| Preview emails | `{base}/api/admin/emails/preview?template=email_confirmation&token=CRON_SECRET` |
| Find test accounts in admin | "Nur Test-Accounts" toggle |

## Reporting Issues

Include: URL, steps to reproduce, expected vs actual, screenshot/console errors if any.
