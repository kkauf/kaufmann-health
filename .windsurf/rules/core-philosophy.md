---
trigger: always_on
---

# Core Philosophy
Ship fast, refactor when patterns emerge (3x rule), document only the "why"

# Architecture Rules

## Boundaries
- Components: UI only (render + local state)
- Hooks: Data fetching + business logic
- Start inline, extract when repeated 3x or file >200 lines

## Data Flow
- Frontend never writes directly to DB
- API always returns {data, error}
- State as close to usage as possible
- Context only when prop drilling >3 levels

## Documentation
ONLY: Business rules, performance hacks, security decisions, weird workarounds
SKIP: What code does, CRUD, React patterns, TypeScript types, install steps

# Development Flow

## Start Simple → Refactor When
- Inline styles → styled components (when messy)
- useState → context (when prop drilling hurts)
- Direct calls → abstractions (when repeated 3x)
- Single file → split (when >200 lines)

## Tech Stack (No Debates)
USE: shadcn/ui, Tailwind, Edge Functions (secrets), RLS (security)
AVOID: Custom abstractions, Redux/Zustand, microservices, custom build tools

## Code Patterns
```typescript
// Error handling everywhere:
try {
  const { data, error } = await operation();
  if (error) throw error;
  return data;
} catch (err) {
  console.error('Context:', err);
  // Handle user-facing error
}
```

## Structure
/app → Pages only (use route groups for organization)
/api → ALL API routes (flat structure: /public, /admin, /internal)
/features → Business domains (each with components/, hooks/, lib/)
/shared → Cross-cutting (layout components, ui/, common utils)
/scripts → Operational scripts

When editing: if hunting through folders, move related files together.

# Anti-Patterns
- useEffect for data transform → use derived state
- Business logic in components → move to hooks
- Multiple fetches same data → centralize
- Premature abstraction → wait for patterns

# Performance
Only optimize what users notice. DB queries > client filtering. Always optimize images.

# Testing (Solo Reality)

SKIP: UI users will report, features you see daily, one-time code
TEST: Same bug twice, money involved, complex calculations

If testing needed: 5-minute max or skip (unless payments)
```javascript
// Usually enough:
npm run build && npm run start
```

# Git (Solo)
Follow /stage command when packages of work are done
If no Linear task is referenced and the work is significant (i.e. major bugs or feature changes), create a new Linear task and reference it in the commit message, mark it as "Done" when the commit is staged

# Decision Tree
1. shadcn component exists? → Use it
2. Supabase RLS handles it? → Let it
3. Complexity needed today? → Delete it
4. Confusing in 3 months? → Add one comment