---
name: add-filter-rule
description: Add a new adblock or hostlist rule with duplicate check, correct file placement, and AGLint validation. Use when adding a domain, cosmetic rule, or exception to lists/adblock/ or lists/hostlist/.
---

When the user asks to add, block, or allowlist a domain/rule, collect (ask if not provided):
- The domain or the exact rule text
- Whether it's a network/cosmetic block (uBlock/AdGuard syntax) or a plain DNS block

## 1. Check for duplicates first

```
rg "<domain_or_rule>" lists/adblock/ lists/hostlist/
```

Report any exact match (already covered) or near-duplicate (same domain, different modifier or a redundant `@@` exception) before writing anything.

## 2. Pick the file

- Network rule (`||domain.tld^`) or cosmetic rule (`domain##.selector`) → `lists/adblock/`, in the topically closest existing file (e.g. `Reddit.txt`, `Youtube.txt`, `Twitch.txt`, `Spotify.txt`, `Twitter.txt`, `Search-Engines.txt`); use `General.txt` or `Other.txt` if nothing fits.
- Plain DNS-level domain block → `lists/hostlist/`, in the topically closest file (`Ads.txt`, `Social-Media.txt`, `Native.txt`, etc); use `Other.txt` if nothing fits. Hostlist entries must be a bare domain — no scheme, no path, no wildcard.
- Never write to `lists/sources/` or `lists/releases/` — those are CI-generated (see `AGENTS.md`).

## 3. Insert

Group the new rule with an explanatory `! comment` above it if it doesn't obviously belong with an existing block. Keep one rule per line.

## 4. Validate

```
bun x @adguard/aglint <file>
```

Fix any reported syntax errors before finishing. Confirm the final placement and rule to the user.
