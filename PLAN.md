# Implementation Plan

Generated: 2026-09-18 · 5 tasks · Est. 850–1700 LOC

## Summary

Three items from the previous plan (old T001, T005, T006) were verified against the current
repository state and found already resolved: `Scripts/test_update_lists.py:88` no longer
carries the stale `NOTE`, `lists/adblock/Other.txt:21` already uses the structured
"Blogroll / RSS widgets" comment, and `docs/ext.md` already documents an integrated/rejected
evaluation of upstream blocklists with `shadowwhisperer-ads.txt` wired into
`lists/sources-urls.json`. Those three tasks are dropped from this plan.

Two items were merged in from `TODO.md`. The first is an active, user-reported bug: Reddit's
page and login break when `lists/adblock/Combination-desktop.txt` is loaded, traced to a
redundant/overshadowing rule pair in `lists/adblock/General.txt:41-42` that blocks
`accounts.google.com` unconditionally on every domain, including reddit.com, breaking
Reddit's Google sign-in widget. The second is a new tooling task: port the redundancy-detection
concepts from `abpvn/abp-rule-checker` (a browser-only mirror of arestwo.org's rule checker,
GPL-3.0, not an installable package) into a native Bun/JS lint script wired into a new opt-in
`bun run lint:redundancy` and a report-only GitHub workflow — the same class of bug the Reddit
fix addresses (an exception rule permanently shadowed by a broader one) is exactly what this
checker is designed to catch going forward.

The remaining backlog (cross-file dedupe, Python-to-Bun migration, performance-booster
userscript) is carried over unchanged aside from renumbering.

## Task Index (topological order)

1. **T001** (high, bug, S) - Fix Reddit login/page breakage caused by General.txt accounts.google.com block
2. **T002** (medium, feature, M) - Implement redundancy checking via abpvn/abp-rule-checker
3. **T003** (medium, refactor, L) - Consolidate cross-file duplicate filter rules
4. **T004** (high, refactor, XL) - Migrate Python tooling to Bun/JS for CI portability
5. **T005** (medium, feature, XL) - Implement performance booster userscript

## Tasks

### T001 - Fix Reddit login/page breakage caused by General.txt accounts.google.com block

**File:** `lists/adblock/General.txt:41-42`

**Severity:** high · **Category:** bug · **Size:** S

**Context:**

```adblock
37: @@||accounts.google.com^$domain=chromium.org|gstatic.com|googleusercontent.com|youtube.com
...
41: ||accounts.google.com^$3p
42: ||accounts.google.com^$3p,domain=~youtube.com|~twitter.com|~x.com
```

**Intent:** `lists/adblock/Combination-desktop.txt:9-14` includes `General.txt`, `Other.txt`,
`Reddit.txt`, `Search-Engines.txt`, `Youtube.txt`, and `Twitch.txt`. None of the non-Reddit
files contain any reddit.com-specific rule, so the breakage reported in `TODO.md` is an
interaction between a *generic* rule and Reddit's page, not a `Reddit.txt` bug. `General.txt:41`
blocks `accounts.google.com` as third-party unconditionally on every domain, which makes the
domain-scoped exclusion on `General.txt:42` dead code — its `~youtube.com|~twitter.com|~x.com`
carve-out can never take effect while line 41 already blocks everywhere. Reddit embeds Google
Identity Services (One Tap / "Continue with Google") on its base page and login flow; the
request to `accounts.google.com` gets blocked, and the resulting unhandled failure breaks both
the sign-in widget and general page hydration. `reddit.com` is absent from every exclusion list
on lines 37 and 42.

**Acceptance criteria:**

- [ ] Delete the unconditional `||accounts.google.com^$3p` rule at `General.txt:41`.
- [ ] Extend the domain modifier on the remaining rule (`General.txt:42`) to exclude
      `reddit.com` in addition to the existing exclusions.
- [ ] Manually verify with `Combination-desktop.txt` loaded in uBlock Origin/AdGuard: reddit.com
      renders normally and "Continue with Google" / Google One Tap completes without
      `accounts.google.com` appearing as blocked in devtools' network panel.
- [ ] Run `bun run lint:filters` to confirm no AGLint regressions.
- [ ] Run `bun run build:adblock` to confirm `Combination-desktop.txt` still compiles cleanly.

**Implementation:**

```adblock
! (delete line 41 entirely)
||accounts.google.com^$3p,domain=~reddit.com|~twitter.com|~x.com|~youtube.com
```

