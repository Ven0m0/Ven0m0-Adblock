#!/usr/bin/env bash
set -euo pipefail
Y=$'\e[33m' N=$'\e[0m'
printf '%b⚠ DEPRECATED: Use ./build-all.sh userscripts%b\n' "$Y" "$N" >&2
[[ -f build-all.sh ]] && exec ./build-all.sh userscripts "$@"
printf 'build-all.sh not found\n' >&2; exit 1
