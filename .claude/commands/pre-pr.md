---
description: Run full validation (lint + format check + build) and report pass/fail before opening a PR
---

Run `bun run validate` (equivalent to `bun run test && bun run build`, i.e. `lint:js` + `lint:filters` + `lint:md` + `format:check` + all build tasks).

Report:
1. Which of lint:js (biome + oxlint), lint:filters (AGLint), lint:md (markdownlint), format:check, and build passed or failed
2. For any failure, the exact error output and the file:line it points to
3. A one-line verdict: **READY FOR PR** or **FIX NEEDED** with what to fix

Do not attempt to fix failures automatically unless the user asks — just report them.
