# Therapist Matching & Ranking Algorithm

> **Status:** Approved  
> **Last Updated:** 2026-01-06  
> **Owner:** Konstantin Kaufmann  
> **Location:** `/docs/algorithms/matching.md`

---

## Overview

This document defines the complete logic for therapist visibility, ranking, and commission eligibility on Kaufmann Health. These are three distinct systems with different purposes:

| System | Purpose | Affects |
|--------|---------|---------|
| **Eligibility** | Can this therapist be shown? | Binary inclusion/exclusion |
| **Ranking** | Who appears higher in results? | Sort order in directory and matches |
| **Commission** | What does the therapist pay? | Business terms only (not UX) |

**Design Principle:** Commission does not affect ranking. These systems are intentionally decoupled to avoid perverse incentives and maintain clarity about what we're optimizing for.

---

## System 1: Eligibility (Hard Filters)

Therapists must pass ALL hard filters to appear in any results. These are true dealbreakers with no exceptions.

### Universal Filters (Always Applied)

| ID | Filter | Condition | Rationale |
|----|--------|-----------|-----------|
| E1 | Verified | `therapists.status = 'verified'` | Quality gate |
| E2 | Accepting Clients | `therapists.accepting_new != false` | Respect availability |
| E3 | Not Hidden | `metadata.hide_from_directory != true` | Respect opt-out |

### Conditional Filters (Applied Only When Patient Specifies)

| ID | Filter | Condition | When Applied |
|----|--------|-----------|--------------|
| E4 | Gender Match | `therapist.gender = patient.gender_preference` | Patient specified male/female |
| E5 | Format Compatible | Therapist offers required format | Patient selected ONLY online or ONLY in-person |

### Filter Logic

```typescript
function isEligible(therapist: Therapist, patient?: PatientPreferences): boolean {
  // Universal filters (always apply)
  if (therapist.status !== 'verified') return false;
  if (therapist.accepting_new === false) return false;
  if (therapist.metadata?.hide_from_directory === true) return false;
  
  // Conditional filters (only when patient context exists)
  if (patient) {
    // Gender: only filter if patient specified preference
    if (patient.gender_preference && patient.gender_preference !== 'any') {
      if (therapist.gender !== patient.gender_preference) return false;
    }
    
    // Format: only filter if patient wants EXCLUSIVELY one format
    if (patient.session_preferences?.length === 1) {
      const required = patient.session_preferences[0];
      if (!therapist.session_preferences?.includes(required)) return false;
    }
  }
  
  return true;
}
```

### What Is NOT a Hard Filter

The following affect ranking but do not exclude therapists:

- Schwerpunkte overlap (soft filter)
- Modality overlap (soft filter)
- City match (soft filter)
- Profile completeness (soft filter)
- Cal.com integration (soft filter)
- Intake slot availability (soft filter)

**Rationale:** With limited supply (currently 9 therapists), aggressive hard filtering produces empty results, killing conversion. Better to show all eligible therapists ranked by relevance.

---

## System 2: Ranking

Ranking determines sort order in two contexts:

1. **Directory View** — No patient context, pure platform quality signal
2. **Match View** — Patient context, relevance + platform quality

### Scoring Components

#### Platform Score (0-100 points)

Measures therapist investment in the platform. Used for directory ranking and as tiebreaker in matches.

| Points | Criterion | Data Source |
|--------|-----------|-------------|
| +30 | Full Cal.com journey (intake + session booking enabled) | `metadata.cal_username` + both event types configured |
| +25 | Has 3+ intake slots in next 7 days | `therapist_slots` query |
| +15 | Has 1-2 intake slots in next 7 days | `therapist_slots` query |
| +10 | Has any intake slots in next 14 days (fallback) | `therapist_slots` query |
| +15 | Profile complete (photo + approach_text + who_comes_to_me) | `therapists` columns |
| +5 | Basic profile (photo + location) | `therapists` columns |

