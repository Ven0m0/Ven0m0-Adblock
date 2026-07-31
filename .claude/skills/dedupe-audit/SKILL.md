---
name: dedupe-audit
description: Run the deduplication scripts across filter and hostlist files and review the diff before committing. Use for a periodic full-repo dedup pass, mirroring what maintain-lists.yml does automatically.
---

This reproduces the dedup steps from `.github/workflows/maintain-lists.yml` locally so the diff can be reviewed before it lands via automation.

## 1. Deduplicate adblock/source filter lists

```
PYTHONPATH=. python3 Scripts/deduplicate.py lists/sources
```

## 2. Deduplicate hostlists

Hostlist dedup strips comments/blank lines and normalizes `0.0.0.0 ` prefixes before sorting uniquely — reproduce it per file:

```bash
for f in lists/hostlist/*.txt; do
  tmp=$(mktemp)
  sed -E '/^@@|^#|^[[:space:]]*$/d; s/^0\. 0\.0\.0[[:space:]]+//; s/^[[:space:]]+//; s/[[:space:]]+$//' "$f" \
    | awk 'NF && ! seen[$0]++' | sort -u > "$tmp"
  [[ -s "$tmp" ]] && mv "$tmp" "$f" || rm -f "$tmp"
done
```

## 3. Cross-check `lists/adblock/`

`Scripts/deduplicate.py` targets `lists/sources`; run the same duplicate check against the hand-maintained `lists/adblock/` files too, since those aren't touched by CI automation:

```
PYTHONPATH=. python3 Scripts/deduplicate.py lists/adblock
```

## 4. Review before committing

```
git diff --stat lists/
```

Walk through the diff — flag anything that looks like an unintended removal (a rule that only *looked* like a duplicate, e.g. same domain with a different `$` modifier) rather than staging blindly.
