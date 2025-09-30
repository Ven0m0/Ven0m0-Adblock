#!/usr/bin/env bash
#
# build-adblocklists.sh
# Compiles multiple source lists into a single, optimized adblock filter.
#
set -o errexit
set -o nounset
set -o pipefail

# --- Configuration ---
declare -a -r SRC_FILES=(
  "3rd-party.txt"
  "Combination-Minimal.txt"
  "Combination-No-YT"
  "Combination.txt"
  "Other.txt"
  "RedditAnnoyances.txt"
  "Search-Engines.txt"
  "SpotifyTweaks.txt"
  "TwitchTweaks.txt"
  "TwitterAnnoyances.txt"
  "YoutubeTweaks.txt"
)
declare -r OUT_FILE="Filters/filter.txt"
declare HEADER_INFO

# --- Main Logic ---

# Generate the header with current timestamp
# Using a here-string for readability and to avoid temp files.
HEADER_INFO=$(cat <<-EOF
[Adblock Plus 2.0]
! Title: Ven0m0's Adblock List
! Description: A combination of various ad-blocking and annoyance-fixing lists.
! Version: $(date -u +"%Y%m%d%H%M")
! Last Modified: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
! Homepage: https://github.com/ven0m0/ven0m0-adblock
! Syntax: Adblock Plus 2.0
!
EOF
)

echo "Compiling Adblock lists..."

# 1. Write the header to the output file
echo "$HEADER_INFO" > "$OUT_FILE"

# 2. Process and append content
# - Concatenate all source files
# - Use grep to filter out comments, empty lines, and the header marker
# - Sort and remove duplicates
# - Append to the output file
cat "${SRC_FILES[@]}" | \
  grep -v -E '^\s*!|\[Adblock Plus' | \
  grep -v -E '^\s*$' | \
  sort -u \
  >> "$OUT_FILE"

echo "Adblock list compilation complete: ${OUT_FILE}"