**Maximum Platform Score:** 100 points (full Cal.com + 3+ slots + complete profile)

```typescript
function calculatePlatformScore(therapist: Therapist): number {
  let score = 0;
  
  // Cal.com integration (30 points)
  if (hasFullCalComJourney(therapist)) {
    score += 30;
  }
  
  // Intake slot availability (mutually exclusive tiers)
  const intakeSlots7Days = countIntakeSlotsInDays(therapist, 7);
  const intakeSlots14Days = countIntakeSlotsInDays(therapist, 14);
  
  if (intakeSlots7Days >= 3) {
    score += 25;
  } else if (intakeSlots7Days >= 1) {
    score += 15;
  } else if (intakeSlots14Days >= 1) {
    score += 10;
  }
  
  // Profile completeness (can stack)
  const hasPhoto = !!therapist.photo_url;
  const hasApproach = !!therapist.approach_text;
  const hasWhoComes = !!therapist.who_comes_to_me;
  const hasLocation = !!therapist.city;
  
  if (hasPhoto && hasApproach && hasWhoComes) {
    score += 15; // Complete profile
  } else if (hasPhoto && hasLocation) {
    score += 5;  // Basic profile
  }
  
  return score;
}

function hasFullCalComJourney(therapist: Therapist): boolean {
  // Must have Cal.com username AND both event types configured
  if (!therapist.metadata?.cal_username) return false;
  
  const eventTypes = therapist.metadata?.cal_event_types || [];
  const hasIntake = eventTypes.includes('intake') || eventTypes.includes('kennenlernen');
  const hasSession = eventTypes.includes('session') || eventTypes.includes('sitzung');
  
  return hasIntake && hasSession;
}
```

#### Match Score (0-100 points)

Measures relevance to a specific patient's preferences. Only calculated when patient context exists.

| Points | Criterion | Calculation |
|--------|-----------|-------------|
| +40 max | Schwerpunkte overlap | 1 match = 15, 2 matches = 30, 3+ matches = 40 |
| +20 | In-person in patient's city | When patient accepts both formats |
| +15 | Modality overlap | ≥1 shared modality |
| +15 | Time slot compatibility | Slots match patient's time preferences |
| +10 | Gender match | When patient specified and therapist matches |

**Maximum Match Score:** 100 points

```typescript
function calculateMatchScore(therapist: Therapist, patient: PatientPreferences): number {
  let score = 0;
  
  // Schwerpunkte overlap (0-40 points)
  if (patient.schwerpunkte?.length > 0) {
    const overlap = intersection(therapist.schwerpunkte, patient.schwerpunkte).length;
    if (overlap >= 3) score += 40;
    else if (overlap === 2) score += 30;
    else if (overlap === 1) score += 15;
    // 0 overlap = 0 points (but not excluded)
  }
  
  // In-person in patient's city (20 points)
  // Only applies when patient selected BOTH online and in-person
  if (patient.session_preferences?.length === 2) {
    if (therapist.session_preferences?.includes('in_person') && 
        therapist.city === patient.city) {
      score += 20;
    }
  }
  
  // Modality overlap (15 points)
  if (patient.modalities?.length > 0) {
    const modalityOverlap = intersection(therapist.modalities, patient.modalities).length;
    if (modalityOverlap > 0) score += 15;
  }
  
  // Time slot compatibility (15 points)
  if (patient.time_preferences?.length > 0) {
    if (hasMatchingTimeSlots(therapist, patient.time_preferences)) {
      score += 15;
    }
  }
  
  // Gender match bonus (10 points)
  // Only when patient specified and it matches (not filtered out)
  if (patient.gender_preference && 
      patient.gender_preference !== 'any' &&
      therapist.gender === patient.gender_preference) {
    score += 10;
  }
  
  return score;
}
```

### Final Ranking Calculation

#### Directory View (No Patient Context)

