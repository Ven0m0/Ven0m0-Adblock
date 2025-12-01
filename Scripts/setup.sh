#!/usr/bin/env bash
set -euo pipefail; shopt -s nullglob globstar
IFS=$'\n\t'; export HOME="/home/${SUDO_USER:-$USER}" LC_ALL=C LANG=C
builtin cd -P -- "$(dirname -- "${BASH_SOURCE[0]:-}")" && printf '%s\n' "$PWD" || exit 1
[[ $EUID -ne 0 ]] && sudo -v; sync

has(){ command -v -- "$1" &>/dev/null; }

if has bun; then
  bun i -g @adguard/dead-domains-linter
  bun i -g @adguard/aglint
  bun i -g @adguard/hostlist-compiler
elif has npm; then
  npm i -g @adguard/dead-domains-linter
  npm i -g @adguard/aglint
  npm i -g @adguard/hostlist-compiler
fi

has esbuild || npm install --save-exact --save-dev esbuild
