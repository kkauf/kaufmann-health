# Security Issue: Google Ads Campaign Configs

## Problem Identified

Several files in `google_ads_api_scripts/` are **publicly tracked in GitHub** and contain sensitive strategic information:

### Files with Exposed Information:

1. **`campaign-config.ts`** ❌ PUBLIC
   - Contains "UNSAFE KEYWORDS" comment revealing actual keywords Google flagged
   - Shows our workaround strategies and synonyms
   - Reveals our keyword research and policy compliance approach

2. **`campaign-config-earth170.ts`** ❌ PUBLIC  
   - Even labeled as "SAMPLE", it reveals our campaign structure
   - Shows budget ranges, scheduling approach, ad group organization

3. **Test #0 config** ✅ PRIVATE (fixed)
   - Now properly in `google_ads_api_scripts/private/`
   - Not committed to git

---

## Immediate Actions Required

### 1. Remove Sensitive Comments

**File: `google_ads_api_scripts/campaign-config.ts`**

Remove the entire "UNSAFE KEYWORDS" comment block (lines 6-20):
```typescript
/*
UNSAFE KEYWORDS (flagged by Google policy: HEALTH_IN_PERSONALIZED_ADS)
- somatic experiencing therapeut deutschland
- achtsame psychotherapie
- ganzheitliche therapie privat

Safer alternatives now used in-place:
- somatic experiencing
- körpertherapie online
- achtsamkeitsbasierte begleitung
- ganzheitliche therapiebegleitung

Synonym guidance:
- "somatic experiencing" → "somatische begleitung", "körperarbeit online", "körperbasierte begleitung"
*/
```

**Why:** This reveals:
- Which keywords we've tried and failed with
- Google Ads policy violations we've encountered  
- Our competitive keyword strategy and workarounds

### 2. Simplify Public Sample Configs

Keep only minimal type-demonstration samples in public files. Move realistic examples to private folder.

**Option A:** Keep samples ultra-generic
```typescript
// Example only for type demonstration
export const SAMPLE_CONFIG: CampaignConfig = {
  name: 'Example Campaign',
  budget_euros: 100,
  landing_page: 'https://example.com/landing',
  schedule: { start: '2025-01-01', end: '2025-01-31' },
  keywords: {
    tier1: { maxCpc: 2.0, terms: ['keyword 1', 'keyword 2'] }
  },
  headlines: ['Headline 1', 'Headline 2', 'Headline 3'],
  descriptions: ['Description 1', 'Description 2'],
};
```

**Option B:** Remove sample configs entirely from tracked files
- Keep only type definitions in `campaign-config.ts`
- Move all examples to `examples/` folder or private/
- Reference private configs in documentation only

### 3. Create Private Folder Documentation

Since the private folder is gitignored, document its usage in developer docs:

**Add to `docs/google-ads-setup.md` or similar:**
```markdown
## Campaign Configuration

All production campaign configs MUST be stored in:
```
google_ads_api_scripts/private/
```

This folder is gitignored and will NEVER be committed to the public repo.

### File naming convention:
- `campaign-config-{test-name}.ts` - TypeScript configs (preferred)
- `{campaign-name}.json` - JSON configs (for CLI use)

### What goes in private/:
- Actual keywords, budgets, and scheduling
- Real landing page URLs  
- Ad copy (headlines, descriptions)
- Negative keyword lists
- Budget amounts and bid strategies

### What can be public:
- Type definitions (CampaignConfig, KeywordTier)
- Generic scripts (create-campaigns.ts, monitor-campaigns.ts)
- Ultra-minimal examples with dummy data
```

---

## Git History Check

Run this to check if private configs were ever committed:

```bash
# Check for any historical commits of private folder
git log --all --full-history -- "google_ads_api_scripts/private/"

# Check for any mentions of actual keywords in commit messages
git log --all --grep="somatic\|narm\|hakomi" --oneline

# Check for actual config files that might have been committed then ignored
git log --all --full-history --diff-filter=D -- "google_ads_api_scripts/*.json"
```

**Good news:** Initial check shows private folder contents have never been committed.

---

## Recommended Immediate Steps

### Step 1: Clean Public Files
```bash
# Edit campaign-config.ts - remove UNSAFE KEYWORDS comment
# Edit campaign-config-earth170.ts - replace with generic samples or remove

git add google_ads_api_scripts/campaign-config.ts
git add google_ads_api_scripts/campaign-config-earth170.ts
git commit -m "security: remove sensitive keyword strategy from public configs"
```

### Step 2: Document Private Folder Usage
- Add section to developer docs
- Create checklist for new campaign creation
- Add pre-commit hook reminder (optional)

### Step 3: Audit Existing Commits
- Review recent commits for accidental exposure
- If found, consider git history rewriting (advanced)

### Step 4: Team Training
- Brief team on public vs private distinction
- Add reminder to PR template
- Document in onboarding materials

---

## Files Currently in Private Folder (Gitignored ✅)

```
google_ads_api_scripts/private/
├── campaign-config-test0-positioning.ts  ✅ SAFE (not tracked)
├── earth170.json                         ✅ SAFE (not tracked)
└── week38.json                           ✅ SAFE (not tracked)
```

These files are properly protected and will never be committed.

---

## Ongoing Protection

### .gitignore Entry (Already Present ✅)
```gitignore
/google_ads_api_scripts/private/
```

### Pre-commit Hook (Optional Enhancement)
```bash
#!/bin/sh
# .husky/pre-commit

# Check for private configs being staged
if git diff --cached --name-only | grep -q "google_ads_api_scripts/private/"; then
  echo "❌ ERROR: You're trying to commit files from google_ads_api_scripts/private/"
  echo "This folder contains sensitive campaign data and must never be committed."
  exit 1
fi

# Check for suspicious keywords in config files
if git diff --cached --name-only | grep -q "campaign-config.*\.ts$"; then
  if git diff --cached | grep -iE "(therapeut|trauma|somatic|narm|hakomi|körper)"; then
    echo "⚠️  WARNING: Campaign config changes detected with potential real keywords."
    echo "Make sure these are samples only, not production configs."
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi
```

---

## Summary

**Current Status:**
- ✅ Private folder properly gitignored
- ✅ New test0 config in private folder
- ❌ Public files contain sensitive keyword strategy comments
- ❌ Sample configs could reveal competitive approach

**Priority Actions:**
1. Remove "UNSAFE KEYWORDS" comment from campaign-config.ts
2. Simplify or remove sample configs from public files
3. Document private folder usage in developer docs
4. Add security reminders to workflow

**Long-term:**
- Consider pre-commit hooks for additional protection
- Regular audits of public files for accidental exposure
- Team training on public/private distinction
