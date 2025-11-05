#!/usr/bin/env bash
set -euo pipefail

# Config
readonly repo="${GITHUB_REPOSITORY:-Ven0m0/Ven0m0-Adblock}"
readonly src="${1:-userscripts}"
readonly out="${2:-dist}"
readonly list="${3:-List}"
readonly jobs=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
readonly red=$'\e[31m' grn=$'\e[32m' ylw=$'\e[33m' rst=$'\e[0m'

# Process single userscript
process() {
  local f=$1 base fname meta code js len
  fname=${f##*/}
  base=${fname%.user.js}
  [[ $fname == *.user.js ]] || base=${fname%.*}
  
  # Extract meta block (bash-native, single pass)
  meta=$(sed -n '/^\/\/ ==UserScript==/,/^\/\/ ==\/UserScript==/{ /^\/\/ ==\/UserScript==/!p }' "$f")
  code=$(sed -n '/^\/\/ ==\/UserScript==/,$p' "$f" | tail -n +2)
  
  # Clean & update meta
  if [[ -n $meta ]]; then
    meta=$(sed -E \
      -e '/^\/\/ @(name|description):/!b; /^\/\/ @(name|description):en/!d' \
      -e "s|// @downloadURL .*|// @downloadURL https://raw.githubusercontent.com/$repo/main/$out/$base.user.js|" \
      -e "s|// @updateURL .*|// @updateURL https://raw.githubusercontent.com/$repo/main/$out/$base.meta.js|" \
      <<< "$meta")
  fi
  
  # Minify (here-string stdin)
  if ! js=$(npx -y esbuild --minify --target=es2022 --format=iife --platform=browser --log-level=error <<< "$code" 2>&1); then
    printf "%s✗%s %s (esbuild failed)\n" "$red" "$rst" "$fname" >&2
    return 1
  fi
  
  len=${#js}
  if (( len < 50 )); then
    printf "%s✗%s %s (output too small: %d bytes)\n" "$red" "$rst" "$fname" "$len" >&2
    return 1
  fi
  
  # Write outputs
  if [[ -n $meta ]]; then
    printf "%s\n" "$meta" > "$out/$base.meta.js"
    printf "%s\n%s\n" "$meta" "$js" > "$out/$base.user.js"
  else
    printf "%s\n" "$js" > "$out/$base.user.js"
  fi
  
  printf "%s✓%s %s (%d → %d bytes)\n" "$grn" "$rst" "$fname" "$(wc -c < "$f")" "$len"
}
export -f process
export repo out red grn ylw rst

# Download userscript
download() {
  local url=$1 fname base ts
  fname=${url##*/}
  fname=$(tr -cd '[:alnum:]._-' <<< "$fname")
  [[ $fname == *.user.js ]] || fname+=.user.js
  
  # Handle collisions
  if [[ -f $src/$fname ]]; then
    ts=$(date +%s)
    base=${fname%.user.js}
    fname="${base}_${ts}.user.js"
  fi
  
  printf "%s↓%s %s\n" "$ylw" "$rst" "$fname"
  if curl -fsSL -A "Mozilla/5.0 Firefox/124.0" -m 30 "$url" -o "$src/$fname" 2>/dev/null; then
    printf "%s" "$src/$fname"
  else
    printf "%s✗%s failed to download %s\n" "$red" "$rst" "$url" >&2
    return 1
  fi
}

# Process List file
process_list() {
  [[ -f $list ]] || return 0
  local line url fname file updated=()
  
  while IFS= read -r line; do
    if [[ $line =~ https?://[^\ \"]+\.user\.js ]]; then
      url=${BASH_REMATCH[0]}
      if file=$(download "$url"); then
        process "$file" || continue
        fname=${file##*/}
        fname=${fname%.user.js}.user.js
        updated+=("$url|https://raw.githubusercontent.com/$repo/main/$out/$fname")
      fi
    fi
  done < "$list"
  
  # Update URLs in List
  if (( ${#updated[@]} > 0 )); then
    local tmp=$(mktemp)
    cp "$list" "$tmp"
    for pair in "${updated[@]}"; do
      IFS='|' read -r old new <<< "$pair"
      sed -i "s|$old|$new|g" "$tmp"
    done
    mv "$tmp" "$out/README.md"
  else
    cp "$list" "$out/README.md"
  fi
}

# Main
main() {
  # Setup
  mkdir -p "$src" "$out"
  command -v npx &>/dev/null || { printf "%s✗%s npx not found (install Node.js)\n" "$red" "$rst" >&2; exit 1; }
  
  # Find local files
  local -a files=()
  if [[ -d $src ]]; then
    if command -v fd &>/dev/null; then
      mapfile -t files < <(fd -e js -t f . "$src" 2>/dev/null)
    else
      mapfile -t files < <(find "$src" -type f -name "*.js" 2>/dev/null)
    fi
  fi
  
  # Process local files
  if (( ${#files[@]} > 0 )); then
    if (( ${#files[@]} > 1 )) && command -v parallel &>/dev/null; then
      printf "%s\n" "${files[@]}" | parallel -j "$jobs" --bar process {} 2>/dev/null || {
        for f in "${files[@]}"; do process "$f" || :; done
      }
    else
      for f in "${files[@]}"; do process "$f" || :; done
    fi
  fi
  
  # Process List (downloads + updates)
  process_list
  
  # Summary
  local total=$(find "$out" -name "*.user.js" -type f 2>/dev/null | wc -l)
  printf "\n%s✓%s Built %d userscripts in %s/\n" "$grn" "$rst" "$total" "$out"
}

main "$@"
