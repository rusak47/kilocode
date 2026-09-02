---
"@kilocode/cli": patch
---

Fix plugin-injected skills from outside the project root failing to load with "blocked file reference outside project config scope" error. Plugins can now add skill paths at runtime via config hooks and their bundled skills will load correctly.
