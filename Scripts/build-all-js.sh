#!/usr/bin/env bash
set -euo pipefail

# Config (edit these)
src="src"
out="dist"
repo="Ven0m0/Ven0m0-Adblock"  # GitHub username/repo
parallel_jobs=$(nproc)  # Auto-detect CPU cores

# Colors for output
declare -r RED="\e[1;31m" GREEN="\e[1;32m" RESET="\e[0m" 

# Process a single JS file
process_file() {
  local f=$1 fname base meta code js tmp
  fname=$(basename "$f")
  base="${fname%.*}"
  
  # Extract metadata block if present
  meta=$(awk '/^\/\/ ==UserScript==/,/^\/\/ ==\/UserScript==/' "$f" 2>/dev/null || echo "")
  
  # Keep only code after metadata
  code=$(awk 'BEGIN{p=1} /^\/\/ ==UserScript==/{p=0} /^\/\/ ==\/UserScript==/{p=0; next} p{print}' "$f")
  
  # Update metadata URLs if present
  if [[ -n "$meta" ]]; then
    meta=$(echo "$meta" | sed -E \
      -e "s|// @downloadURL .*|// @downloadURL https://raw.githubusercontent.com/$repo/main/dist/$fname|" \
      -e "s|// @updateURL .*|// @updateURL https://raw.githubusercontent.com/$repo/main/dist/${base}.meta.js|")
  fi
  
  # Minify with esbuild
  tmp=$(mktemp)
  echo "$code" > "$tmp"
  js=$(esbuild "$tmp" --minify --bundle --target=es2022 \
       --platform=browser --log-level=error --outfile=/dev/stdout --format=iife)
  rm "$tmp"
  
  # Output files
  if [[ -n "$meta" ]]; then
    echo "$meta" > "$out/${base}.meta.js"
    echo -e "$meta\n$js" > "$out/$fname"
    echo -e "${GREEN}✓${RESET} Processed $fname (with metadata)"
  else
    echo "$js" > "$out/$fname"
    echo -e "${GREEN}✓${RESET} Processed $fname"
  fi
}
export -f process_file

# Download a userscript
download_file() {
  local url=$1 fname base
  fname=$(basename "$url" | tr -cd '[:alnum:]._-')
  
  # Handle duplicates
  if [[ -f "$src/$fname" ]]; then
    base="${fname%.*}"
    fname="${base}_$(date +%s).user.js"
  fi
  
  echo -e "↓ Downloading $fname"
  curl -s -A "Mozilla/5.0 (X11; Linux x86_64) Firefox/124.0" \
       -H "Accept-Language: en-US,en;q=0.9" \
       "$url" > "$src/$fname"
  
  echo "$src/$fname"
}

# Main execution
main() {
  # Create output dir
  mkdir -p "$out"
  
  # Process local files if src directory exists
  if [[ -d "$src" ]]; then
    # Use fd if available, fallback to find
    if command -v fd >/dev/null 2>&1; then
      mapfile -t js_files < <(fd -e js . "$src")
    else
      mapfile -t js_files < <(find "$src" -name "*.js" -type f)
    fi
    
    # Process in parallel if GNU parallel is available
    if command -v parallel >/dev/null 2>&1; then
      printf "%s\n" "${js_files[@]}" | parallel -j "$parallel_jobs" process_file
    else
      # Process sequentially
      for f in "${js_files[@]}"; do
        process_file "$f"
      done
    fi
  fi
  
  # Download and process URLs if provided
  if [[ -f "List" ]]; then
    while read -r line; do
      if [[ "$line" =~ https?://.*\.user\.js ]]; then
        url=$(echo "$line" | grep -o 'https\?://[^ "]*\.user\.js' | head -1)
        file=$(download_file "$url")
        process_file "$file"
        # Update URLs in List file
        sed -i "s|$url|https://raw.githubusercontent.com/$repo/main/dist/$(basename "$file")|g" List
      fi
    done < List
    
    # Copy updated List as README to dist
    cp List "$out/README.md"
  fi
  
  echo -e "\n${GREEN}✓ Done!${RESET} Files are in $out/"
}

# Run the script
main
