#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'; export LC_ALL=C LANG=C
has(){ command -v "$1" &>/dev/null; }
has hostlist-compiler || { printf 'Installing hostlist-compiler...\n'; npm i -g @adguard/hostlist-compiler || { printf 'Install failed\n' >&2; exit 1; }; }
mkdir -p Filters
[[ -f hostlist-config.json ]] && { printf 'Building main filter...\n'; hostlist-compiler -c hostlist-config.json -o Filters/filter.txt --verbose; } || printf 'Warning: hostlist-config.json not found\n' >&2
[[ -f configuration_popup_filter.json ]] && {
  printf 'Building popup filter...\n'
  hostlist-compiler -c configuration_popup_filter.json -o Filters/adguard_popup_filter.txt --verbose
  [[ -f scripts/popup_filter_build.js ]] && node scripts/popup_filter_build.js Filters/adguard_popup_filter.txt
} || printf 'Warning: configuration_popup_filter.json not found\n' >&2
hostlist-compiler --version 2>/dev/null || printf 'Version: n/a\n'
