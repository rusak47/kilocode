---
"kilo-code": minor
---

Add `memory` config block to `opencode.json`. `memory.max_output_tokens` sets the max output budget for memory consolidation (digest) model calls; unset leaves it uncapped and falls back to the provider default. `memory.model` overrides the memory model to one other than the global session model.
