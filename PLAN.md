# Implementation Plan

Generated: 2026-06-28 · 6 tasks · Est. 750–1550 LOC

## Summary

The repository contains six actionable markers across four files. The majority are documentation
TODOs in `docs/TODO.md` and `docs/ext.md`, plus one stale `NOTE` in a Python test and one
explanatory `NOTE` in a filter list. The highest-impact work is migrating Python tooling to
Bun/JS and implementing the planned performance-booster userscript, while lower-impact items
include deduplicating filter rules and evaluating upstream blocklist sources.

## Task Index (topological order)

1. **T001** (low, debt, S) - Remove stale NOTE from test_update_lists.py
2. **T006** (low, docs, S) - Convert filter-list NOTE into structured documentation
3. **T005** (low, feature, M) - Evaluate upstream blocklist sources for integration
4. **T002** (medium, refactor, L) - Consolidate cross-file duplicate filter rules
5. **T003** (high, refactor, XL) - Migrate Python tooling to Bun/JS for CI portability
6. **T004** (medium, feature, XL) - Implement performance booster userscript

## Tasks

### T001 - Remove stale NOTE from test_update_lists.py

**File:** `Scripts/test_update_lists.py:88`

**Severity:** low · **Category:** debt · **Size:** S

**Context:**

```python
    async def test_validate_checksum_valid(self):
        # NOTE: This test assumes validate_checksum has been refactored to accept string
        result = await update_lists.validate_checksum(self.valid_full_content)
        self.assertTrue(result)
```

**Intent:** The author left a warning that the test required `validate_checksum` to accept
a string argument; the refactor has already landed in `Scripts/update_lists.py:52`
(`async def validate_checksum(content: str, name: str = "unknown") -> bool`).

**Acceptance criteria:**

- [ ] Delete the `NOTE` comment on line 88.
- [ ] Run `uv run python -m unittest Scripts.test_update_lists` and confirm all tests pass.
- [ ] Verify `bun run lint` still succeeds.

**Implementation:**

```python
async def test_validate_checksum_valid(self):
    result = await update_lists.validate_checksum(self.valid_full_content)
    self.assertTrue(result)
```

---

### T006 - Convert filter-list NOTE into structured documentation

**File:** `lists/adblock/Other.txt:21`

**Severity:** low · **Category:** docs · **Size:** S

**Context:**

```adblock
! Generic Blocks
! NOTE: Blogroll generic
##.plugin-rss
##.blogroll-wrapper
```

**Intent:** The inline `NOTE` flags the following rules as generic blogroll selectors;
the same marker exists in the generated copy at `lists/sources/Other.txt:21`,
so only the hand-maintained `lists/adblock/Other.txt` should be edited.

**Acceptance criteria:**

- [ ] Keep or improve the explanatory comment in `lists/adblock/Other.txt:21`.
- [ ] Optionally add a `docs/filter-rules.md` entry describing the blogroll generic.
- [ ] Run `bun run lint:filters` and `bun run build` to confirm no regressions.

**Implementation:**

```adblock
! Generic Blocks
! Blogroll / RSS widgets (generic selectors)
##.plugin-rss
##.blogroll-wrapper
```

---

### T005 - Evaluate upstream blocklist sources for integration

**File:** `docs/ext.md:1`

**Severity:** low · **Category:** feature · **Size:** M

**Context:**

```markdown
### TODO:

- https://github.com/ShadowWhisperer/BlockLists
- https://github.com/AdguardTeam/AdGuardFilters
- https://github.com/easylist
- https://github.com/brave
- https://github.com/hagezi
- https://github.com/StevenBlack
- https://github.com/DandelionSprout/adfilt
```

**Intent:** Catalogue candidate upstream blocklist repositories and decide which lists
to consume in the build pipeline.

**Acceptance criteria:**

