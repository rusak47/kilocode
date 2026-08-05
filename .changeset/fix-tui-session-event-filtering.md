---
"@kilocode/cli": patch
---

Fix TUI not rendering updates when opening old sessions from different directories

When opening an old session from a different workspace/directory, the TUI would not render session events (like `session.next.step.started`, `session.next.prompted`, etc.) because the event filter checked `project.project()` which was not yet synced. The fix allows events for the currently open session to bypass the project filter while the project sync completes.