```typescript
function rankForDirectory(therapists: Therapist[]): Therapist[] {
  return therapists
    .filter(t => isEligible(t))
    .map(t => ({ ...t, platformScore: calculatePlatformScore(t) }))
    .sort((a, b) => b.platformScore - a.platformScore);
}
```

#### Match View (With Patient Context)

```typescript
function rankForMatches(therapists: Therapist[], patient: PatientPreferences): Therapist[] {
  return therapists
    .filter(t => isEligible(t, patient))
    .map(t => ({
      ...t,
      platformScore: calculatePlatformScore(t),
      matchScore: calculateMatchScore(t, patient),
      // Match score weighted 1.5x higher than platform score
      totalScore: (calculateMatchScore(t, patient) * 1.5) + calculatePlatformScore(t)
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}
```

**Weighting Rationale:** Match relevance (1.5x) matters more than platform investment (1x) because patient outcomes depend on fit, not on whether the therapist has a complete profile. However, platform score still serves as meaningful tiebreaker.

---

## System 3: Commission

Commission tiers reward therapists who invest in the platform with better business terms. This is separate from ranking.

### Tier Definitions

| Tier | Commission Rate | Sessions | Requirements |
|------|-----------------|----------|--------------|
| **Standard** | 25% | First 10 per client | Marketplace status active |
| **Engaged** | 20% | First 10 per client | Standard + Full Cal.com journey + 3+ intake slots in next 7 days |

### Commission Eligibility Logic

```typescript
function getCommissionTier(therapist: Therapist): 'standard' | 'engaged' {
  // Must be on marketplace (verified + not hidden + accepting)
  if (!isEligible(therapist)) return 'standard';
  
  // Engaged tier requirements
  const hasFullCalCom = hasFullCalComJourney(therapist);
  const intakeSlots7Days = countIntakeSlotsInDays(therapist, 7);
  
  if (hasFullCalCom && intakeSlots7Days >= 3) {
    return 'engaged';
  }
  
  return 'standard';
}

function calculateCommission(sessionPrice: number, therapist: Therapist): number {
  const tier = getCommissionTier(therapist);
  const rate = tier === 'engaged' ? 0.20 : 0.25;
  return sessionPrice * rate;
}
```

### Commission Tier Benefits Summary

| Benefit | Standard (25%) | Engaged (20%) |
|---------|----------------|---------------|
| Listed on marketplace | ✓ | ✓ |
| Receive matched leads | ✓ | ✓ |
| Client referral program | ✓ | ✓ |
| Commission rate | 25% × 10 sessions | 20% × 10 sessions |
| Effective savings | — | €50 per client* |

*Based on €100/session average

### Dynamic Tier Updates

Commission tier is evaluated at time of booking creation, not at lead assignment. Therapist can move between tiers as their slot availability changes.

---

## UI Implementation

### Directory View

Display all eligible therapists sorted by Platform Score. No patient-specific indicators.

| Element | Display Rule |
|---------|--------------|
| Sort order | Platform Score descending |
| "Sofort buchbar" badge | Has 1+ intake slots in next 7 days |
| Photo placeholder | Show if no photo (soft requirement) |

### Match View

Display eligible therapists sorted by Total Score (Match × 1.5 + Platform).

| Element | Display Rule |
|---------|--------------|
| Sort order | Total Score descending |
| "Für dich empfohlen" badge | Top-ranked therapist OR Total Score ≥ 120 |
| "Sofort buchbar" badge | Has 1+ intake slots in next 7 days |
| City indicator | Show city name; highlight if matches patient |
| "Online verfügbar" tag | When therapist is online-only but patient wanted in-person |

### Criteria Summary Box (Match View)

Display the patient's selections for transparency:

```
Deine Kriterien:
• Sitzungsformat: Online & Vor Ort
• Stadt: Berlin
• Schwerpunkte: Trauma, Angst
• Geschlecht: Egal
```

### Handling Low Match Scores

