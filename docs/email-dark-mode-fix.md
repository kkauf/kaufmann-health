# Email Dark Mode Fix

## Problem

Gmail app with dark mode enabled was rendering emails illegibly - dark text on dark backgrounds, making content unreadable.

## Root Cause

1. **CSS media queries don't work in Gmail** - Gmail strips `<style>` tags entirely
2. **Email clients auto-invert colors** in dark mode without explicit prevention
3. **Ineffective blend mode hacks** - The `gmail-blend-screen` wrapper approach doesn't work reliably
4. **Missing `!important` declarations** - Email clients override inline styles without `!important`

## Solution Implemented

### 1. Layout Changes (`src/lib/email/layout.ts`)

**Removed:**
- All CSS media query dark mode overrides (stripped by Gmail anyway)
- `gmail-blend-screen` wrapper divs (ineffective)
- `color-scheme: light dark` (was allowing dark mode)

**Added:**
- `<meta name="color-scheme" content="light only" />` - Force light mode
- `<meta name="supported-color-schemes" content="light" />` - Declare light-only support
- Minimal CSS: `* { color-scheme: light only !important; }` - Enforce at element level
- `!important` on ALL color and background properties in layout elements

### 2. Template Updates

**Fixed templates:**
- ✅ `emailConfirmation.ts` - Removed blend wrappers, added `!important` to all colors
- ✅ `patientSelection.ts` - Added `!important` to headers, text, backgrounds, badges, modalities
- ✅ `therapistPreview.ts` (component) - Added `!important` to all colors including badges and avatars

**Pattern for all color properties:**
```typescript
// Before (gets inverted in dark mode)
style="color:#0f172a; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);"

// After (enforces light mode)
style="color:#0f172a !important; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important; background-image: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%) !important;"
```

**Note:** Double `background` and `background-image` declarations are intentional - Gmail requires both.

### 3. Design Language Documentation

Updated `docs/design-language.md` with comprehensive "Email Design (Transactional)" section:
- Dark mode prevention strategy
- Required `!important` patterns
- Testing checklist
- Section color patterns with proper syntax

## Remaining Work (Partially Complete)

The following templates still need `!important` additions on color properties:

### Medium Priority (common templates)
- `patientConfirmation.ts` - Confirmation email after submission
- `patientUpdates.ts` - Status updates
- `therapistWelcome.ts` - Welcome email for new therapists
- `therapistReminder.ts` - Onboarding reminders
- `therapistNotification.ts` - Match notifications

### Lower Priority (less frequent)
- `patientBlockerSurvey.ts` - Blocker survey emails
- `therapistApproval.ts` - Approval notifications
- `therapistRejection.ts` - Rejection feedback
- `therapistUploadConfirmation.ts` - Upload confirmations

## How to Fix Remaining Templates

For each template, add `!important` to:
1. All `color:` properties
2. All `background:` properties (solid colors and gradients)
3. All `background-image:` properties (gradients)

**Example regex patterns for search/replace:**
- Find: `color:(#[0-9a-fA-F]{6});`
- Replace: `color:$1 !important;`

- Find: `background: linear-gradient\(([^)]+)\);`
- Replace: `background: linear-gradient($1) !important; background-image: linear-gradient($1) !important;`

## Testing Checklist

After completing remaining templates, test in:

- [x] Gmail web (light & dark mode) - Fixed for completed templates
- [x] Gmail iOS app (dark mode) - **This was the reported issue** - Fixed
- [ ] Apple Mail (dark mode)
- [ ] Outlook web
- [ ] Outlook desktop (Windows)

## Verification

Run tests: `npm run test:critical` - ✅ All passing (316 tests)
Build check: `npm run build` - ✅ Success

## Technical Details

### Why `!important` is Required

Email clients parse inline styles and apply their own overrides. Without `!important`:
1. Gmail dark mode applies `color: #e5e7eb` to all text
2. Background colors get inverted to dark equivalents
3. Our light gradients become unreadable dark backgrounds

With `!important`:
1. Our color declarations take precedence
2. Dark mode inversion is suppressed
3. Emails render consistently in light mode across all clients

### Why Double Background Declaration

Gmail's rendering engine requires BOTH:
- `background: linear-gradient(...)` - Standard CSS
- `background-image: linear-gradient(...)` - Gmail-specific parsing

This redundancy ensures maximum compatibility.

## References

- Layout implementation: `src/lib/email/layout.ts`
- Template examples: `src/lib/email/templates/emailConfirmation.ts`, `patientSelection.ts`
- Component example: `src/lib/email/components/therapistPreview.ts`
- Design guidelines: `docs/design-language.md` (Email Design section)
