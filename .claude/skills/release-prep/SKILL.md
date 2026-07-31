---
name: release-prep
description: Validate the repo and summarize changes before manually dispatching maintain-lists.yml (releases are otherwise fully automated). Use before triggering a manual release or checking whether one is due.
---

`maintain-lists.yml` auto-tags releases as `vYYYY.MM.DD-HHMM` and runs on `workflow_dispatch`. Use this before manually triggering it, to catch failures locally instead of in CI.

## 1. Full validation

```
bun run validate
```

This runs lint + format check + build (`bun run test && bun run build`). Fix anything it reports before proceeding.

## 2. Summarize changes since the last release tag

```
git describe --tags --abbrev=0
git log --oneline $(git describe --tags --abbrev=0)..HEAD -- lists/
```

## 3. Report

Summarize for the user:
- Whether `bun run validate` passed
- Number of commits touching `lists/` since the last tag
- A one-line changelog-style summary (files changed, rules added/removed) to sanity-check against what `maintain-lists.yml`'s auto-generated release notes will say

Do not tag or push a release yourself — `maintain-lists.yml` handles that when dispatched.
