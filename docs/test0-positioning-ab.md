# Test #0: Positioning A/B Test

**Status:** Ready to deploy  
**Duration:** 2 weeks or €500 budget depleted (whichever comes first)  
**Budget:** €250 per variant (€18/day × 14 days)  
**Start Date:** TBD (run `npm run ads:create:test0` when ready)

---

## Overview

This test compares two market positioning strategies to determine which yields better unit economics (CAC vs. CLV indicators).

### Variant A: Body-Oriented Specialist
**Landing:** `/start?variant=body-oriented`  
**Positioning:** Specialized trauma therapy experts (NARM, SE, Hakomi)  
**Target:** People who've tried talk therapy but need deeper work  
**Hypothesis:** Higher CAC but much higher CLV → Better overall unit economics

### Variant B: Ready Now / Urgency-Driven
**Landing:** `/start?variant=ready-now`  
**Positioning:** Immediate access to therapy without waiting  
**Target:** Broad market needing help urgently (self-pay willing)  
**Hypothesis:** Lower CAC but potentially lower CLV → Similar or better overall unit economics

---

## Implementation Details

### Landing Page Variants

The `/start` page dynamically renders copy based on the `variant` URL parameter:

```typescript
// URL examples:
https://www.kaufmann-health.de/start?variant=body-oriented → Variant A
https://www.kaufmann-health.de/start?variant=ready-now    → Variant B
https://www.kaufmann-health.de/start                      → Variant A (default)
```

**Key Copy Differences:**

| Element | Variant A (Body-Oriented) | Variant B (Ready Now) |
|---------|---------------------------|------------------------|
| **Hero Headline** | "Wenn der Kopf nicht weiterkommt, hilft der Körper" | "Therapie ohne Wartezeit – Termine in 24 Stunden" |
| **Hero Subtitle** | Emphasis on trauma-sensitive, body-oriented expertise | Emphasis on no waiting lists, immediate availability |
| **Process Tagline** | "Keine Algorithmen. Keine Wartelisten. Nur persönliche Empfehlungen." | "Keine Wartelisten. Keine Bürokratie. Einfach starten." |
| **FAQ Focus** | Why body-oriented therapy works, trauma healing | Why no waiting time, self-pay benefits |

### Attribution Flow

1. **Client-side:** PageAnalytics tracks `LP-Start-body-oriented` or `LP-Start-ready-now`
2. **Server-side:** `parseCampaignFromRequest()` extracts:
   - `campaign_source: '/start'`
   - `campaign_variant: 'A'` (body-oriented) or `'B'` (ready-now)
3. **Database:** Stored in `people.campaign_source` and `people.campaign_variant`
4. **Admin:** Campaign stats aggregated by source + variant

### Google Ads Setup

**Campaign Names:**
- `KH_BodyOriented_Positioning_Test_A`
- `KH_ReadyNow_Positioning_Test_B`

**Budget Management:**
- Daily budget: €18/campaign
- Total cap: €250/campaign
- Auto-pause: Via `npm run ads:monitor:test0:apply` when spend ≥ €250

**Targeting:**
- Location: Berlin + 50km radius
- Language: German
- Network: Google Search only (no Display)

**Keyword Strategy:**

*Variant A focuses on:*
- Body-oriented therapy terms (körperorientierte therapie, somatic experiencing)
- Specific modalities (NARM, Hakomi, Core Energetics)
- Problem signals (trauma im körper, nervensystem beruhigen)
- Talk therapy dissatisfaction

*Variant B focuses on:*
- Immediate access (therapeut sofort verfügbar, therapie ohne wartezeit)
- Self-pay/private (therapie selbstzahler, privattherapie)
- General therapy seeking (therapeut berlin, psychotherapeut online)
- Urgency (zeitnah therapeut, schnelle hilfe)

---

## Deployment Instructions

### 1. Create Campaigns (DRY RUN FIRST)

