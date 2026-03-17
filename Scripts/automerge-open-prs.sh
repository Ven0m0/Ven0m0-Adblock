#!/usr/bin/env bash
set -Eeuo pipefail

readonly BASE_BRANCH="${BASE_BRANCH:-main}"
readonly MAX_CYCLES="${MAX_CYCLES:-100}"
readonly BOT_NAME="${BOT_NAME:-github-actions[bot]}"
readonly BOT_EMAIL="${BOT_EMAIL:-41898282+github-actions[bot]@users.noreply.github.com}"
readonly CONFLICT_STRATEGY="${CONFLICT_STRATEGY:-ours}"
readonly ALLOW_ADMIN_MERGE="${ALLOW_ADMIN_MERGE:-true}"

command -v gh >/dev/null || { printf 'gh is required\n' >&2; exit 1; }
command -v git >/dev/null || { printf 'git is required\n' >&2; exit 1; }
command -v jq >/dev/null || { printf 'jq is required\n' >&2; exit 1; }
[[ -n ${GH_TOKEN:-} ]] || { printf 'GH_TOKEN is required\n' >&2; exit 1; }

git config user.name "$BOT_NAME"
git config user.email "$BOT_EMAIL"

refresh_main() {
  git fetch origin "$BASE_BRANCH" --prune
  if git show-ref --verify --quiet "refs/heads/$BASE_BRANCH"; then
    git checkout "$BASE_BRANCH"
  else
    git checkout -B "$BASE_BRANCH" "origin/$BASE_BRANCH"
  fi
  git reset --hard "origin/$BASE_BRANCH"
  git clean -fd
}

list_prs() {
  gh pr list \
    --state open \
    --base "$BASE_BRANCH" \
    --limit 100 \
    --json number,title,isDraft,mergeStateStatus,headRefName,headRepository,headRepositoryOwner,isCrossRepository,maintainerCanModify
}

mark_ready() {
  local number=$1

  printf 'Marking PR #%s ready for review\n' "$number"
  gh pr ready "$number"
}

sync_branch() {
  local number=$1 head_ref=$2 head_owner=$3 head_repo=$4

  printf 'Updating PR #%s branch with %s\n' "$number" "$BASE_BRANCH"
  refresh_main
  gh pr checkout "$number"
  if ! git merge --no-edit -X "$CONFLICT_STRATEGY" "origin/$BASE_BRANCH"; then
    git merge --abort || :
    return 1
  fi
  git push "https://github.com/$head_owner/$head_repo.git" "HEAD:$head_ref"
}

merge_pr() {
  local number=$1

  printf 'Merging PR #%s\n' "$number"
  if gh pr merge "$number" --squash --delete-branch; then
    return 0
  fi
  if [[ $ALLOW_ADMIN_MERGE == "true" ]]; then
    gh pr merge "$number" --admin --squash --delete-branch
    return $?
  fi
  return 1
}

for ((cycle=1; cycle<=MAX_CYCLES; cycle++)); do
  prs_json=$(list_prs)
  prs_count=$(jq 'length' <<< "$prs_json")
  printf 'Cycle %s: %s open PR(s) targeting %s\n' "$cycle" "$prs_count" "$BASE_BRANCH"

  if (( prs_count == 0 )); then
    printf 'All open pull requests are merged.\n'
    exit 0
  fi

  progress_made=false
  blocked_prs=()

  while IFS= read -r pr; do
    [[ -n $pr ]] || continue

    number=$(jq -r '.number' <<< "$pr")
    title=$(jq -r '.title' <<< "$pr")
    is_draft=$(jq -r '.isDraft' <<< "$pr")
    merge_state=$(jq -r '.mergeStateStatus // "UNKNOWN"' <<< "$pr")
    head_ref=$(jq -r '.headRefName // empty' <<< "$pr")
    head_owner=$(jq -r '.headRepositoryOwner.login // empty' <<< "$pr")
    head_repo=$(jq -r '.headRepository.name // empty' <<< "$pr")
    is_cross_repo=$(jq -r '.isCrossRepository // false' <<< "$pr")
    maintainer_can_modify=$(jq -r '.maintainerCanModify // false' <<< "$pr")

    printf 'Evaluating PR #%s (%s) [draft=%s state=%s]\n' "$number" "$title" "$is_draft" "$merge_state"

    if [[ $is_draft == "true" ]]; then
      mark_ready "$number"
      progress_made=true
      continue
    fi

    if [[ -z $head_ref || -z $head_owner || -z $head_repo ]]; then
      blocked_prs+=("PR #$number is missing branch metadata required for auto-merge")
      continue
    fi

    if [[ $merge_state == "DIRTY" || $merge_state == "BEHIND" ]]; then
      if [[ $is_cross_repo == "true" && $maintainer_can_modify != "true" ]]; then
        blocked_prs+=("PR #$number cannot be updated because maintainer edits are disabled")
        continue
      fi

      if sync_branch "$number" "$head_ref" "$head_owner" "$head_repo"; then
        progress_made=true
        continue
      fi
      blocked_prs+=("PR #$number could not be updated against $BASE_BRANCH")
      continue
    fi

    if merge_pr "$number"; then
      progress_made=true
      break
    fi
    blocked_prs+=("PR #$number could not be merged in its current state")
  done < <(jq -c 'sort_by(.number)[]' <<< "$prs_json")

  if [[ $progress_made != "true" ]]; then
    printf '::error::Unable to make merge progress. Remaining pull requests:\n' >&2
    jq -r '.[] | "  #\(.number) \(.title) [draft=\(.isDraft) state=\(.mergeStateStatus)]"' <<< "$prs_json" >&2
    if (( ${#blocked_prs[@]} > 0 )); then
      printf '::error::Blocking conditions:\n' >&2
      printf '  %s\n' "${blocked_prs[@]}" >&2
    fi
    exit 1
  fi
done

printf '::error::Reached %s cycles without merging every open pull request\n' "$MAX_CYCLES" >&2
exit 1
