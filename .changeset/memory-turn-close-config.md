---
"@kilocode/cli": patch
---

Fix memory captures being silently skipped after each turn: the turn-close subscriber could not read config inside its fork context, so `Service not found: @opencode/Config` errors were swallowed and consolidation never ran. Config is now read from the captured instance instead of the service registry.
