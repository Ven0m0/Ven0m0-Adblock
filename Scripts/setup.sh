#!/usr/bin/env bash
set -euo pipefail; shopt -s nullglob globstar
IFS=$'\n\t'; 
export LC_ALL=C LANG=C
builtin cd -P -- "$(dirname -- "${BASH_SOURCE[0]:-}")" && printf '%s\n' "$PWD" || exit 1
[[ $EUID -ne 0 ]] && sudo -v; sync

# [FIX] Properly detect Home directory instead of hardcoding /home/
if [[ -n "${SUDO_USER:-}" ]]; then
  # If running as sudo, try to get the target user's configured home
  HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
fi
# Fallback to current HOME if getent failed or not running as sudo
export HOME="${HOME:-/home/${SUDO_USER:-$USER}}"

has(){ command -v -- "$1" &>/dev/null; }

if has mise; then
  has bun && export MISE_NPM_BUN=true
  mise use -g minify
  mise use -g npm:@adguard/aglint
  mise use -g npm:@adguard/hostlist-compiler
  mise use -g npm:@adguard/dead-domains-linter
  mise up -y; mise reshim
elif has bun; then
  bun i -g @adguard/aglint
  bun i -g @adguard/hostlist-compiler
  bun i -g @adguard/dead-domains-linter
elif has npm; then
  npm i -g @adguard/aglint
  npm i -g @adguard/hostlist-compiler
  npm i -g @adguard/dead-domains-linter
fi

has esbuild || npm install --save-exact --save-dev esbuild