- [ ] Inspect each repository for available list URLs and licenses.
- [ ] Add selected source URLs to `lists/sources-urls.json` with descriptive names.
- [ ] Run `uv run python -m Scripts.update_lists` to verify downloads succeed.
- [ ] Update `docs/ext.md` to reflect integrated vs. rejected sources.

**Implementation:**

```json
{
  "sources": [
    {
      "name": "shadowwhisperer-ads",
      "url": "https://raw.githubusercontent.com/ShadowWhisperer/BlockLists/master/Lists/Ads"
    }
  ]
}
```

---

### T002 - Consolidate cross-file duplicate filter rules

**File:** `docs/TODO.md:6`

**Severity:** medium · **Category:** refactor · **Size:** L

**Context:**

```markdown
## Pending

- [x] Finish hostlist-compiler configs
- [ ] Review and consolidate cross-file duplicates in filter lists
- [ ] Migrate remaining Python scripts to Bun/JS for CI portability
```

**Intent:** Reduce maintenance overhead and output size by removing identical rules
that appear in multiple hand-maintained files under `lists/adblock/` and
`lists/hostlist/`.

**Acceptance criteria:**

- [ ] Identify duplicate rules across `lists/adblock/*.txt` and `lists/hostlist/*.txt`.
- [ ] Move duplicates to a single canonical location.
- [ ] Ensure no rule is lost and build outputs remain byte-identical or smaller.
- [ ] Run `bun run lint:filters` and `bun run build` successfully.
- [ ] Mark the item `[x]` in `docs/TODO.md:6` when complete.

**Implementation:**

```bash
uv run python -m Scripts.deduplicate --dry-run lists/adblock/*.txt
```

---

### T003 - Migrate Python tooling to Bun/JS for CI portability

**File:** `docs/TODO.md:7`

**Severity:** high · **Category:** refactor · **Size:** XL

**Intent:** Eliminate the Python runtime dependency from CI by rewriting tooling
in JavaScript/TypeScript and executing it with Bun.

**Acceptance criteria:**

- [ ] Provide JS/TS equivalents for all 10 Python files under `Scripts/`.
- [ ] Update `package.json` scripts so `bun run validate` works without Python.
- [ ] Update GitHub Actions workflows to drop Python setup steps.
- [ ] Ensure `bun run test` and `bun run build` pass.
- [ ] Mark the item `[x]` in `docs/TODO.md:7` when complete.

**Implementation:**

```javascript
// Scripts/common.js
export function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
```

---

### T004 - Implement performance booster userscript

**File:** `userscripts/src/TODO.md:1`

**Severity:** medium · **Category:** feature · **Size:** XL

**Context:**

```markdown
implement a userscript that merges the best parts of:
- https://greasyfork.org/en/scripts/506713-enhanced-faster-webpage-loading-optimized
- https://greasyfork.org/en/scripts/502818-hardware-acceleration-and-web-performance-enhancer
- https://greasyfork.org/en/scripts/549367-absolute-performance
- https://greasyfork.org/en/scripts/550646-background-web-optimizer-ultra-performance
- https://greasyfork.org/en/scripts/549600-performance-booster-pro
- https://greasyfork.org/en/scripts/549499-extremely-strong-efficiency-booster
```

**Intent:** Create a single userscript that combines lazy loading, link prefetching,
media optimization, optional network blocking, and a lightweight config UI.

**Acceptance criteria:**

- [ ] Create `userscripts/src/performance-booster.user.js` with metadata block.
- [ ] Implement lazy loading for `[data-src]` images/videos/iframes via `IntersectionObserver`.
- [ ] Implement same-origin link prefetching with a cap and auth-url exclusion.
- [ ] Add opt-in network blocking for analytics/tracker hosts.
- [ ] Run `bun run lint:js` and `bun run build:userscripts` successfully.

**Implementation:**

```javascript
// userscripts/src/performance-booster.user.js
const CONFIG = {
  lazyLoad: true,
  prefetchLinks: true,
  blockTrackers: false,
};
```