When no therapist has high Match Score (e.g., no schwerpunkte overlap):

| Scenario | UI Treatment |
|----------|--------------|
| Best match has Match Score < 30 | Show all results, no "empfohlen" badge, add note: "Wir haben keine exakte Übereinstimmung gefunden, aber diese Therapeut:innen könnten passen." |
| Zero eligible therapists | Show message: "Aktuell keine passenden Therapeut:innen verfügbar. [Kontaktiere uns]" |

---

## Data Model Reference

### Tables and Fields

| Field | Table | Column | Type |
|-------|-------|--------|------|
| Verification status | `therapists` | `status` | enum |
| Accepting new clients | `therapists` | `accepting_new` | boolean |
| Hide from directory | `therapists` | `metadata.hide_from_directory` | boolean |
| Cal.com username | `therapists` | `metadata.cal_username` | string |
| Cal.com event types | `therapists` | `metadata.cal_event_types` | string[] |
| Schwerpunkte | `therapists` | `schwerpunkte` | jsonb array |
| Modalities | `therapists` | `modalities` | jsonb array |
| Session preferences | `therapists` | `session_preferences` | jsonb array |
| Gender | `therapists` | `gender` | enum |
| City | `therapists` | `city` | string |
| Photo | `therapists` | `photo_url` | string |
| Approach text | `therapists` | `approach_text` | text |
| Who comes to me | `therapists` | `who_comes_to_me` | text |
| Available slots | `therapist_slots` | various | — |

### Patient Preferences (from `people.metadata`)

| Field | Key | Type |
|-------|-----|------|
| Schwerpunkte | `metadata.schwerpunkte` | string[] |
| Modalities | `metadata.modalities` | string[] |
| Session format | `metadata.session_preferences` | string[] |
| Gender preference | `metadata.gender_preference` | string |
| City | `metadata.city` | string |
| Time preferences | `metadata.time_preferences` | string[] |

---

## Test Cases

### Eligibility Tests

```
Test E1: Unverified therapist
  Input: therapist.status = 'pending'
  Expected: Not eligible (filtered out)

Test E2: Verified but not accepting
  Input: therapist.status = 'verified', accepting_new = false
  Expected: Not eligible (filtered out)

Test E3: Gender filter applied
  Input: patient.gender_preference = 'female', therapist.gender = 'male'
  Expected: Not eligible (filtered out)

Test E4: Gender filter not applied when "any"
  Input: patient.gender_preference = 'any', therapist.gender = 'male'
  Expected: Eligible

Test E5: Format filter - exclusive online
  Input: patient.session_preferences = ['online'], therapist offers only in_person
  Expected: Not eligible (filtered out)

Test E6: Format filter - both formats accepted
  Input: patient.session_preferences = ['online', 'in_person'], therapist offers only online
  Expected: Eligible (format is soft filter when patient accepts both)
```

### Platform Score Tests

```
Test P1: Full Cal.com + 3+ slots + complete profile
  Input: cal_username set, both event types, 4 intake slots in 7 days, photo + approach + who_comes
  Expected: Platform Score = 30 + 25 + 15 = 70

Test P2: Cal.com but no intake slots
  Input: cal_username set, both event types, 0 intake slots
  Expected: Platform Score = 30 + 0 + 15 = 45

Test P3: No Cal.com, basic profile only
  Input: no cal_username, photo + location only
  Expected: Platform Score = 0 + 0 + 5 = 5

Test P4: Intake slots in 14-day fallback
  Input: 0 slots in 7 days, 2 slots in 14 days
  Expected: Gets +10 points (fallback tier)
```

### Match Score Tests

