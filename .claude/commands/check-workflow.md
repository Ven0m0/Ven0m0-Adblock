---
description: Summarize the recent run status of a GitHub Actions workflow in this repo
argument-hint: <workflow-name>
---

Look up the recent run status of the workflow named `$ARGUMENTS` (match loosely against the filenames in `.github/workflows/`: `aglint.yml`, `automerge-open-prs.yml`, `build-filter-lists.yml`, `dead-domains-check.yml`, `dependabot-auto-merge.yml`, `lint-and-format.yml`, `maintain-lists.yml`, `pull_request.yml`, `update-lists.yml`, `userscripts.yml`).

Run:
```
gh run list --workflow=<matched-file> --limit 5
```

Then for the most recent run, if it failed:
```
gh run view <run-id> --log-failed
```

Report:
1. The matched workflow file
2. Status of the last 5 runs (success/failure, timestamp, trigger)
3. If the latest failed, the specific failing step and error
