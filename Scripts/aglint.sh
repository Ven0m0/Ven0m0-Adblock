#!/usr/bin/env bash
# AGLint setup and execution script
# Installs AGLint if needed, initializes config, and runs linting on filter lists
# shellcheck enable=all shell=bash source-path=SCRIPTDIR
set -euo pipefail; shopt -s nullglob globstar
IFS=$'\n\t' LC_ALL=C
readonly SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib-common.sh
. "${SCRIPT_DIR}/lib-common.sh"

[[ -f package.json ]] || bun init -y
bun list @adguard/aglint &>/dev/null || { log info "Installing @adguard/aglint"; bun i -g @adguard/aglint || { err "Install failed"; exit 1; }; }
[[ -f .aglintrc.yaml ]] || { log info "Init config"; bunx --bun aglint init; }
s=$(bun pkg get scripts.lint 2>/dev/null || echo '""')
[[ $s == '""' || $s == "undefined" ]] && npm pkg set scripts.lint=aglint
log info "Running lint"
bun run lint
ok "Complete"