---

### T002 - Implement redundancy checking via abpvn/abp-rule-checker

**File:** `package.json`, new `Scripts/check-redundant-rules.mjs`, new
`.github/workflows/redundancy-check.yml`

**Severity:** medium · **Category:** feature · **Size:** M

**Context:**

`abpvn/abp-rule-checker` (GPL-3.0, license-compatible with this repo) is a mirror of
arestwo.org's `redundantRuleChecker.html` — a browser-only tool, not an npm package or CLI.
Its source files (`redundant.js`, `similar.js`, `onlyDomainDiffers.js`,
`findWhitelistRules.js`, `hidingToBlocking.js`) implement pairwise rule-comparison heuristics
meant to run in-browser against pasted filter text. There is nothing to `bun add`; the repo's
existing `bun run lint:filters` (`@adguard/aglint`, see `.github/workflows/aglint.yml`) only
checks syntax, not cross-rule semantic redundancy.

**Intent:** Port the two highest-value checks from abp-rule-checker into a small, native
Bun/Node script rather than vendoring the whole web app (YAGNI — the CSS-to-blocking converter
and domain-table generator are not needed here):

1. **Domain-only-diff / shadowed-rule detection** (`onlyDomainDiffers.js` concept): flag a
   rule that is fully covered by a broader, already-present rule with the same body but a
   wider (or absent) domain scope.
2. **Whitelist/exception conflict detection** (`findWhitelistRules.js` concept): flag an
   unconditional `@@` or blocking rule that permanently shadows a more specific, narrower
   rule elsewhere in the same file set — the exact pattern fixed in T001
   (`General.txt:41` shadowing `General.txt:42`).

**Acceptance criteria:**

- [ ] Add `Scripts/check-redundant-rules.mjs` implementing the two checks above, taking a
      list of filter file paths as arguments and printing `file:line — reason — rule text`
      for each finding.
- [ ] Add `"lint:redundancy": "bun run Scripts/check-redundant-rules.mjs lists/adblock/*.txt lists/hostlist/*.txt"`
      to `package.json` `scripts`. Do not add it to the main `lint` chain yet (semantic
      redundancy checks are heuristic and can false-positive; keep it opt-in, same pattern as
      any manual-dispatch lint step).
- [ ] Add `.github/workflows/redundancy-check.yml`, modeled on the existing
      `workflow_dispatch`-only trigger style in `.github/workflows/aglint.yml`, running
      `bun run lint:redundancy` and posting findings via `core.warning` (non-blocking,
      report-only — do not fail the job on findings).
- [ ] Run the checker once against the current `lists/adblock/*.txt` as a smoke test and
      confirm it surfaces the `General.txt:41`/`:42` pattern fixed in T001 (validates the
      detector actually works before relying on it).
- [ ] `bun run lint:js` passes on the new script (Biome/oxlint).

**Implementation:**

```javascript
// Scripts/check-redundant-rules.mjs
import { readFileSync } from "node:fs";

function parseDomainModifier(rule) {
  const m = rule.match(/\$.*?domain=([^,]+)/);
  return m ? m[1] : null;
}

function findShadowedRules(rules) {
  // group by rule body with domain= stripped; flag narrower-domain rules
  // that are unreachable because a broader/no-domain rule with the same
  // body already appears earlier in the same file set.
  const findings = [];
  const seenBroad = new Map();
  for (const { file, line, text } of rules) {
    const body = text.replace(/\$.*?domain=[^,]+,?/, "$");
    const domain = parseDomainModifier(text);
    if (!domain && !seenBroad.has(body)) {
      seenBroad.set(body, { file, line });
    } else if (domain && seenBroad.has(body)) {
      findings.push({ file, line, reason: "shadowed by broader rule", text, shadowedBy: seenBroad.get(body) });
    }
  }
  return findings;
}
```

---

### T003 - Consolidate cross-file duplicate filter rules

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

### T004 - Migrate Python tooling to Bun/JS for CI portability

**File:** `docs/TODO.md:7`

**Severity:** high · **Category:** refactor · **Size:** XL

**Intent:** Eliminate the Python runtime dependency from CI by rewriting tooling in
JavaScript/TypeScript and executing it with Bun. `T002`'s new
`Scripts/check-redundant-rules.mjs` is written directly in JS to avoid adding further
Python debt that this migration would only need to redo.

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

### T005 - Implement performance booster userscript

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
