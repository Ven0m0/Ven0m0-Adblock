#!/usr/bin/env bash
set -euo pipefail

# Config
src="userscripts"
out="dist"
repo="Ven0m0/Ven0m0-Adblock"
jobs=$(nproc 2>/dev/null || echo 4)

# Colors
readonly red=$'\e[31m' grn=$'\e[32m' rst=$'\e[0m'

# Process file (optimized for bash-native)
process_file() {
  local f=$1 fname base meta code js
  fname=${f##*/}
  base=${fname%.*}
  
  # Extract with one grep pass (bash-native)
  meta=$(sed -n '/^\/\/ ==UserScript==/,/^\/\/ ==\/UserScript==/p' "$f" | head -n -1)
  code=$(sed -n '/^\/\/ ==\/UserScript==/,$p' "$f" | tail -n +2)
  
  # Update metadata URLs (if exists)
  [[ -n "$meta" ]] && {
    meta=$(sed -E \
      -e "s|// @downloadURL .*|// @downloadURL https://raw.githubusercontent.com/$repo/main/$out/$fname|" \
      -e "s|// @updateURL .*|// @updateURL https://raw.githubusercontent.com/$repo/main/$out/${base}.meta.js|" \
      <<< "$meta")
  }
  
  # Minify (here-string for input)
  js=$(esbuild --minify --bundle --target=es2022 --format=iife \
       --platform=browser --log-level=error --outfile=/dev/stdout <<< "$code")
  
  # Output (direct redirection)
  if [[ -n "$meta" ]]; then
    printf "%s\n" "$meta" > "$out/${base}.meta.js"
    printf "%s\n%s\n" "$meta" "$js" > "$out/$fname"
    printf "%s✓%s %s\n" "$grn" "$rst" "$fname"
  else
    printf "%s\n" "$js" > "$out/$fname"
    printf "%s✓%s %s\n" "$grn" "$rst" "$fname"
  fi
}
export -f process_file

# Main
main() {
  mkdir -p "$src" "$out"
  
  # Process local files
  [[ -d "$src" ]] && {
    # Prefer fd, fall back to find (bash array)
    local -a files
    if command -v fd >/dev/null 2>&1; then
      mapfile -t files < <(fd -e js . "$src")
    else
      mapfile -t files < <(find "$src" -name "*.js" -type f 2>/dev/null)
    fi
    
    # Process (parallel if available)
    if [[ ${#files[@]} -gt 0 ]]; then
      if [[ ${#files[@]} -gt 1 ]] && command -v parallel >/dev/null 2>&1; then
        printf "%s\n" "${files[@]}" | parallel -j "$jobs" process_file
      else
        local f
        for f in "${files[@]}"; do
          process_file "$f"
        done
      fi
    fi
  }
  
  # Process List file
  [[ -f "List" ]] && {
    while read -r line; do
      url=$(grep -o 'https\?://[^ "]*\.user\.js' <<< "$line" 2>/dev/null || true)
      [[ -n "$url" ]] && {
        fname=${url##*/}
        fname=$(tr -cd '[:alnum:]._-' <<< "$fname")
        printf "↓ %s\n" "$fname"
        curl -sL -A "Mozilla/5.0 Firefox/124.0" -o "$src/$fname" "$url"
        process_file "$src/$fname"
        sed -i "s|$url|https://raw.githubusercontent.com/$repo/main/$out/$fname|g" List
      }
    done < List
    
    cp List "$out/README.md"
  }
  
  printf "\n%s✓ Done!%s\n" "$grn" "$rst"
}

main  if [[ -n "$meta" ]]; then
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
