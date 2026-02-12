---
name: qa-guide
description: Use when updating QA test cases, adding test coverage for new features, or modifying the QA testing guide. This skill defines how test cases are written for our external QA tester — lean JTBD checklists, not corporate test scripts.
---

# QA Guide Writing Style

Our QA guide (`docs/operations/qa-testing-guide.md`) is written for one freelance tester. Every line must earn its place.

## Who Reads This

**Marta Sąpor** — freelance QA tester (Upwork), experienced, works in English, tests on staging with `kh_test=1`. Reports in professional PDF format: Bug #, URL, Steps to Reproduce, Expected, Actual, Screenshots, Environment, Severity.

### How she works (calibrated from real reports)

1. **She follows instructions literally.** If the guide says "verify X," she will attempt to verify X. If X is ambiguous, she'll flag it. If X is impossible, she'll waste time trying before reporting it. Every word in the guide costs her time.

2. **She uses step-by-step reproduction paths from the guide in her bug reports.** If the guide has a 17-step script, her bug report reproduces all 17 steps verbatim. Shorter checklists = shorter bug reports = faster turnaround.

3. **She asks good clarifying questions.** She'll push back on vague verification steps ("how do I tell licensed from certified?"), impossible steps ("can't leave city empty — it auto-fills"), and stale expectations.

4. **She doesn't know the codebase.** She can only verify what's visible in the UI. Don't write "verify matches include both tiers" without explaining the visible indicator (badge color, label text).

## Core Principle: Jobs, Not Procedures

Structure around **what the user is trying to accomplish**, not test case IDs.

```
Good:  "## Job 1: Sign Up → Get Matched"
Bad:   "## TC-I.1.14: Email Code Verification — Progressive variant"
```

Describe the job once, list what to check.

## Format Rules

### 1. Checklists, not numbered scripts

```markdown
### Checklist
- [ ] SMS path: phone → `000000` → name → booking confirmed
- [ ] Email path: toggle to email → 6-digit code → name → booking confirmed
- [ ] Already-verified user: verification steps skipped entirely
```

NOT:
```
Steps:
  1. Navigate to /start
  2. Click "Therapeut:in finden"
  3. Select 2+ focus areas
  4. Click "Weiter"
  ...14 more steps
```

### 2. Variants go in a comparison table, not separate test cases

```markdown
| | Classic (`?variant=classic`) | Progressive (`?variant=progressive`) |
|---|---|---|
| After preferences | Full contact form | Anonymous submit → match preview → phone only |
```

Then: "test each variant × each verification method = 4 combinations"

### 3. Edge cases go in a compact table

```markdown
| Try this | Expect |
|---|---|
| Wrong SMS/email code | Error message |
| Expired code (>10 min) | "Code expired", must resend |
```

### 4. "What Changed" section at the top

Every QA update MUST update this section. This is what the tester reads first.

```markdown
## What Changed (Latest)

**Feb 12, 2026:**
- Email verification now uses **6-digit code entry** instead of magic-link-only.
- Match preview redesign: therapist photos + Schwerpunkt overlap labels.
```

### 5. Don't repeat the common flow

The questionnaire steps (Schwerpunkte → Payment → Modality → Location → Gender) are the same for every test. Mention them once. Don't re-describe them in every job.

### 6. Bold the differentiator

When a checklist item exists only for one variant or one verification method, bold the distinguishing part:

```markdown
**Progressive-only steps:**
- [ ] Step 5.75: match preview shows therapist photos + Schwerpunkt labels

**Classic-only steps:**
- [ ] Step 6: full contact form with name, email/phone toggle, consent
```

### 7. Make verifications UI-observable

Every "verify X" must describe something the tester can **see in the browser**. If it requires backend knowledge, either explain the visible indicator or remove the check.

```
Bad:   "Verify matches include both licensed AND certified therapists"
Good:  "Verify matches include therapists with green ShieldCheck badge (licensed) AND gray Award badge (certified)"

Bad:   "Verify campaign_variant is stored correctly"
Good:  (Remove — not UI-testable. This is a backend concern.)

Bad:   "Leave city empty → verify validation"
Good:  (Remove — city auto-fills to Berlin, can't be left empty.)
```

### 8. Don't write untestable steps

Before adding a checklist item, ask: **can Marta actually do this on staging?** Common traps:
- Auto-filled fields that can't be emptied
- Backend state that has no UI indicator
- Verification codes on staging route to a sink (she can't receive real emails/SMS)
- Rate limits that require 3+ attempts in 24h (tedious to test manually)

If a step requires workarounds (e.g., "ask project owner to forward the sink email"), say so explicitly.

## Anti-Patterns (Never Do These)

| Don't | Why |
|---|---|
| Corporate test case IDs (TC-I.1.14, NEG-16) | One-person QA op, not an enterprise test org |
| Separate test cases per variant for the same flow | Use comparison table + "test all combinations" |
| Step-by-step for obvious UI interactions | "Select Schwerpunkte" is enough |
| Repeating the full questionnaire flow | Reference it once, then say "complete questionnaire" |
| Vague verification steps | She'll waste time or flag it as unclear |
| Steps that require backend access | She can only see the browser |
| More than 300 lines total | If it's longer, you're over-documenting |

## When Updating

1. **Read the current guide first** — `docs/operations/qa-testing-guide.md`
2. **Add to existing job section** if the feature fits an existing job (signup, booking, contact, registration, directory)
3. **Create a new job section** only if it's a genuinely new user job
4. **Update "What Changed"** at the top with today's date and bullet points
5. **After editing**, re-upload to Google Drive:
   ```bash
   cd /tmp && pandoc docs/operations/qa-testing-guide.md -o "YYYYMMDD QA Testing Guide.docx" && \
   rclone copy "YYYYMMDD QA Testing Guide.docx" "GDrive - KEARTH:QA/" --drive-import-formats docx
   ```
