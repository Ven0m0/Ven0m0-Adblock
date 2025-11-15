#!/bin/bash
# OPTIMIZED: Fixed incomplete command and added error handling

# Exit immediately if a command exits with a non-zero status
set -euo pipefail

# Only install if not already available
if ! command -v hostlist-compiler >/dev/null 2>&1; then
  printf 'Installing hostlist-compiler...\n'
  npm i -g @adguard/hostlist-compiler || {
    printf 'Failed to install hostlist-compiler\n' >&2
    exit 1
  }
fi

# Compiling AdGuard DNS filter
mkdir -p Filters || { printf 'Failed to create Filters directory\n' >&2; exit 1; }

if [[ -f hostlist-config.json ]]; then
  printf 'Building main filter...\n'
  hostlist-compiler -c hostlist-config.json -o Filters/filter.txt --verbose
else
  printf 'Warning: hostlist-config.json not found, skipping main filter\n' >&2
fi

# Compiling AdGuard DNS Popup Hosts filter
if [[ -f configuration_popup_filter.json ]]; then
  printf 'Building popup filter...\n'
  hostlist-compiler -c configuration_popup_filter.json -o Filters/adguard_popup_filter.txt --verbose

  if [[ -f scripts/popup_filter_build.js ]]; then
    node scripts/popup_filter_build.js Filters/adguard_popup_filter.txt
  fi
else
  printf 'Warning: configuration_popup_filter.json not found, skipping popup filter\n' >&2
fi

# FIXED: This line was incomplete - now shows hostlist-compiler info
printf 'Hostlist compiler version:\n'
hostlist-compiler --version 2>/dev/null || printf 'Version info not available\n' 
