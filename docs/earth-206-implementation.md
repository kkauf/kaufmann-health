# EARTH-206: Match Page – Email/SMS Link → 3 Recommendations

## Overview

Implemented a rich match page at `/matches/[uuid]` that displays up to 3 handpicked therapist recommendations with quality indicators, detailed profiles, and pre-authenticated contact. Email/SMS templates now send a link to this page instead of embedding therapist profiles directly.

## Implementation Summary

### 1. Enhanced Match Page UI (`/matches/[uuid]`)

**Quality Indicators:**
- Automatic match quality computation using existing mismatch logic from admin matching
- "⭐ Perfekte Übereinstimmung" badge for perfect matches (no gender/location/modality mismatches)
- "Top-Empfehlung" badge for best match in the set
- Per-card "Warum diese Empfehlung?" explanation box for top matches

**Rich Therapist Cards:**
- Reuses directory card design (modalities, session preferences, approach text preview)
- Shows online/in-person indicators
- "Bereits kontaktiert" status when patient previously contacted
- Three action buttons: "Profil ansehen", "Therapeut:in buchen", "Kostenloses Erstgespräch"

**Trust & Quality Section:**
- Prominent "Warum diese Auswahl?" box explaining curation process
- Based on email template language (personal review, preference-based, qualifications, modalities explained)
- Builds confidence before showing therapists

**Footer:**
- "Keine passende Person dabei?" fallback linking to full directory

### 2. Enhanced API Response (`GET /api/public/matches/:uuid`)

**Enriched Patient Data:**
- Added: `city`, `session_preferences`, `specializations`, `gender_preference`
- Enables client-side match quality computation

**Enriched Therapist Data:**
- Added: `modalities`, `session_preferences`, `approach_text`, `gender`
- Enables rich card display and quality scoring

**No Breaking Changes:**
- Backward compatible with existing fields
- Optional fields default to empty arrays/undefined

### 3. Updated Email Template (`patientSelection.ts`)

**Match Link Priority:**
- When `matchesUrl` provided, shows prominent CTA instead of embedded cards
- Green gradient box with mobile-friendly messaging
- Embedded cards hidden to reduce email size and rendering issues

**Gentler Urgency:**
- Changed from "⏰ Bitte wähle innerhalb von 48 Stunden" to "💡 Tipp: ... Wir empfehlen, sich zeitnah zu melden"
- No hard deadline pressure, just helpful nudge

**Backward Compatibility:**
- Still supports embedded cards when `matchesUrl` not provided
- Existing admin selection flow unchanged

### 4. Integrated Therapist Detail Modal

**Reused from Directory:**
- Opens same `TherapistDetailModal` as directory page
- Shows full approach text, all modalities, languages, experience
- Consistent UX across directory and match pages

