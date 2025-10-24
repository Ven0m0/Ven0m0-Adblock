#!/usr/bin/env bash
#
# build-userscripts.sh
# Minifies all UserScripts from a source directory to a release directory using esbuild.
#
set -o errexit
set -o nounset
set -o pipefail

# --- Configuration ---
declare -r SRC_DIR="userscripts/sources"
declare -r OUT_DIR="userscripts/releases"

# --- Main Logic ---

# 1. Dependency Check
if ! command -v esbuild &>/dev/null; then
  echo "Error: esbuild is not installed. Please install it." >&2
  echo "Hint: sudo pacman -S esbuild" >&2
  exit 1
fi
if ! command -v fd &>/dev/null; then
  echo "Error: fd is not installed. Please install it." >&2
  echo "Hint: sudo pacman -S fd" >&2
  exit 1
fi

# 2. Ensure Directories Exist
mkdir -p "$SRC_DIR" "$OUT_DIR"

# 3. Processing Function
process_file() {
  local -r input_file="$1"
  local filename
  filename=$(basename "$input_file")
  local -r output_file="${OUT_DIR}/${filename}"

  echo "  -> Processing: ${filename}"

  # esbuild does not preserve top-level comments. We must extract the
  # UserScript header manually and prepend it to the minified output.
  local header
  header=$(sed -n '/\/\/ ==UserScript==/,/\/\/ ==\/UserScript==/p' "$input_file")

  # Minify the script with esbuild. The result is stored in memory.
  local minified_body
  minified_body=$(esbuild "$input_file" --minify --bundle --log-level=warning --drop:debugger --platform=browser --charset=utf8)

  # Write the final file using a here-string for efficiency.
  # This is faster than creating multiple temporary files.
  cat > "$output_file" <<< "${header}"$'\n'"${minified_body}"
}

# 4. Main Execution Block
echo "Optimizing UserScripts..."
local file
# Use fd to find all source files and pipe them to the processing function.
# --print0 and read -d '' handle filenames with spaces or special characters.
while IFS= read -r -d '' file; do
  process_file "$file"
done < <(fd --type f --extension user.js . "$SRC_DIR" --print0)

echo "UserScript optimization complete."
