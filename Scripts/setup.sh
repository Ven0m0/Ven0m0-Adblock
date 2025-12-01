#!/usr/bin/env bash
set -euo pipefail; shopt -s nullglob globstar
IFS=$'\n\t'; export HOME="/home/${SUDO_USER:-$USER}" LC_ALL=C LANG=C
builtin cd -P -- "$(dirname -- "${BASH_SOURCE[0]:-}")" && printf '%s\n' "$PWD" || exit 1
[[ $EUID -ne 0 ]] && sudo -v; sync

has(){ command -v -- "$1" &>/dev/null; }

if has bun; then
  bun i -g @adguard/dead-domains-linter || bun update -g --latest @adguard/dead-domains-linter
elif has npm; then
  npm i -g @adguard/dead-domains-linter || npm update -g @adguard/dead-domains-linter
fi

