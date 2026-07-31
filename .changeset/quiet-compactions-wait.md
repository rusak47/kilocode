---
"@kilocode/cli": patch
"@opencode-ai/core": patch
---

Keep long-session compaction reliable when providers rate-limit concurrent summary requests: adaptive throttle, retries for empty responses, partial-success degradation, a sane chunk budget, and a `compaction.chunk_concurrency` override (default 3).
