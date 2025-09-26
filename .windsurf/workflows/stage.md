---
description: Complete a task locally and on Linear
auto_execution_mode: 1
---

- Post an update to Linear about task progress / completion
- Move Linear task to "Done"
- Stage changes locally related to the changes in this conversation ONLY (do not include other changes)
- Create a commit message follow the Conventional Commits specification, referencing the Linear ticket:
```<type>(<scope>): <description> [<LINEAR-ID>]

[optional body]

[optional footer(s)]```
- Commit locally but do not push