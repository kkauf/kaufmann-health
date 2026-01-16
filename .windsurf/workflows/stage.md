---
description: Commit changes from this conversation
auto_execution_mode: 3
---

Stage all changes that were touched in this conversation only.

Create a **descriptive** Conventional Commit message:
- **Subject line**: `type(scope): concise what changed` (max 72 chars)
  - `type`: feat, fix, refactor, docs, chore, perf, test
  - `scope`: feature area (e.g., booking, admin, email, cal, matching)
  - Be specific: "add Cal.com slot sync" not "update booking"
- **Body** (after blank line): 
  - Brief context on WHY if not obvious
  - Key files/components affected if >3 files changed
  - Breaking changes or migration notes if any
- **Footer**: Include Linear task ID if referenced (e.g., `Refs: EARTH-123`)

Example good message:
```
feat(booking): add therapist calendar sync with Cal.com

- Fetch availability from Cal.com API on matches page load
- Cache slots for 5 min to reduce API calls
- Show "Direkt buchen" CTA when slots available

Refs: EARTH-220
```

Write an update to the Linear task and move it to done.
If no Linear task was indicated, confirm with the user whether a new task should be created. This ALWAYS makes sense for larger changes (>100 lines of code changed, i.e. you don't need to confirm with the user).
The user will push changes themselves.