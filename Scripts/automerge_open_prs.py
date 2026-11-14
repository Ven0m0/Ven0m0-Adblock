#!/usr/bin/env python3
"""Auto-merge open pull requests targeting the base branch.

Run from the repo root as `python -m Scripts.automerge_open_prs` so it can share `Scripts.common`.
"""

import json
import os
import subprocess
import sys

from Scripts.common import die, has

BASE_BRANCH = os.environ.get("BASE_BRANCH", "main")
MAX_CYCLES = int(os.environ.get("MAX_CYCLES", "100"))
BOT_NAME = os.environ.get("BOT_NAME", "github-actions[bot]")
BOT_EMAIL = os.environ.get("BOT_EMAIL", "41898282+github-actions[bot]@users.noreply.github.com")
# Empty = plain merge that aborts on conflict. Set "ours"/"theirs" only to knowingly resolve conflicts by discarding one side.
CONFLICT_STRATEGY = os.environ.get("CONFLICT_STRATEGY", "")
ALLOW_ADMIN_MERGE = os.environ.get("ALLOW_ADMIN_MERGE", "false").lower() == "true"
# mergeStateStatus values where required checks passed; anything else (UNSTABLE, BLOCKED, UNKNOWN) is not merged.
MERGEABLE_STATES = ("CLEAN", "HAS_HOOKS")


def _require(cmd: str) -> None:
    if not has(cmd):
        die(f"{cmd} is required")


def _run(*args: str, **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(list(args), check=True, **kwargs)


def _succeeds(*args: str) -> bool:
    """Run a command whose failure is an answer, not an error."""
    return subprocess.run(list(args), check=False).returncode == 0


def refresh_main() -> None:
    _run("git", "fetch", "origin", BASE_BRANCH, "--prune")
    if _succeeds("git", "show-ref", "--verify", "--quiet", f"refs/heads/{BASE_BRANCH}"):
        _run("git", "checkout", BASE_BRANCH)
    else:
        _run("git", "checkout", "-B", BASE_BRANCH, f"origin/{BASE_BRANCH}")
    _run("git", "reset", "--hard", f"origin/{BASE_BRANCH}")
    _run("git", "clean", "-fd")


def list_prs() -> list[dict]:
    result = subprocess.run(
        [
            "gh",
            "pr",
            "list",
            "--state",
            "open",
            "--base",
            BASE_BRANCH,
            "--limit",
            "100",
            "--json",
            (
                "number,title,isDraft,mergeStateStatus,headRefName,"
                "headRepository,headRepositoryOwner,isCrossRepository,maintainerCanModify"
            ),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def mark_ready(number: int) -> None:
    print(f"Marking PR #{number} ready for review")
    _run("gh", "pr", "ready", str(number))


def sync_branch(number: int, head_ref: str, head_owner: str, head_repo: str) -> bool:
    print(f"Updating PR #{number} branch with {BASE_BRANCH}")
    refresh_main()
    _run("gh", "pr", "checkout", str(number))
    strategy = ["-X", CONFLICT_STRATEGY] if CONFLICT_STRATEGY else []
    if not _succeeds("git", "merge", "--no-edit", *strategy, f"origin/{BASE_BRANCH}"):
        _succeeds("git", "merge", "--abort")
        return False
    _run(
        "git",
        "push",
        f"https://github.com/{head_owner}/{head_repo}.git",
        f"HEAD:{head_ref}",
    )
    return True


def merge_pr(number: int) -> bool:
    print(f"Merging PR #{number}")
    if _succeeds("gh", "pr", "merge", str(number), "--squash", "--delete-branch"):
        return True
    return ALLOW_ADMIN_MERGE and _succeeds("gh", "pr", "merge", str(number), "--admin", "--squash", "--delete-branch")


def main() -> None:
    _require("gh")
    _require("git")
    if not os.environ.get("GH_TOKEN"):
        die("GH_TOKEN is required")

    _run("git", "config", "user.name", BOT_NAME)
    _run("git", "config", "user.email", BOT_EMAIL)

    for cycle in range(1, MAX_CYCLES + 1):
        prs = sorted(list_prs(), key=lambda p: p["number"])
        print(f"Cycle {cycle}: {len(prs)} open PR(s) targeting {BASE_BRANCH}")

        if not prs:
            print("All open pull requests are merged.")
            return

        progress_made = False
        blocked: list[str] = []

        for pr in prs:
            number: int = pr["number"]
            title: str = pr["title"]
            is_draft: bool = pr.get("isDraft", False)
            merge_state: str = pr.get("mergeStateStatus") or "UNKNOWN"
            head_ref: str = pr.get("headRefName") or ""
            head_owner: str = (pr.get("headRepositoryOwner") or {}).get("login") or ""
            head_repo: str = (pr.get("headRepository") or {}).get("name") or ""
            is_cross: bool = pr.get("isCrossRepository", False)
            can_modify: bool = pr.get("maintainerCanModify", False)

            print(f"Evaluating PR #{number} ({title}) [draft={is_draft} state={merge_state}]")

            if is_draft:
                mark_ready(number)
                progress_made = True
                continue

            if not head_ref or not head_owner or not head_repo:
                blocked.append(f"PR #{number} is missing branch metadata required for auto-merge")
                continue

            if merge_state in ("DIRTY", "BEHIND"):
                if is_cross and not can_modify:
                    blocked.append(f"PR #{number} cannot be updated because maintainer edits are disabled")
                    continue
                if sync_branch(number, head_ref, head_owner, head_repo):
                    progress_made = True
                    continue
                blocked.append(f"PR #{number} could not be updated against {BASE_BRANCH}")
                continue

            if merge_state not in MERGEABLE_STATES:
                blocked.append(f"PR #{number} is {merge_state}, not merging until checks pass")
                continue

            if merge_pr(number):
                progress_made = True
                break
            blocked.append(f"PR #{number} could not be merged in its current state")

        if not progress_made:
            print(
                "::error::Unable to make merge progress. Remaining pull requests:",
                file=sys.stderr,
            )
            for pr in prs:
                print(
                    f"  #{pr['number']} {pr['title']} [draft={pr['isDraft']} state={pr.get('mergeStateStatus')}]",
                    file=sys.stderr,
                )
            if blocked:
                print("::error::Blocking conditions:", file=sys.stderr)
                for msg in blocked:
                    print(f"  {msg}", file=sys.stderr)
            sys.exit(1)

    print(
        f"::error::Reached {MAX_CYCLES} cycles without merging every open pull request",
        file=sys.stderr,
    )
    sys.exit(1)


if __name__ == "__main__":
    main()
