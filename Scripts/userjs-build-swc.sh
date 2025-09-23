#!/bin/bash
# shellcheck disable=SC2016

# This script downloads, minifies, and packages userscripts for release.
# It is optimized for speed by using modern tools like SWC and fd,
# parallel processing, and bash-native operations to minimize forking.

# --- Configuration ---
# The repository slug is used to build the final URLs in the userscript meta blocks.
# It should be in the format 'owner/repository'.
readonly REPOSITORY_SLUG="YourGitHubUsername/YourRepositoryName"

# --- Main Script ---

# Exit immediately if a command exits with a non-zero status.
set -e

# 1. Verify dependencies are installed.
# Using command -v is a portable and reliable way to check for executables.
for cmd in npm wget parallel fd; do
  if ! command -v "$cmd" &> /dev/null; then
    echo -e "\e[31mError: Required command '$cmd' is not installed. Aborting.\e[0m" >&2
    exit 1
  fi
done

# 2. Install Node.js dependencies (SWC for minification).
echo "Installing Node.js dependencies (@swc/cli, @swc/core)..."
# The output is redirected to /dev/null to keep the script output clean.
npm install --save-exact --save-dev @swc/cli @swc/core > /dev/null 2>&1

# 3. Set up the directory structure.
echo "Creating temporary directories..."
mkdir -p download pr-js meta js release

# 4. Download all userscripts listed in the 'List' file.
echo "Downloading userscripts..."
while read -r line; do
  # Using bash's built-in regex matching is faster than forking 'grep'.
  if [[ $line =~ ^#.*(https://[^[:space:]]+\.user\.js) ]]; then
    url="${BASH_REMATCH[1]}"
    # Use parameter expansion to get the filename; faster than calling 'basename'.
    file="${url##*/}"

    # Sanitize filename and handle potential name collisions.
    file=$(echo "$file" | tr -cd '[:alnum:]._-')
    if [[ -f "download/$file" ]]; then
      suffix="A"
      while [[ -f "download/$suffix-$file" ]]; do
        suffix=$(echo "$suffix" | tr "0-9A-Z" "1-9A-Z_")
      done
      file="$suffix-$file"
    fi

    echo "  -> Downloading $file"
    wget -q --header="User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0" \
         --timeout=30 "$url" -O "download/$file"
    
    # Update the 'List' file to point to this repository's future release URL.
    # This prepares the file to be used as the final README.
    sed -i "s|$url|https://raw.githubusercontent.com/$REPOSITORY_SLUG/main/release/$file|g" List
  fi
done < List

# 5. Split each downloaded userscript into its metadata block and its JavaScript code.
echo "Splitting userscripts into meta and JS files..."
for file in download/*.user.js; do
  base="${file##*/}"
  base="${base%.user.js}"
  sed -n '/\/\/ ==UserScript==/,/\/\/ ==\/UserScript==/p' "$file" > "meta/$base.meta.js"
  sed -n '/\/\/ ==\/UserScript==/,$p' "$file" | tail -n +2 > "pr-js/$base.js"
done

# 6. Modify the metadata files to point to the new repository URLs.
echo "Updating metadata..."
for file in meta/*.meta.js; do
  base="${file##*/}"
  base="${base%.meta.js}"
  
  # Remove non-English @name and all @description tags for cleaner meta blocks.
  sed -i -e '/^\/\/ @name:/ { /^\/\/ @name:en/!d }' -e '/^\/\/ @description/d' "$file"

  # Update download and update URLs to point to this repository.
  sed -i "s|// @downloadURL .*|// @downloadURL https://raw.githubusercontent.com/$REPOSITORY_SLUG/main/release/$base.user.js|" "$file"
  sed -i "s|// @updateURL .*|// @updateURL https://raw.githubusercontent.com/$REPOSITORY_SLUG/main/release/$base.meta.js|" "$file"
done

# 7. Compile/minify the JavaScript files in parallel for performance.
echo "Compiling JavaScript files with SWC..."
compile_js() {
  local file=$1
  local base
  base="${file##*/}"
  base="${base%.js}"
  # Use SWC for minification, targeting modern but compatible ES2020.
  # This produces efficient code that runs well in all modern browsers.
  npx swc "$file" -o "js/$base.js" -C minify=true -C jsc.target=es2020 \
    -C jsc.minify.mangle=true -C jsc.minify.compress=true
}
export -f compile_js

# Use 'fd' (a fast 'find' alternative) to locate JS files and pipe to GNU Parallel.
fd . pr-js/ -e js | parallel -j "$(nproc)" compile_js

# 8. Merge the modified metadata and the minified JS back into final userscript files.
echo "Merging meta and minified JS..."
for file in js/*.js; do
  base="${file##*/}"
  base="${base%.js}"
  
  # Extract the userscript name for logging purposes.
  userscript_name=$(grep -m 1 -oP '^// @name:en\s+\K.*' "meta/$base.meta.js" || \
                   grep -m 1 -oP '^// @name\s+\K.*' "meta/$base.meta.js")
  userscript_name=$(echo "$userscript_name" | tr -d '\r\n')

  if [[ ! -s "meta/$base.meta.js" ]]; then
    echo -e "\e[31mError: Missing or empty meta file for '$base.meta.js'. Skipping.\e[0m"
    rm -f "release/$base.user.js"
    continue
  fi
  
  # Sanity check: if the compiled file is very small, something probably went wrong.
  if [[ ! -s "js/$base.js" ]] || [[ $(stat -c %s "js/$base.js") -lt 100 ]]; then
    echo -e "\e[31mFailed to convert \"$userscript_name\". Output was too small or empty.\e[0m"
    rm -f "meta/$base.meta.js" "release/$base.user.js"
  else
    cat "meta/$base.meta.js" "js/$base.js" > "release/$base.user.js"
    echo -e "  \e[32m-> Successfully converted:\e[0m \"$userscript_name\""
  fi
done

# 9. Finalize the release directory.
echo "Finalizing release directory..."
# Only move meta files that have a corresponding final userscript.
for f in release/*.user.js; do
  base="${f##*/}"
  base="${base%.user.js}"
  if [[ -f "meta/$base.meta.js" ]]; then
    mv "meta/$base.meta.js" release/
  fi
done

# The 'List' file, now with updated URLs, becomes the README for the release branch.
mv List release/README.md

echo -e "\n\e[1;32mCompilation complete. Files are in the 'release' directory.\e[0m"

