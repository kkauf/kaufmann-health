# Email & SMS Cadence - Internal Reference

## Post-Verification Nurture Sequence (Email)

For verified patients who haven't booked:

| Day | Template | Purpose | Cron |
|-----|----------|---------|------|
| 1 | `richTherapistEmail` | Personalized spotlight: top match with photo, modalities, approach | 9am |
| 5 | `selectionNudge` | Reassurance: free intro call, chemistry shows during meeting | 9am |
| 10 | `feedbackBehavioral` / `feedbackRequest` | Behavior-aware variants (D/A/B/C) with segment-specific copy + interview CTA. Falls back to generic `feedbackRequest` if no match data. | 10:30am |

## SMS Cadence (Phone-Only Patients)

For patients who verified via SMS without email:

| Day | Message | Cron |
|-----|---------|------|
| 2 | `Deine Therapeuten-Auswahl wartet: {url}` | 10:30am |
| 5 | `Noch unsicher? Antworte "Hilfe" für Rückruf.` | 10:35am |
| 10 | `Was hält dich zurück? (Auswahl/Preis/Timing?)` | 10:40am |

## Booking Lifecycle Emails

**Phone-only users**: At booking time, a placeholder email is used. The success screen prompts for a real email address. Once provided, the booking confirmation is re-sent via `POST /api/public/patient/update-contact`.

| Event | Timing | Template |
|-------|--------|----------|
| Booking created | Immediate | `calBookingClientConfirmation` |
| Email collected (phone-only) | Post-booking | `calBookingClientConfirmation` (re-send via update-contact API) |
| 24h before | Cron | `calBookingReminder` |
| 1h before | Cron | `calBookingReminder` (+ SMS if phone) |
| Intro ends | ~2h after | `calIntroFollowup` (upsell) |
| Session ends | 3-5 days after | `calSessionFollowup` (if slots available) |
| Cancelled | 2-4h after | `cancellationRecovery` |

## Therapist Onboarding

| Trigger | Template |
|---------|----------|
| Registration | `therapistWelcome` |
| Day 3, 10, 21 without docs | `therapistDocumentReminder` |
| Verified | `therapistApproval` |
| Weekly (Fridays) | `therapistAvailabilityReminder` |

## Skip Logic

All three nurture emails skip patients who have already converted:

| Check | Day 1 | Day 5 | Day 10 |
|-------|-------|-------|--------|
| Temp email | ✓ | ✓ | ✓ |
| Outside time window | ✓ | ✓ | ✓ |
| Already sent (dedup) | ✓ | ✓ | ✓ |
| Previous email sent (prerequisite) | — | D1 required | D5 required |
| Match status = patient_selected | ✓ | ✓ | ✓ |
| Match metadata.patient_initiated | ✓ | ✓ | ✓ |
| Cal.com booking exists | ✓ | ✓ (intro only) | ✓ |
| Behavior = contacted (D10 only) | — | — | ✓ |

## Day 10 Behavioral Segments

Classification via `src/lib/email/patientBehavior.ts`, priority-ordered:

1. **contacted** → Skip (already messaged therapist)
2. **almost_booked** → Therapist card + direct booking CTA
3. **rejected** → 7 sub-variants by rejection reason (see below)
4. **visited_no_action** → Social proof + reassurance
5. **never_visited** → Mini therapist card + scarcity

### Rejection Reason Mapping

UI reasons (from `MatchRejectionModal.tsx`) are normalized to template sub-variants
via `normalizeRejectionReason()` in `feedbackBehavioral.ts`:

| UI Code | Template Sub-Variant |
|---------|---------------------|
| `method_wrong` | `method_wrong` |
| `vibe_method` | `method_wrong` |
| `too_expensive` | `too_expensive` |
| `wants_insurance` | `wants_insurance` |
| `price_insurance` | `wants_insurance` |
| `availability_issue` | `no_availability` |
| `location_mismatch` | `location_wrong` |
| `profile_not_convincing` | `not_right_fit` |
| `gender_mismatch` | `not_right_fit` |

**When adding new rejection reasons to the UI**, update both `MatchRejectionModal.tsx`
and the `normalizeRejectionReason()` mapping in `feedbackBehavioral.ts`.

## Key Files

- Templates: `src/lib/email/templates/`
- Cron routes: `src/app/api/admin/leads/`
- SMS: `src/app/api/admin/leads/sms-cadence/`
- Behavior classification: `src/lib/email/patientBehavior.ts`
- Rejection modal: `src/features/matches/components/MatchRejectionModal.tsx`