```
Test M1: Perfect schwerpunkte match
  Input: patient wants [trauma, angst, depression], therapist has [trauma, angst]
  Expected: Schwerpunkte score = 30 (2 matches)

Test M2: No schwerpunkte overlap
  Input: patient wants [trauma], therapist has [beziehung]
  Expected: Schwerpunkte score = 0, therapist still shown

Test M3: In-person city bonus
  Input: patient accepts both formats, city = Berlin, therapist in Berlin with in_person
  Expected: +20 city bonus

Test M4: Online-only therapist when patient accepts both
  Input: patient accepts both formats, city = Berlin, therapist online-only
  Expected: No city bonus, therapist still shown
```

### Commission Tier Tests

```
Test C1: Standard tier
  Input: Verified therapist, no Cal.com
  Expected: Commission = 25%

Test C2: Engaged tier
  Input: Full Cal.com journey, 3 intake slots in 7 days
  Expected: Commission = 20%

Test C3: Falls back to Standard
  Input: Full Cal.com journey, only 2 intake slots in 7 days
  Expected: Commission = 25% (doesn't meet 3+ requirement)

Test C4: Dynamic tier change
  Input: Therapist adds 3rd slot mid-week
  Expected: New bookings use 20%, previous bookings unchanged
```

### Ranking Tests

```
Test R1: Directory sort by Platform Score
  Input: Therapist A (score 70), Therapist B (score 45)
  Expected: Order = [A, B]

Test R2: Match view weights Match Score higher
  Input: 
    Therapist A: Match Score 80, Platform Score 30 → Total = 150
    Therapist B: Match Score 40, Platform Score 70 → Total = 130
  Expected: Order = [A, B] (higher match relevance wins)

Test R3: Platform Score as tiebreaker
  Input:
    Therapist A: Match Score 60, Platform Score 50 → Total = 140
    Therapist B: Match Score 60, Platform Score 40 → Total = 130
  Expected: Order = [A, B]
```

---

## Implementation Checklist

### Phase 1: Core Algorithm

- [ ] Implement `isEligible()` function with hard filters
- [ ] Implement `calculatePlatformScore()` function
- [ ] Implement `calculateMatchScore()` function
- [ ] Update directory endpoint to use Platform Score ranking
- [ ] Update match endpoint to use Total Score ranking

### Phase 2: Data Requirements

- [ ] Add `cal_event_types` to therapist metadata schema
- [ ] Create view/function for counting intake slots in time window
- [ ] Ensure all 9 therapists have required fields populated

### Phase 3: UI Updates

- [ ] Add "Sofort buchbar" badge logic
- [ ] Update "Für dich empfohlen" badge logic
- [ ] Add criteria summary box to match view
- [ ] Add low-match-score messaging

### Phase 4: Commission System

- [ ] Implement `getCommissionTier()` function
- [ ] Update booking creation to record tier at booking time
- [ ] Add commission tier display to therapist dashboard (future)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-06 | KK + Claude | Initial specification |

---

## Appendix: Design Decisions

### Why Soft Filters Instead of Hard Filters for Match Criteria?

With limited supply (9 therapists), hard filtering on schwerpunkte/modality/city would frequently produce zero results. Users seeing "no therapists found" is worse than seeing "partial matches available." The ranking system ensures best matches appear first while still showing options.

### Why Commission Doesn't Affect Ranking?

Mixing financial incentives with visibility creates perverse incentives:
- Therapists might game slot availability without genuine availability
- Ranking becomes about business terms rather than patient outcomes
- Makes the algorithm harder to explain and trust

Commission is a reward for platform investment. Ranking is about patient relevance. Keeping them separate maintains clarity.

### Why 7 Days for Intake, Not 21?

Patients seeking therapy are often in acute need. A therapist with availability 3 weeks out provides less value than one available this week. The 7-day window rewards therapists who maintain genuine, near-term availability.

### Why 1.5x Weight for Match Score?

Patient outcomes depend primarily on fit (schwerpunkte, modality, format). A perfectly matched therapist with incomplete profile is better than poorly matched therapist with great profile. The 1.5x multiplier ensures relevance dominates while platform investment still matters for tiebreaking.
