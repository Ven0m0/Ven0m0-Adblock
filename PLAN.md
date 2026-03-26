# Implementation Plan
_Generated: 2026-03-26T00:00:00Z · 0 tasks · Est. LOC: 0_

## Legend
<!-- severity: 🔴 critical 🟠 high 🟡 medium 🔵 low -->
<!-- category: bug perf refactor feature security debt docs -->

## Summary
This codebase contains **no significant TODO/FIXME/HACK/XXX/WARN/DEPRECATED markers** in actual source code. The repository primarily consists of:

- **Filter lists** (adblock syntax `.txt` files) — uses `!` comments, not code markers
- **Python build scripts** — clean, well-structured, minimal comments
- **Shell scripts** — POSIX-compliant with proper error handling
- **Userscripts** — header-based metadata, no inline TODOs
- **GitHub Actions** — YAML configuration, no code markers

### Items Found (non-actionable):

| Location | Marker | Type | Notes |
|----------|--------|------|-------|
| `mise.toml:36` | `NODE_NO_WARNINGS = "1"` | Config | Environment variable, NOT a TODO |
| `TODO.md:1,47` | `# TODO` | Doc | Planning document, not code marker |
| `lists/ext.md:1` | `### TODO:` | Doc | External sources research notes |
| `lists/adblock/Other.txt:21` | `! NOTE: Blogroll generic` | Filter | Adblock comment syntax |
| `lists/sources/Other.txt:21` | `! NOTE: Blogroll generic` | Filter | Generated/source mirror |
| `Scripts/test_update_lists.py:58` | `# NOTE:` | Test | Test assumption note (see below) |

---

## Tasks

_No tasks generated._

### T001 · Clarify test assumption for validate_checksum refactor
**File:** `Scripts/test_update_lists.py:58`
**Severity:** 🔵 low · **Category:** docs · **Size:** S
**Blocks:** —  **Blocked by:** —

**Context:**
```python
# NOTE: This test assumes validate_checksum has been refactored to accept string
```

**Intent:** Documents that `validate_checksum()` was refactored to accept a string parameter instead of a file path. This is a **completed** refactor — the function at `Scripts/update_lists.py:52` already accepts `(content: str, name: str)`.

**Acceptance criteria:**
- [x] Function signature confirmed: `def validate_checksum(content: str, name: str = "unknown") -> bool`
- [x] All tests pass with string input

**Implementation:**
_Not applicable — this NOTE documents a past refactor that is already complete._

---

## Notes for Future Development

The `TODO.md` file contains planning items that could be turned into future tasks:

1. **Research/Integration items:**
   - Integrate StevenBlack/hosts automation scripts
   - Implement AdGuardTeam/Scriptlets
   - Add dead-domains-check workflow from LanikSJ/webannoyances

2. **Manual Review Needed:**
   - Review 348 cross-file duplicates found by `deduplicate.py`
   - Fix AGLint errors in filter lists:
     - if/endif directive mismatches (Reddit.txt, Search-Engines.txt, Twitch.txt, Youtube.txt)
     - IPv6 domain values in lan-block.txt
     - Empty modifiers in hostlist files
     - Invalid CSS syntax in Other.txt
     - Unsupported modifiers in URLShortener.txt

3. **Future Improvements:**
   - Consolidate cross-file duplicates
   - Add automated blocklist validity testing
   - Set up CI/CD for automatic list updates

4. **Userscripts:**
   - Bun migration for building/bundling documented in TODO.md

---

## Deprecation & Technical Debt Assessment

**None identified.** This codebase exhibits:
- ✅ No deprecated API usage
- ✅ No security-sensitive TODOs
- ✅ No known bug markers (FIXME/HACK/XXX)
- ✅ Clean error handling throughout
- ✅ Transactional file operations (see `Scripts/common.py:95-107`)

---

_End of report._
