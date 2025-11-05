#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Only install if not already available
if ! command -v hostlist-compiler >/dev/null 2>&1; then
  npm i -g @adguard/hostlist-compiler
fi

# Compiling AdGuard DNS filter
mkdir -p Filters
hostlist-compiler -c hostlist-config.json -o Filters/filter.txt --verbose

# Compiling AdGuard DNS Popup Hosts filter
hostlist-compiler -c configuration_popup_filter.json -o Filters/adguard_popup_filter.txt --verbose
node scripts/popup_filter_build.js Filters/adguard_popup_filter.txt

hostlist-compiler -i 
