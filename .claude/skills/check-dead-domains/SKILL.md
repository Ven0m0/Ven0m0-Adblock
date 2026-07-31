---
name: check-dead-domains
description: Locally check filter and hostlist domains for dead/unreachable entries before pushing, mirroring dead-domains-check.yml. Use before a PR touching lists/adblock/ or lists/hostlist/ to catch dead domains ahead of CI.
---

Reproduces `.github/workflows/dead-domains-check.yml` locally instead of waiting for the scheduled CI run.

## 1. Install the linter (if not already global)

```
bun add -g @adguard/dead-domains-linter
```

## 2. Export dead domains per changed file

For each changed file under `lists/adblock/` or `lists/hostlist/`:

```
bunx dead-domains-linter --export dead-domains/<basename>.txt --input <file>
```

## 3. Review

```
cat dead-domains/*.txt 2>/dev/null | sort -u
```

Report each candidate dead domain to the user before removing anything — the linter flags low-traffic sites as false positives sometimes (per the workflow's own PR body caveat).

## 4. Apply removal (only after confirmation)

```
bunx dead-domains-linter --auto --import dead-domains/<basename>.txt --input <file> --output <file>
```

## 5. Clean up

```
rm -rf dead-domains dead-domains.txt
```

Don't commit the `dead-domains/` scratch output — it's already `.gitignore`d by the CI workflow's own convention.
