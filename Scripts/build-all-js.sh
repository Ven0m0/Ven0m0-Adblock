#!/usr/bin/env bash
set -euo pipefail

src="src"
out="dist"
mkdir -p "$out"

fd -e js . "$src" | while read -r f; do
  fname=$(basename "$f")
  # Extract metadata block if present
  meta=$(awk '/^\/\/ ==UserScript==/,/^\/\/ ==\/UserScript==/' "$f" || true)
  # Remove metadata block, keep rest
  code=$(awk 'NR==1,/^\/\/ ==\/UserScript==/ {next} {print}' "$f")
  tmp=$(mktemp)
  printf '%s\n' "$code" > "$tmp"
  js=$(esbuild "$tmp" \
    --config=esbuild.config.js \
    --minify \
    --bundle \
    --target=es2022 \
    --platform=browser \
    --log-level=error \
    --outfile=/dev/stdout)
  rm "$tmp"
  # Output: metadata block first (if any), then minified code
  if [[ -n "$meta" ]]; then
    printf '%s\n%s\n' "$meta" "$js" > "$out/$fname"
  else
    printf '%s\n' "$js" > "$out/$fname"
  fi
done