---
"@kilocode/cli": patch
---

Retry the main agent loop on provider quota errors like `ResourceExhausted: Worker local total request limit reached`, matching the retry behavior compaction already has.
