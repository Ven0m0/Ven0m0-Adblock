# Implementation Plan
_Generated: 2026-03-26T12:00:00Z · 2 tasks (1 completed, 1 pending) · Est. LOC: 150_

## Legend
<!-- severity: critical high medium low -->
<!-- category: bug perf refactor feature security debt docs -->

## Summary
The codebase is well-maintained with most TODO.md items already implemented. A new **dead-domains-check workflow** has been created to automate dead domain detection and PR creation. AGLint validation passes on all filter lists. **No inline TODO/FIXME/HACK/XXX/WARN/DEPRECATED markers were found** after comprehensive scanning.

### Items Implemented:
- [x] Dead domains check workflow created (`.github/workflows/dead-domains-check.yml`) - **T001 COMPLETED**
- [x] AGLint errors resolved (all filter lists pass validation)
- [x] Automated blocklist validity testing in `maintain-lists.yml`
- [x] CI/CD for automatic list updates in `build-filter-lists.yml`
- [x] Userscripts Bun migration already complete

### Items Remaining:
- Cross-file duplicates review (requires Python runtime)
- Bun migration for Python scripts (T002 pending)

---

## Task Index (topological order)

| # | ID | Title | Sev | Cat | Size | Status | Blocks |
|---|-----|-------|-----|-----|------|--------|--------|
| 1 | T001 | Dead domains check workflow | medium | feature | M | ✅ COMPLETED | - |
| 2 | T002 | Migrate Python scripts to Bun/JS | low | refactor | L | ⏳ Pending | - |

---

## Tasks

### T001 - Implement dead domains check workflow
**Status: COMPLETED** ✅
**File:** `.github/workflows/dead-domains-check.yml`
**Severity:** medium - **Category:** feature - **Size:** M
**Blocks:** -  **Blocked by:** -

**Context:**
TODO.md mentioned adding dead-domains-check workflow from LanikSJ/webannoyances

**Intent:** Automate detection of dead domains in filter lists and create PRs for review

**Acceptance criteria:**
- [x] Workflow runs on schedule (Monday 8 AM UTC)
- [x] Workflow can be triggered manually via workflow_dispatch
- [x] Dead domains are exported and logged
- [x] Previous automated PRs are closed before creating new ones
- [x] New branch `feature/dead-domains` is created
- [x] Changes are committed and pushed
- [x] PR is created with 'dead website' label

**Implementation:**
Created `.github/workflows/dead-domains-check.yml` based on LanikSJ/workflow with adaptations:
- Uses `oven-sh/setup-bun@v2` for Bun runtime
- Uses `jdx/mise-action@v4` for mise tool management
- Scans `lists/adblock/*.txt` and `lists/hostlist/*.txt`
- Uses `@adguard/dead-domains-linter` for detection
- Creates PR with automated review notes

---

### T002 - Migrate Python scripts to Bun/JS for CI portability
**File:** `Scripts/*.py`
**Severity:** low - **Category:** refactor - **Size:** L
**Blocks:** -  **Blocked by:** -

**Context:**
Python scripts (`update_lists.py`, `deduplicate.py`, `move_pure_domains.py`, `common.py`) require Python runtime not available in current CI environment

**Intent:** Enable CI portability by converting Python scripts to JavaScript/TypeScript

**Acceptance criteria:**
- [ ] Scripts rewritten in JS/TS
- [ ] Scripts work with Bun runtime
- [ ] All existing functionality preserved
- [ ] Tests migrated to Bun test format
- [ ] Scripts can be executed in CI without Python

**Implementation:**
Files to convert:
- `Scripts/update_lists.py` -> `Scripts/update_lists.ts` (async HTTP, file ops)
- `Scripts/deduplicate.py` -> `Scripts/deduplicate.ts` (text processing, deduplication)
- `Scripts/move_pure_domains.py` -> `Scripts/move_pure_domains.ts` (domain categorization)
- `Scripts/common.py` -> `Scripts/common.ts` (shared utilities)

Use Bun's native APIs:
- `Bun.file()` for file reading/writing
- `fetch()` for HTTP requests
- `async/await` for concurrency

---

## Inline Marker Analysis

A comprehensive scan for inline code markers was performed using the following patterns:
- `TODO`, `FIXME`, `HACK`, `XXX`
- `WARN`, `WARNING`, `DEPRECATED`, `NOTE`

**Result:** No inline markers found in the codebase.

This indicates the codebase is well-maintained with technical debt tracked at the project level via TODO.md rather than inline comments.

---

## Verification

All filter lists pass AGLint validation:
```bash
$ ./node_modules/.bin/aglint lists/adblock/*.txt
No problems found!

$ ./node_modules/.bin/aglint lists/hostlist/*.txt
No problems found!
```

---

_End of report._