```bash
# Dry run to validate config
npm run ads:create:test0:dry

# Review output, then apply when ready
CONFIRM_APPLY=true npm run ads:create:test0
```

This creates both campaigns with:
- Ad groups per keyword tier
- Responsive Search Ads (RSAs)
- Negative keywords
- German language + Berlin geo targeting

### 2. Monitor Spend Daily

```bash
# Check campaign performance (dry run)
npm run ads:monitor:test0

# Auto-pause campaigns at €250 spend
npm run ads:monitor:test0:apply
```

**Recommended:** Set up a cron job or manual daily check to run the monitor script.

### 3. Track Results in Admin

Navigate to `/admin` → Campaign Stats to view:
- **Campaign Performance:** Leads, confirmed, confirmation rate by variant
- **Daily Breakdown:** Day-by-day performance per variant

Export CSV for detailed analysis:
```bash
# In admin UI, click "Export CSV" on Campaign Performance card
```

---

## Success Metrics

### Primary Metrics
1. **CAC (Cost per Acquisition):**
   - Spend ÷ Confirmed leads (status != 'pre_confirmation')
   
2. **Confirmation Rate:**
   - (Confirmed leads ÷ Total leads) × 100

3. **CLV Indicators:**
   - Therapist acceptance rate (from admin matches data)
   - Average time to therapist acceptance
   - (Future: second session booking rate when available)

### Secondary Metrics
- Click-through rate (CTR) per keyword group
- Cost per click (CPC) trends
- Geographic distribution (Berlin vs. surrounding areas)

---

## Data Collection

### What's Tracked Automatically
✅ **Attribution:** All leads tagged with `/start` + variant A/B  
✅ **Analytics:** Page views with qualifier `LP-Start-body-oriented` or `LP-Start-ready-now`  
✅ **Conversions:** Google Ads Enhanced Conversions fire on lead confirmation  
✅ **Admin Stats:** Campaign performance aggregated by source + variant  

### Manual Collection Needed
⚠️ **Therapist Acceptance:** Export from `/admin/matches` after test completion  
⚠️ **Qualitative Feedback:** Note any patterns in patient issues/preferences per variant  

---

## Analysis Plan

### During Test (Daily Checks)
1. Monitor spend to stay within €250/variant cap
2. Check for obvious performance issues (0 conversions at high spend)
3. Pause underperforming keyword groups if needed

### Post-Test Analysis
1. **Calculate CAC per variant:**
   ```
   Variant A CAC = Total Spend A ÷ Confirmed Leads A
   Variant B CAC = Total Spend B ÷ Confirmed Leads B
   ```

2. **Compare confirmation rates:**
   ```
   Variant A: (Confirmed ÷ Total) × 100
   Variant B: (Confirmed ÷ Total) × 100
   ```

3. **Assess CLV indicators:**
   - Therapist acceptance rate per variant
   - Quality of leads (preferences alignment, show-up probability)

4. **Decision criteria:**
   - If CAC similar: Choose variant with better CLV indicators
   - If CAC very different: Calculate breakeven CLV threshold
   - Consider qualitative factors (brand fit, scalability)

### Export Data for Analysis

```bash
# From admin dashboard:
# 1. Navigate to /admin
# 2. Scroll to "Campaign Performance" card
# 3. Click "Export CSV"
# 4. Filter rows: campaign_source = '/start', variant = 'A' or 'B'

# Additionally, export matches data:
# 1. Navigate to /admin/matches
# 2. Filter by date range (test period)
# 3. Manual export or database query:

SELECT 
  p.campaign_variant,
  COUNT(*) as total_matches,
  SUM(CASE WHEN m.status = 'accepted' THEN 1 ELSE 0 END) as accepted,
  SUM(CASE WHEN m.status = 'accepted' THEN 1 ELSE 0 END)::float / COUNT(*) as acceptance_rate
FROM matches m
JOIN people p ON m.patient_id = p.id
WHERE p.campaign_source = '/start'
  AND m.created_at >= 'TEST_START_DATE'
  AND m.created_at <= 'TEST_END_DATE'
GROUP BY p.campaign_variant;
```

