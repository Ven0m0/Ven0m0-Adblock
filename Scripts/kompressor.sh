#!/usr/bin/env bash
# Purpose: Deduplicate files and clean text content (sort/uniq/strip comments)
# Targets: Arch/Wayland, Debian, Termux
# Deps: md5sum, sort, sed, file (coreutils); optional: fd, inotify-tools (for -w)
set -euo pipefail
IFS=$'\n\t'
# --- Configuration ---
DIR="${1:-.}"
WATCH=0

# --- Arg Parsing ---
for arg in "$@"; do
  [[ "$arg" =~ ^(-w|--watch)$ ]] && WATCH=1
  [[ -d "$arg" ]] && DIR="$arg"
done
[[ ! -d "$DIR" ]] && { printf "Error: '%s' is not a directory.\n" "$DIR" >&2; exit 1; }

# --- Helpers ---
# Select finder: fd (fast) > find (standard)
if command -v fd &>/dev/null; then
  list_files(){ fd --type f . "$1"; }
  hash_files(){ fd --type f --exec md5sum {} . "$1"; }
else
  list_files(){ find "$1" -type f; }
  hash_files(){ find "$1" -type f -exec md5sum {} +; }
fi

# --- Core Logic ---
dedupe_files(){
  printf "Scanning for file duplicates in '%s'...\n" "$DIR"
  local -A seen; local hash file
  # Stream md5sum output: "hash  filename"
  while read -r line; do
    hash="${line%%  *}"; file="${line#* }"
    if [[ -n "${seen[$hash]:-}" ]]; then
      printf "rm duplicate: %s (keeps %s)\n" "$file" "${seen[$hash]}"
      rm -f "$file"
    else
      seen[$hash]="$file"
    fi
  done < <(hash_files "$DIR" | sort -k1,1)
}

process_content(){
  local file="$1"
  [[ ! -f "$file" ]] && return
  # Safety: Skip non-text files to prevent corruption
  local mime=$(file -b --mime-type "$file")
  [[ "$mime" != text/* && "$mime" != application/json ]] && return
  # Logic: Strip comments (#, //), empty lines, sort unique
  local tmp=$(mktemp)
  if sed -E '/^[[:blank:]]*(\/\/|#|$)/d' "$file" | sort -u > "$tmp"; then
    mv "$tmp" "$file"
    # printf "Processed: %s\n" "$file"
  else
    rm -f "$tmp"
  fi
}

# --- Main Execution ---
main(){
  # 1. Remove file-level duplicates
  dedupe_files
  # 2. Process content of remaining files
  printf "Processing text content...\n"
  while read -r file; do
    process_content "$file"
  done < <(list_files "$DIR")
  printf "Done.\n"
  # 3. Watch mode
  if [[ "$WATCH" -eq 1 ]]; then
    if ! command -v inotifywait &>/dev/null; then
      printf "Error: 'inotifywait' not found. Install 'inotify-tools' for watch mode.\n" >&2; exit 1
    fi
    printf "Watching '%s' for changes...\n" "$DIR"
    # Listen for close_write events (file saved)
    inotifywait -m -r -e close_write --format '%w%f' "$DIR" 2>/dev/null | \
    while read -r file; do
      [[ -f "$file" ]] && process_content "$file"
    done
  fi
}

main
