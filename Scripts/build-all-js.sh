#!/usr/bin/env bash
set -euo pipefail

# Config
src="userscripts"
out="dist"
repo="Ven0m0/Ven0m0-Adblock"
jobs=$(nproc 2>/dev/null || echo 4)

# Colors for terse output
RED="\e[31m" GRN="\e[32m" RST="\e[0m"

# Process a single JS file
process_file() {
  local f=$1 fname base meta code js
  fname=$(basename "$f")
  base="${fname%.*}"
  
  # Extract metadata+code in one pass (bash-native)
  meta=$(grep -A 999999 "// ==UserScript==" "$f" | grep -B 999999 "// ==/UserScript==" | head -n -1)
  [[ -n "$meta" ]] || meta=""
  code=$(grep -A 999999 "// ==/UserScript==" "$f" | tail -n +2)
  
  # Update metadata URLs if present
  [[ -n "$meta" ]] && {
    meta=$(echo "$meta" | sed -E \
      -e "s|// @downloadURL .*|// @downloadURL https://raw.githubusercontent.com/$repo/main/$out/$fname|" \
      -e "s|// @updateURL .*|// @updateURL https://raw.githubusercontent.com/$repo/main/$out/${base}.meta.js|")
  }
  
  # Minify with esbuild (using here-string)
  js=$(esbuild --minify --bundle --target=es2022 \
       --platform=browser --log-level=error --format=iife \
       --outfile=/dev/stdout <<< "$code")
  
  # Output files with direct redirection (no echo)
  if [[ -n "$meta" ]]; then
    printf "%s\n" "$meta" > "$out/${base}.meta.js"
    printf "%s\n%s\n" "$meta" "$js" > "$out/$fname"
    printf "${GRN}✓${RST} %s (with meta)\n" "$fname"
  else
    printf "%s\n" "$js" > "$out/$fname"
    printf "${GRN}✓${RST} %s\n" "$fname"
  fi
}
export -f process_file

# Download a userscript
dl_script() {
  local url=$1 fname base
  fname=$(basename "$url" | tr -cd '[:alnum:]._-')
  
  # Handle name collisions with timestamp
  [[ -f "$src/$fname" ]] && {
    base="${fname%.*}"
    fname="${base}_$(date +%s).user.js"
  }
  
  printf "↓ %s\n" "$fname"
  curl -sL -A "Mozilla/5.0 Firefox/124.0" "$url" > "$src/$fname"
  printf "%s" "$src/$fname"
}

# Main execution
main() {
  # Create dirs
  mkdir -p "$src" "$out"
  
  # Process local files
  [[ -d "$src" ]] && {
    local -a files
    # Use fd if available, fallback to find
    if command -v fd >/dev/null 2>&1; then
      readarray -t files < <(fd -e js . "$src")
    else
      readarray -t files < <(find "$src" -name "*.js" -type f)
    fi
    
    # Process in parallel if GNU parallel exists
    if [[ ${#files[@]} -gt 1 ]] && command -v parallel >/dev/null 2>&1; then
      printf "%s\n" "${files[@]}" | parallel -j "$jobs" process_file
    else
      for f in "${files[@]}"; do
        process_file "$f"
      done
    fi
  }
  
  # Download and process URLs if List exists
  [[ -f "List" ]] && {
    while read -r line; do
      if grep -q 'https\?://.*\.user\.js' <<< "$line"; then
        url=$(grep -o 'https\?://[^ "]*\.user\.js' <<< "$line" | head -1)
        file=$(dl_script "$url")
        process_file "$file"
        # Update URLs in List
        sed -i "s|$url|https://raw.githubusercontent.com/$repo/main/$out/$(basename "$file")|g" List
      fi
    done < List
    
    # Copy List as README to dist
    cp List "$out/README.md"
  }
  
  printf "\n${GRN}✓ Done!${RST} Files in $out/\n"
}

main
