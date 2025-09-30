#!/usr/bin/env bash
#
# build-hostlists.sh
# Compiles source text files into a single, optimized hosts file.
#
set -o errexit
set -o nounset
set -o pipefail

# --- Configuration ---
# All .txt files are potential sources, edit this array to be more specific if needed
declare -a -r SRC_FILES=(
  "3rd-party.txt"
  "Other.txt"
)
declare -r OUT_FILE="hosts.txt"
declare HEADER_INFO

# --- Main Logic ---
HEADER_INFO=$(cat <<-EOF
# Hostlist compiled by ven0m0/ven0m0-adblock
#
# Last Updated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
#
#<---------------------------------------------------------------->
#
EOF
)

echo "Compiling Hostlists..."

# 1. Write header
echo "$HEADER_INFO" > "$OUT_FILE"

# 2. Process and append hosts
# - Cat all source files
# - Grep for lines that look like hostnames (basic regex)
# - Remove comments and extraneous characters
# - Prepend with 0.0.0.0
# - Sort and remove duplicates
# - Append to the output file
cat "${SRC_FILES[@]}" | \
  grep -o -E '([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}' | \
  awk '{print "0.0.0.0 " $1}' | \
  sort -u \
  >> "$OUT_FILE"

echo "Hostlist compilation complete: ${OUT_FILE}"