**Modal Launch:**
- "Profil ansehen" button on each card
- Overlays match page context (user doesn't leave)

### 5. Pre-Authenticated Contact Flow

**Already Implemented (EARTH-204):**
- `ContactModal` accepts `preAuth` prop with `uuid`, `patientName`, `defaultReason`
- Skips verification step, jumps directly to compose
- Pre-fills message with patient's issue from match context
- Rate limited to 3 contacts/day per patient

**Match Page Integration:**
- Passes `uuid` from URL to enable pre-auth
- Prefills patient name and issue for personalized experience

### 6. Analytics Tracking

**Client-Side:**
- `match_page_view` - page load with therapist count

**Server-Side:**
- `match_link_view` - API call with patient/therapist IDs (already implemented)

## Files Changed

### New Files
- `tests/earth-206.matches-page.test.ts` - Comprehensive test suite (23 tests, all passing)
- `docs/earth-206-implementation.md` - This file

### Modified Files
- `src/features/matches/components/MatchPageClient.tsx` - Enhanced with rich cards, quality indicators, detail modal
- `src/app/api/public/matches/[uuid]/route.ts` - Enriched API response with patient/therapist data
- `src/lib/email/templates/patientSelection.ts` - Updated to prioritize match link, gentler urgency
- `docs/api.md` - Updated GET /api/public/matches/:uuid documentation

## User Journey

1. **Receive Email/SMS** - "Ihre 3 persönlichen Therapeuten-Empfehlungen" with link
2. **Click Link** - Opens `/matches/[uuid]` on any device
3. **See Quality Explanation** - "Warum diese Auswahl?" builds trust
4. **Browse 3 Therapists** - Rich cards with modalities, location, preview text
5. **View Top Match Badge** - "⭐ Perfekte Übereinstimmung" or "Top-Empfehlung" 
6. **Read "Warum diese Empfehlung?"** - Explains why top match is best
7. **Take Action:**
   - View full profile (opens modal)
   - Book therapy session (pre-auth contact)
   - Request consultation (pre-auth contact)
8. **Fallback** - Link to full directory if none fit

## Technical Decisions

### Why Web Page vs Embedded Email?

**Problems Solved:**
- ❌ Broken rendering on Outlook/Gmail mobile → ✅ Consistent web experience
- ❌ Can't update after sending → ✅ Dynamic content, can refresh
- ❌ No SMS support → ✅ Short link works in SMS
- ❌ No tracking → ✅ Full analytics on views/clicks
- ❌ Large email size → ✅ Smaller email, faster delivery

### Why Auto Match Quality vs Manual Reasons?

**Product Decision (from PM):**
- Option B selected: Auto-generate based on match quality using `computeMismatches`
- Avoids admin overhead of documenting reasons manually
- Provides consistent, objective explanations
- Based on same logic admin uses for matching

### Why Reuse Directory Components?

**Engineering Efficiency:**
- `TherapistCard` → Consistent card design, modality badges
- `TherapistDetailModal` → Full profile view
- `ContactModal` → Pre-auth contact flow (EARTH-204)
- Single source of truth for therapist display

## Success Metrics

Track via existing Supabase events:
- Email → match page click-through (already tracked in admin matches/email flow)
- `match_page_view` → therapist count
- `match_link_view` → which therapists shown
- `contact_message_sent` → conversion from match page
- Time from match sent → first contact (via `created_at` timestamps)

## Testing

**Unit Tests (23 tests, all passing):**
- ✓ Match quality computation (6 tests) - perfect match, gender/location/modality mismatches
- ✓ API response structure (2 tests) - enriched patient/therapist data
- ✓ Email template behavior (2 tests) - match link CTA, gentle urgency
- ✓ Match page UI (4 tests) - top match logic, badges, explanations
- ✓ Pre-auth contact (2 tests) - uuid passing, verification skip
- ✓ Analytics tracking (2 tests) - page view, link view events
- ✓ Link expiry (2 tests) - 30-day window enforcement
- ✓ Detail modal (1 test) - therapist data passing
- ✓ Backward compatibility (2 tests) - optional fields, dual email modes

**Full Test Suite:**
- ✓ 223 tests passing (including EARTH-206)
- ✓ Production build passes
- ✓ No breaking changes to existing flows

## Deployment Checklist

- [x] Enhanced match page client component
- [x] Enriched API endpoint response
- [x] Updated email template with match link priority
- [x] Integrated therapist detail modal
- [x] Analytics tracking implemented
- [x] Tests written and passing (23 new tests)
- [x] Full test suite passing (223 tests)
- [x] Documentation updated (api.md)
- [ ] Admin flow: When creating matches, pass `matchesUrl` to email template
- [ ] Verify match link email renders correctly across clients (Outlook, Gmail, Apple Mail)
- [ ] Monitor analytics for email → page → contact conversion

## Future Enhancements (Not in Scope)

- Dynamic re-matching (update recommendations after initial send)
- A/B test match presentation variants
- Calendar integration for availability
- SMS-specific copy optimization
- "Why this match" AI-generated explanations
- Recommendation scoring algorithm refinement

## Notes

- 30-day link expiry maintained (consistent with EARTH-204)
- No cookies on match page (pre-authenticated via UUID)
- Mobile-first responsive design (90% of traffic)
- Gentle urgency messaging (not deadline pressure)
- Reuses established patterns from directory and EARTH-204
