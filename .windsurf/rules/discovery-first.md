---
trigger: model_decision
description: Apply when starting new tasks or making code changes
---

# Discovery-First Development

## Before Writing ANY Code

**1. Map the Territory (5 minutes)**
```bash
# Find ALL usage of components you're modifying
grep -r "ComponentName" src/

# Find similar features to follow patterns
grep -r "similar_pattern" src/ --include="*.ts" --include="*.tsx"

# Check existing API routes
ls src/app/api/*/route.ts | xargs grep -l "relevant_term"
```

**2. Check Existing Patterns**
- Environment variables: Always check `.env.example` first
- Database schema: Review `src/app/api/*/route.ts` for table patterns
- Architecture decisions: See `/docs/architecture.md` and `/docs/technical-decisions.md`
- **Analytics tracking: MUST read `/docs/analytics.md` before any feature work**
- Similar features: Find and follow existing implementations

**3. Verify State (when touching database)**
```bash
supabase migration list
# If out of sync, STOP and report before proceeding
```

## Decision Boundaries

**✅ You Decide (Implementation):**
- Library selection (choose best tool for requirements)
- Error handling UX (match existing tone)
- Component structure (follow existing patterns)
- Test organization (mirror similar test files)
- CSS implementation (use existing design system)

**❓ Ask First (Architecture):**
- New user flow patterns (e.g., when to verify)
- Breaking changes to existing flows
- New environment variables (only if pattern unclear)
- Database schema changes that affect multiple features
- Third-party service integrations

## Testing Protocol

**After EVERY code change:**
1. Run specific test: `npm test -- path/to/file.test.ts`
2. Verify fix works (don't assume)
3. Run related test suite if changes affect multiple areas
4. Only claim "fixed" after seeing green tests

**Never trust "should work" - always verify with actual test run.**

## Discovery Saves Time

❌ **Don't:** Assume, invent new patterns, ask for pre-made decisions  
✅ **Do:** Grep, check existing code, follow established patterns, ask when uncertain

**When you follow existing patterns, you ship faster and more reliably.**