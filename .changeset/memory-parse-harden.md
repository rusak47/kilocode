---
"@kilocode/kilo-memory": patch
---

Harden memory capture parsing so malformed digest or typed outputs (missing root keys, non-JSON, bare arrays) fall back instead of producing empty or corrupt memory entries.