---

## Technical Architecture

### Files Changed/Created

**Landing Page:**
- `src/app/start/page.tsx` — Variant-based copy rendering

**Attribution:**
- `src/lib/server-analytics.ts` — Parse `variant` param from `/start`

**Admin Stats:**
- `src/app/api/admin/stats/route.ts` — Updated to A/B only (removed variant C)

**Google Ads:**
- `google_ads_api_scripts/private/campaign-config-test0-positioning.ts` — Campaign configs (private)
- `google_ads_api_scripts/create-test0-positioning.ts` — Campaign creator
- `package.json` — Added npm scripts for test management

**Tests:**
- `tests/test0.positioning.ab.test.ts` — Attribution tests (10 tests, all passing)

### Attribution Data Flow

```
User visits: /start?variant=ready-now
    ↓
PageAnalytics: tracks page_view with qualifier "LP-Start-ready-now"
    ↓
User submits form → POST /api/public/leads
    ↓
parseCampaignFromRequest(req):
  - Referer: /start?variant=ready-now
  - Returns: { campaign_source: '/start', campaign_variant: 'B' }
    ↓
Insert into people table:
  - campaign_source: '/start'
  - campaign_variant: 'B'
    ↓
Admin Stats aggregates by source + variant for analysis
```

---

## Troubleshooting

### Issue: Campaigns not spending
- **Check:** Are campaigns ENABLED in Google Ads?
- **Check:** Budget sufficient? (€18/day minimum recommended)
- **Check:** Keywords approved? (Check for policy violations)
- **Fix:** Review rejected keywords in `logs/rejected-keywords.jsonl`

### Issue: Wrong variant attribution
- **Check:** Is Referer header present? (May fail in privacy browsers)
- **Check:** Verify URL has `?variant=body-oriented` or `?variant=ready-now`
- **Debug:** Add console.log in `parseCampaignFromRequest()`

### Issue: High CPA / Low conversions
- **Action:** Run `npm run ads:monitor:test0` to identify underperformers
- **Action:** Pause high-cost, zero-conversion keyword groups
- **Action:** Increase bids on converting keywords (manual adjustment in Google Ads)

### Issue: Budget exceeded €250
- **Prevention:** Run `npm run ads:monitor:test0:apply` daily
- **Recovery:** Manually pause campaigns in Google Ads console
- **Note:** Monitor script auto-pauses at ≥€250 spend with 0 conversions

---

## Post-Test Cleanup

After test completion and data export:

1. **Pause/Archive Campaigns:**
   ```bash
   # Manually in Google Ads console or via API
   ```

2. **Document Results:**
   - Update this file with final metrics
   - Create decision document for positioning strategy

3. **Apply Learnings:**
   - Update default `/start` page with winning variant copy
   - Adjust keyword strategy based on performance data
   - Refine audience targeting for future campaigns

4. **Archive Test Data:**
   ```bash
   # Campaign config already in private/ folder (gitignored)
   # Optionally copy to archive for long-term reference
   cp google_ads_api_scripts/private/campaign-config-test0-positioning.ts \
      google_ads_api_scripts/private/archive/
   ```

---

## Notes & Observations

*(To be filled during test execution)*

### Week 1 Observations:
- [ ] Variant A CTR: ___
- [ ] Variant B CTR: ___
- [ ] Early CAC trends: ___
- [ ] Keyword performance notes: ___

### Week 2 Observations:
- [ ] Confirmation rate trends: ___
- [ ] Budget pacing: ___
- [ ] Quality of leads per variant: ___

### Final Decision:
- [ ] Winning variant: ___
- [ ] Rationale: ___
- [ ] Next steps: ___
