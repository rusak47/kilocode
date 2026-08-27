---
"@kilocode/cli": patch
---

Retry empty streaming responses that report non-zero output tokens but finish with an unknown reason. Previously these were treated as complete; now they're retried through the bounded recovery budget.
