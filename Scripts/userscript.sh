#!/usr/bin/env bash
# shellcheck enable=all shell=bash source-path=SCRIPTDIR
set -euo pipefail; shopt -s nullglob globstar
IFS=$'\n\t' LC_ALL=C
has(){ command -v -- "$1" &>/dev/null; }

# Formatting
git add -A
if has oxlint; then
  oxlint --fix --fix-suggestions
fi
if has bunx; then
  bunx oxfmt@latest
elif has npx; then
  npx oxfmt@latest
fi
if has biome; then
  biome check --fix --unsafe --skip-parse-errors --no-errors-on-unmatched --html-formatter-line-width=120 --css-formatter-line-width=120 --json-formatter-line-width=120 \
  --use-editorconfig=true --indent-style=space --format-with-errors=true --files-ignore-unknown=true --vcs-use-ignore-file=false "$PWD"
fi
if has ruff; then 
  ruff format --line-length 120 --target-version py311 "$PWD"
fi
has yamlfmt && { yamlfmt -continue_on_error "*.yaml"; yamlfmt -continue_on_error "*.yml"; }
has shellharden && { shellharden --replace ./*.sh || :; shellharden --replace ./*.bash || :; shellharden --replace ./*.zsh || :; }
# Git
git maintenance run --quiet --task=prefetch --task=gc --task=loose-objects --task=incremental-repack --task=pack-refs --task=reflog-expire --task=rerere-gc --task=worktree-prune &>/dev/null || :
git add -A
git commit -q -m "Format & Lint" &>/dev/null && git push --recurse-submodules=on-demand --prune

# vim:set sw=2 ts=2 ft=sh et:
