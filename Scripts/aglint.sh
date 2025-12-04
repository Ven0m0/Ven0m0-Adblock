#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'; export LC_ALL=C LANG=C
D=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
[[ -f $D/lib-common.sh ]] && . "$D/lib-common.sh" || {
  log(){ printf '[%s] %s\n' "$1" "${*:2}"; }
  ok(){ printf '✓ %s\n' "$*"; }
  err(){ printf '✗ %s\n' "$*" >&2; }
}
[[ -f package.json ]] || bun init -y
bun list @adguard/aglint &>/dev/null || { log info "Installing @adguard/aglint"; bun i -g @adguard/aglint || { err "Install failed"; exit 1; }; }
[[ -f .aglintrc.yaml ]] || { log info "Init config"; bunx --bun aglint init; }
s=$(bun pkg get scripts.lint 2>/dev/null || echo '""')
[[ $s == '""' || $s == "undefined" ]] && npm pkg set scripts.lint=aglint
log info "Running lint"
bun run lint
ok "Complete"
